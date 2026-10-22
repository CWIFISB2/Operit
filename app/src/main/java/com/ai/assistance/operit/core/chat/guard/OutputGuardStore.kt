package com.ai.assistance.operit.core.chat.guard

import android.content.Context
import com.ai.assistance.operit.data.preferences.EnvPreferences

/**
 * 内置输出守卫的配置与统计存储。
 *
 * 键前缀独立：`builtin_guard.*`，与旧的 JS 包（`output_guard.*` /
 * `guard_bridge.whitelist`）完全不冲突，两个可以并存。
 *
 * 首次启动会把旧包的自定义规则单向迁移过来（只读旧键，不写旧键），
 * 迁移后主人手动关掉旧包即可。
 */
class OutputGuardStore private constructor(context: Context) {

    private val env = EnvPreferences.getInstance(context)

    // ---- 开关 ----

    /** 总开关。默认开，但首轮会尝试从旧包迁移规则。 */
    fun isEnabled(): Boolean = flag(KEY_ENABLED, true)

    fun setEnabled(enabled: Boolean) {
        env.setEnv(KEY_ENABLED, if (enabled) "true" else "false")
    }

    // ---- 模式 ----

    /** 工作模式：observe / retry / repair。默认 retry，与旧 JS 版一致。 */
    fun mode(): GuardMode {
        val raw = (env.getEnv(KEY_MODE) ?: "").trim().lowercase()
        return when (raw) {
            "observe" -> GuardMode.OBSERVE
            "repair" -> GuardMode.REPAIR
            else -> GuardMode.RETRY
        }
    }

    fun setMode(mode: GuardMode) {
        env.setEnv(KEY_MODE, mode.name.lowercase())
    }

    // ---- 规则 ----

    /** 自定义规则原文（一行一条）。 */
    fun rulesRaw(): String = env.getEnv(KEY_RULES) ?: ""

    fun setRulesRaw(raw: String) {
        env.setEnv(KEY_RULES, raw)
        cacheRules = null
    }

    /**
     * 编译后的规则集。空规则时返回空集，调用方需自行判断。
     * 带缓存：只有 setRulesRaw 或检测到原文变化才重建。
     */
    @Volatile
    private var cacheRules: GuardRuleSet? = null

    @Volatile
    private var cacheRulesRaw: String? = null

    fun ruleSet(): GuardRuleSet {
        val raw = rulesRaw()
        val cached = cacheRules
        if (cached != null && cacheRulesRaw == raw) return cached
        val parsed = raw.split('\n')
            .mapNotNull { GuardRule.parse(it) }
        val built = GuardRuleSet(parsed)
        cacheRules = built
        cacheRulesRaw = raw
        return built
    }

    /** 所有出现过的规则分组名。 */
    fun ruleGroups(): List<String> {
        return rulesRaw().split('\n')
            .mapNotNull { GuardRule.parse(it)?.group }
            .distinct()
            .sorted()
    }

    /** 启用的规则分组。默认全部启用。 */
    fun enabledGroups(): Set<String> {
        val raw = env.getEnv(KEY_ENABLED_GROUPS)
        // 未设置过：全部启用
        if (raw == null) return ruleGroups().toSet()
        if (raw.isBlank()) return emptySet()
        return raw.split(',').map { it.trim() }.filter { it.isNotEmpty() }.toSet()
    }

    fun setEnabledGroups(groups: Set<String>) {
        env.setEnv(KEY_ENABLED_GROUPS, groups.joinToString(","))
    }

    // ---- 白名单 ----

    fun whitelistRaw(): String = env.getEnv(KEY_WHITELIST) ?: DEFAULT_WHITELIST

    fun setWhitelistRaw(raw: String) {
        env.setEnv(KEY_WHITELIST, raw)
    }

    fun whitelistTags(): List<String> =
        whitelistRaw()
            .split(',', '\n')
            .map { it.trim().removePrefix("<").removeSuffix("/>").removeSuffix(">").trim() }
            .filter { it.isNotEmpty() }
            .distinct()

    // ---- 分类开关 ----

    fun toggles(): OutputGuardDetector.Toggles {
        return OutputGuardDetector.Toggles(
            keywords = flag(KEY_TOGGLE_KEYWORDS, true),
            builtin = flag(KEY_TOGGLE_BUILTIN, true),
            structure = flag(KEY_TOGGLE_STRUCTURE, true),
            role = flag(KEY_TOGGLE_ROLE, true),
            foldFullWidth = flag(KEY_TOGGLE_FOLD, true),
            stripInvisible = flag(KEY_TOGGLE_INVISIBLE, true)
        )
    }

    fun setToggle(name: String, enabled: Boolean) {
        val key = when (name) {
            "keywords" -> KEY_TOGGLE_KEYWORDS
            "builtin" -> KEY_TOGGLE_BUILTIN
            "structure" -> KEY_TOGGLE_STRUCTURE
            "role" -> KEY_TOGGLE_ROLE
            "foldFullWidth" -> KEY_TOGGLE_FOLD
            "stripInvisible" -> KEY_TOGGLE_INVISIBLE
            else -> return
        }
        env.setEnv(key, if (enabled) "true" else "false")
    }

