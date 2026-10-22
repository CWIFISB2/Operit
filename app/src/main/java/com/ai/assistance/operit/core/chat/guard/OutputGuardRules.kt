package com.ai.assistance.operit.core.chat.guard

import com.ai.assistance.operit.core.chat.hooks.PromptTurnKind

/**
 * 守卫生效模式。
 */
enum class GuardMode {
    /** 只记录命中，不拦截。用于调规则。 */
    OBSERVE,

    /** 命中即作废本轮，追加重出指令（原 JS 版行为）。 */
    RETRY,

    /** 命中即就地清理残留（删掉标签残片），不重出。 */
    REPAIR
}

/**
 * 一条已编译规则。
 *
 * 语法（前缀命中才当前缀，否则整行按纯文本）：
 * ```
 * 普通文字                  → 关键词，所有条目类型都检测
 * assistant::文字           → 仅 ASSISTANT 条目
 * user::文字 / system::文字  → 仅对应类型
 * summary::文字             → 仅 SUMMARY 条目
 * tool::文字                → 仅 TOOL_CALL / TOOL_RESULT 条目
 * re::正则                   → 按正则匹配（区分大小写，可加 (?i)）
 * g:分组名::文字             → 归入分组，可按组启停
 * ```
 *
 * 与旧版的兼容性：旧规则里没有这些前缀，会被当作纯文本处理，行为完全一致。
 */
data class GuardRule(
    val raw: String,
    val text: String,
    val isRegex: Boolean = false,
    val scope: Scope = Scope.ALL,
    val group: String? = null
) {
    enum class Scope {
        ALL, ASSISTANT, USER, SYSTEM, SUMMARY, TOOL;

        fun accepts(kind: PromptTurnKind): Boolean {
            return when (this) {
                ALL -> true
                ASSISTANT -> kind == PromptTurnKind.ASSISTANT
                USER -> kind == PromptTurnKind.USER
                SYSTEM -> kind == PromptTurnKind.SYSTEM
                SUMMARY -> kind == PromptTurnKind.SUMMARY
                TOOL -> kind == PromptTurnKind.TOOL_CALL || kind == PromptTurnKind.TOOL_RESULT
            }
        }
    }

    companion object {
        private val SCOPES = mapOf(
            "assistant" to Scope.ASSISTANT,
            "ai" to Scope.ASSISTANT,
            "user" to Scope.USER,
            "human" to Scope.USER,
            "system" to Scope.SYSTEM,
            "summary" to Scope.SUMMARY,
            "tool" to Scope.TOOL
        )

        /**
         * 解析一行规则。无法识别的前缀按纯文本处理，绝不丢规则。
         */
        fun parse(line: String): GuardRule? {
            val trimmed = line.trim()
            if (trimmed.isEmpty()) return null

            var body = OutputGuardDetector.unescape(trimmed)
            var isRegex = false
            var scope = Scope.ALL
            var group: String? = null

            // 逐层剥离前缀，最多 3 层（g:x::re::... 这种组合）
            var guard = 0
            while (guard < 3) {
                val sep = body.indexOf("::")
                if (sep <= 0) break
                val head = body.substring(0, sep).trim()
                val tail = body.substring(sep + 2)
                if (tail.isEmpty()) break

                val lower = head.lowercase()
                when {
                    lower == "re" || lower == "regex" -> {
                        isRegex = true
                        body = tail
                    }
                    SCOPES.containsKey(lower) -> {
                        scope = SCOPES.getValue(lower)
                        body = tail
                    }
                    lower.startsWith("g:") && head.length > 2 -> {
                        group = head.substring(2).trim().ifEmpty { null }
                        body = tail
                    }
                    else -> break
                }
                guard += 1
            }

            body = body.trim()
            if (body.isEmpty()) return null

            return GuardRule(
                raw = trimmed,
                text = body,
                isRegex = isRegex,
                scope = scope,
                group = group
            )
        }
    }
}

/**
 * 编译后的匹配器缓存，避免每次 PromptFinalize 重复编译正则。
 */
class GuardRuleSet(private val rules: List<GuardRule>) {

    private val compiled: List<Pair<GuardRule, Regex?>> = rules.map { rule ->
        if (!rule.isRegex) {
            rule to null
        } else {
            val re = try {
                Regex(rule.text)
            } catch (_: Throwable) {
                null
            }
            rule to re
        }
    }

    val size: Int get() = rules.size

    /**
     * 在文本里找该规则的首次命中位置。找不到返回 -1。
     */
    fun firstIndex(rule: GuardRule, regex: Regex?, haystack: String): Int {
        if (regex != null) {
            val m = regex.find(haystack) ?: return -1
            return m.range.first
        }
        return haystack.indexOf(rule.text)
    }

    /**
     * 返回对给定条目类型生效的规则（含正则编译结果）。无效正则被跳过。
     */
    fun forKind(kind: PromptTurnKind, enabledGroups: Set<String>): List<Pair<GuardRule, Regex?>> {
        return compiled.filter { (rule, regex) ->
            rule.scope.accepts(kind) &&
                (rule.group == null || rule.group in enabledGroups) &&
                (!rule.isRegex || regex != null)
        }
    }
}