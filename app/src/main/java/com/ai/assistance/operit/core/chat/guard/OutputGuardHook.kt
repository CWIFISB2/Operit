package com.ai.assistance.operit.core.chat.guard

import android.content.Context
import com.ai.assistance.operit.core.chat.hooks.PromptFinalizeHook
import com.ai.assistance.operit.core.chat.hooks.PromptHookContext
import com.ai.assistance.operit.core.chat.hooks.PromptHookMutation
import com.ai.assistance.operit.core.chat.hooks.PromptHookRegistry
import com.ai.assistance.operit.core.chat.hooks.PromptTurn
import com.ai.assistance.operit.core.chat.hooks.PromptTurnKind
import com.ai.assistance.operit.util.AppLogger

private const val TAG = "BuiltinOutputGuard"

/**
 * 内置输出守卫（原生实现）。
 *
 * 挂载点：PromptHookRegistry.dispatchPromptFinalizeHooks
 * 钩子 ID：builtin_output_guard（与 JS 包 output_guard 区分，可并存）
 *
 * 流水线（每个 stage 都会跑一次，靠时间闩与幂等标记防重复）：
 *   1. 总开关 + 规则为空 → 直接返回
 *   2. 幂等：末尾已是守卫/桥接产物 → 跳过（防同轮重复追加）
 *   3. 时间闩：1.5 秒内已作废过 → 跳过（防双 stage 双追加）
 *   4. 定位「最近一条模型产出」（绝不扫全历史，旧版全扫导致每轮死循环）
 *   5. 白名单剥离 + 路径白名单
 *   6. 检测 → 命中
 *   7. 按模式分流：
 *      - OBSERVE：只记录，不动历史
 *      - RETRY：熔断检查 → 追加一条「重出」指令
 *      - REPAIR：直接把命中区间从内容里删掉，不重出
 *
 * 所有异常都被吞掉并记录日志，绝不让守卫本身中断对话。
 */
class OutputGuardHook(private val appContext: Context) : PromptFinalizeHook {

    override val id: String = OutputGuardStore.HOOK_ID

    private val store: OutputGuardStore = OutputGuardStore.getInstance(appContext)

    override fun onEvent(context: PromptHookContext): PromptHookMutation? {
        return try {
            run(context)
        } catch (t: Throwable) {
            AppLogger.e(TAG, "guard failed, pass through", t)
            null
        }
    }