    fun toggleValue(name: String): Boolean {
        return when (name) {
            "keywords" -> flag(KEY_TOGGLE_KEYWORDS, true)
            "builtin" -> flag(KEY_TOGGLE_BUILTIN, true)
            "structure" -> flag(KEY_TOGGLE_STRUCTURE, true)
            "role" -> flag(KEY_TOGGLE_ROLE, true)
            "foldFullWidth" -> flag(KEY_TOGGLE_FOLD, true)
            "stripInvisible" -> flag(KEY_TOGGLE_INVISIBLE, true)
            else -> false
        }
    }

    private fun flag(key: String, def: Boolean): Boolean {
        val v = env.getEnv(key)?.trim()?.lowercase() ?: return def
        if (v.isEmpty()) return def
        return v == "true" || v == "1" || v == "on" || v == "yes"
    }

    // ---- 统计 ----

    fun hitCount(): Int = env.getEnv(KEY_HIT_COUNT)?.toIntOrNull() ?: 0

    fun resetStats() {
        env.setEnv(KEY_HIT_COUNT, "0")
        env.setEnv(KEY_LAST_HIT, "")
        env.setEnv(KEY_LAST_DIAG, "")
    }

    /**
     * 记录一次命中。
     *
     * @param hits 本次命中列表
     * @param preview 原文预览（已截断）
     * @param blocked 是否真的拦截（observe 模式下为 false）
     */
    fun recordHit(
        hits: List<OutputGuardDetector.Hit>,
        preview: String,
        blocked: Boolean
    ) {
        val n = hitCount() + 1
        env.setEnv(KEY_HIT_COUNT, n.toString())
        val first = hits.firstOrNull()
        if (first != null) {
            env.setEnv(KEY_LAST_HIT, first.rule + " @" + first.index + " → " + first.snippet)
        }
        val prev = env.getEnv(KEY_LAST_DIAG) ?: ""
        val entry = buildString {
            append('#')
            append(n)
            append(if (blocked) " [拦截] " else " [观察] ")
            append(hits.joinToString(", ") { it.rule })
            append("\n  预览: ")
            append(preview.take(200).replace("\n", "\\n"))
        }
        val merged = (entry + "\n" + prev)
            .split('\n')
            .take(40)
            .joinToString("\n")
        env.setEnv(KEY_LAST_DIAG, merged)
    }

    fun lastDiagnostics(): String = env.getEnv(KEY_LAST_DIAG) ?: ""

    fun lastHit(): String = env.getEnv(KEY_LAST_HIT) ?: ""

    // ---- 时间闩与熔断 ----

    /**
     * 防重复追加：平台会把 PromptFinalize 在两个 stage 各派发一次，
     * 1.5 秒内重复进入直接跳过。
     */
    fun lastVoidMs(): Long = env.getEnv(KEY_VOID_LAST)?.toLongOrNull() ?: 0L

    fun markVoidNow() {
        env.setEnv(KEY_VOID_LAST, System.currentTimeMillis().toString())
    }

    /**
     * 熔断：8 秒内已重出过则本次放行，避免模型连续被拦 → 无限重出 → 卡平台。
     */
    fun lastFuseMs(): Long = env.getEnv(KEY_FUSE_LAST)?.toLongOrNull() ?: 0L

    fun markFuseNow() {
        env.setEnv(KEY_FUSE_LAST, System.currentTimeMillis().toString())
    }

    // ---- 重出指令 ----

    fun retryMessage(hitCount: Int): String {
        val custom = env.getEnv(KEY_RETRY_MSG)
        if (!custom.isNullOrBlank()) {
            return custom.replace("{n}", hitCount.toString())
        }
        return buildString {
            append("[输出守卫] 上一轮输出被判定为不完整或含协议残留（命中 ")
            append(hitCount)
            append(" 项），已作废。\n请重新输出本轮完整内容，要求：\n")
            append("1. 不要输出任何工具调用标签、思考标签或其残片\n")
            append("2. 不要在正文中输出 user: / assistant: 这类角色标记\n")
            append("3. 输出必须结构完整，不得截断\n")
        }
    }

    fun setRetryMessage(msg: String) {
        if (msg.isBlank()) env.removeEnv(KEY_RETRY_MSG) else env.setEnv(KEY_RETRY_MSG, msg)
    }

    fun retryMessageTemplate(): String = env.getEnv(KEY_RETRY_MSG) ?: ""

    // ---- 迁移 ----

