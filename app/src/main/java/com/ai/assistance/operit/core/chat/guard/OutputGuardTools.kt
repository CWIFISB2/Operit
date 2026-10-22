package com.ai.assistance.operit.core.chat.guard

import android.content.Context

/**
 * 守卫对外暴露的最小工具接口。
 *
 * 不经过 ToolPkg 沙盒，直接给内置工具表与设置页调用。
 * 与旧的 JS 包工具（guard_get_rules / guard_set_rules / guard_reset_stats）
 * 一一对应，但命名加 `builtin_` 前缀以避免与旧包重名。
 */
object OutputGuardTools {

    /** 读取当前配置与统计。 */
    fun getStatus(context: Context): Map<String, Any?> {
        return OutputGuardStore.getInstance(context).snapshot()
    }

    /** 设置总开关。 */
    fun setEnabled(context: Context, enabled: Boolean): Map<String, Any?> {
        OutputGuardStore.getInstance(context).setEnabled(enabled)
        return mapOf("ok" to true, "enabled" to enabled)
    }

    /** 设置工作模式。 */
    fun setMode(context: Context, mode: String): Map<String, Any?> {
        val m = when (mode.trim().lowercase()) {
            "observe" -> GuardMode.OBSERVE
            "repair" -> GuardMode.REPAIR
            else -> GuardMode.RETRY
        }
        OutputGuardStore.getInstance(context).setMode(m)
        return mapOf("ok" to true, "mode" to m.name.lowercase())
    }

    /** 覆盖规则（一行一条）。 */
    fun setRules(context: Context, raw: String): Map<String, Any?> {
        val store = OutputGuardStore.getInstance(context)
        store.setRulesRaw(raw)
        return mapOf(
            "ok" to true,
            "ruleCount" to store.ruleSet().size,
            "groups" to store.ruleGroups()
        )
    }

    /** 追加规则，不覆盖已有。 */
    fun appendRules(context: Context, raw: String): Map<String, Any?> {
        val store = OutputGuardStore.getInstance(context)
        val existing = store.rulesRaw().trimEnd()
        val merged = if (existing.isEmpty()) raw else existing + "\n" + raw
        store.setRulesRaw(merged)
        return mapOf(
            "ok" to true,
            "ruleCount" to store.ruleSet().size,
            "groups" to store.ruleGroups()
        )
    }

    /** 读取规则原文。 */
    fun getRules(context: Context): Map<String, Any?> {
        val store = OutputGuardStore.getInstance(context)
        return mapOf(
            "raw" to store.rulesRaw(),
            "ruleCount" to store.ruleSet().size,
            "groups" to store.ruleGroups()
        )
    }

    /** 设置启用分组。 */
    fun setGroups(context: Context, groups: List<String>): Map<String, Any?> {
        val store = OutputGuardStore.getInstance(context)
        val all = store.ruleGroups().toSet()
        val valid = groups.filter { it in all }.toSet()
        store.setEnabledGroups(valid)
        return mapOf("ok" to true, "enabledGroups" to valid.sorted())
    }

    /** 设置某个分类开关。 */
    fun setToggle(context: Context, name: String, enabled: Boolean): Map<String, Any?> {
        OutputGuardStore.getInstance(context).setToggle(name, enabled)
        return mapOf("ok" to true, "name" to name, "enabled" to enabled)
    }

    /** 设置白名单块标签。 */
    fun setWhitelist(context: Context, raw: String): Map<String, Any?> {
        val store = OutputGuardStore.getInstance(context)
        store.setWhitelistRaw(raw)
        return mapOf("ok" to true, "tags" to store.whitelistTags())
    }

    /** 设置重出指令模板。`{n}` 会被替换为命中数。留空恢复默认。 */
    fun setRetryMessage(context: Context, msg: String): Map<String, Any?> {
        OutputGuardStore.getInstance(context).setRetryMessage(msg)
        return mapOf("ok" to true)
    }

    /** 清空统计。 */
    fun resetStats(context: Context): Map<String, Any?> {
        OutputGuardStore.getInstance(context).resetStats()
        return mapOf("ok" to true)
    }

    /** 读取诊断（最近若干次命中详情）。 */
    fun getDiagnostics(context: Context): Map<String, Any?> {
        val store = OutputGuardStore.getInstance(context)
        return mapOf(
            "hitCount" to store.hitCount(),
            "lastHit" to store.lastHit(),
            "diagnostics" to store.lastDiagnostics()
        )
    }

    /**
     * 干跑检测：不经过真实对话，直接对给定文本跑一遍检测。
     * 用于调规则时验证会不会误拦。
     */
    fun dryRun(
        context: Context,
        text: String,
        kindName: String = "assistant"
    ): Map<String, Any?> {
        val store = OutputGuardStore.getInstance(context)
        val kind = when (kindName.trim().lowercase()) {
            "user" -> com.ai.assistance.operit.core.chat.hooks.PromptTurnKind.USER
            "system" -> com.ai.assistance.operit.core.chat.hooks.PromptTurnKind.SYSTEM
            "tool" -> com.ai.assistance.operit.core.chat.hooks.PromptTurnKind.TOOL_CALL
            "summary" -> com.ai.assistance.operit.core.chat.hooks.PromptTurnKind.SUMMARY
            else -> com.ai.assistance.operit.core.chat.hooks.PromptTurnKind.ASSISTANT
        }
        val wl = store.whitelistTags()
        val pathHit = OutputGuardWhitelist.pathHit(text)
        val stripped = OutputGuardWhitelist.strip(text, wl)
        val hits = if (pathHit) emptyList() else {
            OutputGuardDetector.detect(
                text = stripped,
                ruleSet = store.ruleSet(),
                kind = kind,
                toggles = store.toggles(),
                enabledGroups = store.enabledGroups()
            )
        }
        return mapOf(
            "pathWhitelisted" to pathHit,
            "strippedLength" to stripped.length,
            "hitCount" to hits.size,
            "hits" to hits.map {
                mapOf(
                    "rule" to it.rule,
                    "category" to it.category.name.lowercase(),
                    "index" to it.index,
                    "snippet" to it.snippet
                )
            }
        )
    }
}