    private fun run(context: PromptHookContext): PromptHookMutation? {
        if (!store.isEnabled()) return null

        val history = context.preparedHistory
        if (history.isEmpty()) return null

        // ---- 幂等 1：末尾已是本守卫或旧桥接注入的条目 ----
        val last = history.lastOrNull()
        val lastSource = last?.metadata?.get("source")?.toString()
        if (lastSource == OutputGuardStore.TURN_SOURCE ||
            lastSource == "output_guard" ||
            lastSource == "format_bridge"
        ) {
            return null
        }

        // ---- 时间闩：防双 stage 重复追加 ----
        val now = System.currentTimeMillis()
        if (now - store.lastVoidMs() < OutputGuardStore.VOID_WINDOW_MS) return null

        // ---- 定位最近一条模型产出 ----
        var lastAiIdx = -1
        for (i in history.indices.reversed()) {
            val k = history[i].kind
            if (k == PromptTurnKind.ASSISTANT ||
                k == PromptTurnKind.TOOL_CALL ||
                k == PromptTurnKind.TOOL_RESULT ||
                k == PromptTurnKind.SUMMARY
            ) {
                lastAiIdx = i
                break
            }
        }
        if (lastAiIdx < 0) return null

        val target = history[lastAiIdx]

        // 跳过自产条目
        val targetSource = target.metadata["source"]?.toString()
        if (targetSource == OutputGuardStore.TURN_SOURCE ||
            targetSource == "output_guard" ||
            targetSource == "format_bridge"
        ) {
            return null
        }

        val raw = target.content
        if (raw.isBlank()) return null

        // ---- 白名单剥离 ----
        val whitelist = store.whitelistTags()
        if (OutputGuardWhitelist.pathHit(raw)) return null
        val stripped = OutputGuardWhitelist.strip(raw, whitelist)
        if (stripped.isBlank()) return null

        // ---- 检测 ----
        val ruleSet = store.ruleSet()
        val toggles = store.toggles()
        val groups = store.enabledGroups()
        val hits = OutputGuardDetector.detect(
            text = stripped,
            ruleSet = ruleSet,
            kind = target.kind,
            toggles = toggles,
            enabledGroups = groups
        )
        if (hits.isEmpty()) return null

        val mode = store.mode()

        // ---- 观察模式：只记录 ----
        if (mode == GuardMode.OBSERVE) {
            store.recordHit(hits, stripped, blocked = false)
            AppLogger.d(TAG, "observe: " + hits.size + " hit(s), " + hits.first().rule)
            return null
        }

        // ---- 修复模式：就地删掉命中片段，不重出 ----
        if (mode == GuardMode.REPAIR) {
            val repaired = repair(raw, hits)
            store.recordHit(hits, stripped, blocked = true)
            if (repaired == raw) return null
            AppLogger.d(TAG, "repair: " + hits.size + " hit(s) removed")
            val next = history.toMutableList()
            next[lastAiIdx] = target.copy(content = repaired)
            return PromptHookMutation(
                preparedHistory = next,
                metadata = mapOf("builtin_output_guard.repaired" to hits.size)
            )
        }

        // ---- 重出模式：熔断检查 ----
        val fuseOpen = (now - store.lastFuseMs()) >= OutputGuardStore.FUSE_WINDOW_MS
        store.recordHit(hits, stripped, blocked = fuseOpen)
        if (!fuseOpen) {
            AppLogger.w(TAG, "fuse open (8s), pass through to avoid infinite retry")
            return null
        }

        store.markFuseNow()
        store.markVoidNow()

        val next = history.toMutableList()
        next.add(
            PromptTurn(
                kind = PromptTurnKind.TOOL_RESULT,
                content = store.retryMessage(hits.size),
                metadata = mapOf(
                    "source" to OutputGuardStore.TURN_SOURCE,
                    "hitCount" to hits.size,
                    "rules" to hits.joinToString(",") { it.rule }
                )
            )
        )
        AppLogger.d(TAG, "retry: " + hits.size + " hit(s), first=" + hits.first().rule)

        // 防御性透传：同轮可能还有别的 hook 注入过 systemPrompt / toolPrompt
        return PromptHookMutation(
            preparedHistory = next,
            systemPrompt = context.systemPrompt,
            toolPrompt = context.toolPrompt,
            metadata = mapOf("builtin_output_guard.blocked" to true)
        )
    }

    /**
     * 就地修复：从后往前删命中区间，避免下标位移。
     *
     * 只删「关键词 / 内置残片 / 角色 banner」的命中片段；
     * 结构类命中（未闭合标签）无法就地修，整个不动，交给重出模式或人工判断。
     */
    private fun repair(text: String, hits: List<OutputGuardDetector.Hit>): String {
        val repairable = hits.filter {
            it.category != OutputGuardDetector.Category.STRUCTURE
        }
        if (repairable.isEmpty()) return text

        val sb = StringBuilder(text)
        // 按 index 降序删，防位移
        for (hit in repairable.sortedByDescending { it.index }) {
            val start = hit.index.coerceIn(0, sb.length)
            // snippet 可能被截断到 80 字，用原始长度更准；这里以 snippet 长度为准
            val end = (start + hit.snippet.length).coerceAtMost(sb.length)
            if (end > start) {
                sb.delete(start, end)
            }
        }
        return sb.toString()
    }
}

/**
 * 守卫的安装入口。
 *
 * 幂等：重复调用只会替换同一 id 的钩子，不会叠加。
 */
object OutputGuardInstaller {

    @Volatile
    private var installed = false

    /**
     * 在应用启动时调用一次。
     */
    fun install(context: Context) {
        if (installed) return
        synchronized(this) {
            if (installed) return
            try {
                val app = context.applicationContext
                // 一次性迁移旧包规则（只读旧键）
                OutputGuardStore.getInstance(app).migrateFromLegacy()
                PromptHookRegistry.registerPromptFinalizeHook(OutputGuardHook(app))
                installed = true
                AppLogger.d(TAG, "builtin output guard installed")
            } catch (t: Throwable) {
                AppLogger.e(TAG, "install failed", t)
            }
        }
    }

    fun uninstall() {
        synchronized(this) {
            try {
                PromptHookRegistry.unregisterPromptFinalizeHook(OutputGuardStore.HOOK_ID)
            } catch (_: Throwable) {
            }
            installed = false
        }
    }

    fun isInstalled(): Boolean = installed
}