    /**
     * 从旧 JS 包单向迁移规则。
     *
     * 只在「新键从未写过」时执行，避免覆盖主人后续修改。
     * 只读旧键，绝不写旧键，两个包可以共存。
     *
     * @return 是否执行了迁移
     */
    fun migrateFromLegacy(): Boolean {
        val already = env.getEnv(KEY_MIGRATED)
        if (already == "1") return false

        var migrated = false
        try {
            // 规则
            if (env.getEnv(KEY_RULES).isNullOrBlank()) {
                val legacyRules = env.getEnv(LEGACY_KEY_RULES)
                if (!legacyRules.isNullOrBlank()) {
                    env.setEnv(KEY_RULES, legacyRules)
                    migrated = true
                }
            }
            // 白名单：优先 guard_bridge.whitelist，回落 output_guard.whitelist
            if (env.getEnv(KEY_WHITELIST).isNullOrBlank()) {
                val legacyWl = env.getEnv(LEGACY_KEY_WHITELIST)
                    ?: env.getEnv(LEGACY_KEY_WHITELIST_ALT)
                if (!legacyWl.isNullOrBlank()) {
                    env.setEnv(KEY_WHITELIST, legacyWl)
                    migrated = true
                }
            }
            // 重出指令
            if (env.getEnv(KEY_RETRY_MSG).isNullOrBlank()) {
                val legacyMsg = env.getEnv(LEGACY_KEY_RETRY_MSG)
                if (!legacyMsg.isNullOrBlank()) {
                    env.setEnv(KEY_RETRY_MSG, legacyMsg)
                    migrated = true
                }
            }
        } catch (_: Throwable) {
            // 迁移失败不影响主流程
        }

        env.setEnv(KEY_MIGRATED, "1")
        return migrated
    }

    // ---- 诊断快照 ----

    /** 供设置页与工具读取的一份完整快照。 */
    fun snapshot(): Map<String, Any?> {
        return mapOf(
            "enabled" to isEnabled(),
            "mode" to mode().name.lowercase(),
            "ruleCount" to ruleSet().size,
            "groups" to ruleGroups(),
            "enabledGroups" to enabledGroups().sorted(),
            "whitelist" to whitelistRaw(),
            "toggles" to mapOf(
                "keywords" to toggleValue("keywords"),
                "builtin" to toggleValue("builtin"),
                "structure" to toggleValue("structure"),
                "role" to toggleValue("role"),
                "foldFullWidth" to toggleValue("foldFullWidth"),
                "stripInvisible" to toggleValue("stripInvisible")
            ),
            "hitCount" to hitCount(),
            "lastHit" to lastHit(),
            "diagnostics" to lastDiagnostics()
        )
    }

    companion object {
        /** 内置守卫的钩子 ID，与 JS 包（output_guard）区分。 */
        const val HOOK_ID = "builtin_output_guard"

        /** 重出条目的 metadata.source 标记。 */
        const val TURN_SOURCE = "builtin_output_guard"

        // ---- 新键（独立命名空间） ----
        private const val KEY_ENABLED = "builtin_guard.enabled"
        private const val KEY_MODE = "builtin_guard.mode"
        private const val KEY_RULES = "builtin_guard.rules"
        private const val KEY_WHITELIST = "builtin_guard.whitelist"
        private const val KEY_ENABLED_GROUPS = "builtin_guard.groups"
        private const val KEY_HIT_COUNT = "builtin_guard.hit_count"
        private const val KEY_LAST_HIT = "builtin_guard.last_hit"
        private const val KEY_LAST_DIAG = "builtin_guard.diag"
        private const val KEY_VOID_LAST = "builtin_guard.void_last"
        private const val KEY_FUSE_LAST = "builtin_guard.fuse_last"
        private const val KEY_RETRY_MSG = "builtin_guard.retry_msg"
        private const val KEY_MIGRATED = "builtin_guard.migrated"
        private const val KEY_TOGGLE_KEYWORDS = "builtin_guard.toggle.keywords"
        private const val KEY_TOGGLE_BUILTIN = "builtin_guard.toggle.builtin"
        private const val KEY_TOGGLE_STRUCTURE = "builtin_guard.toggle.structure"
        private const val KEY_TOGGLE_ROLE = "builtin_guard.toggle.role"
        private const val KEY_TOGGLE_FOLD = "builtin_guard.toggle.fold"
        private const val KEY_TOGGLE_INVISIBLE = "builtin_guard.toggle.invisible"

        // ---- 旧键（只读） ----
        private const val LEGACY_KEY_RULES = "output_guard.rules"
        private const val LEGACY_KEY_WHITELIST = "guard_bridge.whitelist"
        private const val LEGACY_KEY_WHITELIST_ALT = "output_guard.whitelist"
        private const val LEGACY_KEY_RETRY_MSG = "output_guard.msg"

        /** 白名单块默认值。 */
        const val DEFAULT_WHITELIST =
            "worldbook,memories,memory,context,workspace,status,think,thinking"

        /** 时间闩窗口：1.5 秒。 */
        const val VOID_WINDOW_MS = 1500L

        /** 熔断窗口：8 秒。 */
        const val FUSE_WINDOW_MS = 8000L

        @Volatile
        private var INSTANCE: OutputGuardStore? = null

        fun getInstance(context: Context): OutputGuardStore {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: OutputGuardStore(context.applicationContext).also { INSTANCE = it }
            }
        }
    }
}