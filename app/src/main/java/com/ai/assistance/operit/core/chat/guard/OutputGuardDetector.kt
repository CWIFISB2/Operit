package com.ai.assistance.operit.core.chat.guard

import com.ai.assistance.operit.core.chat.hooks.PromptTurnKind

/**
 * 内置输出守卫 v2 —— 纯检测逻辑，无平台依赖，可直接单测。
 *
 * 与 JS 包 guard_bridge 的语义对齐点（改错会误拦或漏拦）：
 * 1. 规则按真换行分行；行内字面反斜杠+n 表示 token 需连续出现
 * 2. 绝不按空格拆（空格不是分隔符）
 * 3. 只检测「最近一条模型产出」，不扫全历史（旧版扫全历史导致每轮死循环）
 * 4. 工具条目（TOOL_CALL / TOOL_RESULT）不做结构/角色检测（平台序列化必然含标签）
 * 5. 摘要条目（SUMMARY）不做内置残片检测（摘要会忠实引用上下文标签样例）
 */
object OutputGuardDetector {

    /** 内置残片：正常正文不该出现的工具/思考协议残留。 */
    val BUILTIN_FRAGMENTS: List<String> = listOf(
        "</invoke>",
        "<invoke",
        "</param>",
        "antml:invoke",
        "<|im_start|>",
        "<|im_end|>",
        "<|endoftext|>",
        "<|eot_id|>",
        "[/INST]",
        "<<SYS>>",
        "</tool_result>",
        "<tool_result",
        "function_calls",
        "▽tool▽",
        "tool name=",
        "param name="
    )

    /** 需要做配对检查的标签名。 */
    val STRUCT_TAGS: Set<String> = setOf(
        "tool", "param", "think", "thinking", "details", "invoke", "parameter"
    )

    /** 角色 banner 前缀（行首出现即判定为角色标记泄漏）。 */
    private val ROLE_BANNERS: List<String> = listOf(
        "user:", "assistant:", "system:", "human:", "ai:",
        "role: user", "role: assistant", "role: system"
    )

    private const val INVISIBLE = "\u200B\u200C\u200D\u200E\u200F\uFEFF\u00A0"

    /** 一条命中。 */
    data class Hit(
        val rule: String,
        val category: Category,
        val index: Int,
        val snippet: String
    )

    enum class Category { KEYWORD, BUILTIN, STRUCTURE, ROLE }

    /** 分类开关。 */
    data class Toggles(
        val keywords: Boolean = true,
        val builtin: Boolean = true,
        val structure: Boolean = true,
        val role: Boolean = true,
        val foldFullWidth: Boolean = true,
        val stripInvisible: Boolean = true
    )

    /** 转义还原：把字面反斜杠序列转成真字符。 */
    fun unescape(s: String): String {
        val sb = StringBuilder(s.length)
        var i = 0
        while (i < s.length) {
            val c = s[i]
            if (c == '\\' && i + 1 < s.length) {
                when (s[i + 1]) {
                    'n' -> { sb.append('\n'); i += 2; continue }
                    't' -> { sb.append('\t'); i += 2; continue }
                    'r' -> { sb.append('\r'); i += 2; continue }
                    '\\' -> { sb.append('\\'); i += 2; continue }
                }
            }
            sb.append(c)
            i += 1
        }
        return sb.toString()
    }

    /** 全角 → 半角。 */
    fun foldFullWidth(s: String): String {
        val sb = StringBuilder(s.length)
        for (c in s) {
            when {
                c == '\u3000' -> sb.append(' ')
                c in '\uFF01'..'\uFF5E' -> sb.append((c.code - 0xFEE0).toChar())
                else -> sb.append(c)
            }
        }
        return sb.toString()
    }

    /** 去不可见字符。 */
    fun stripInvisible(s: String): String {
        val sb = StringBuilder(s.length)
        for (c in s) {
            if (INVISIBLE.indexOf(c) < 0) sb.append(c)
        }
        return sb.toString()
    }

    /** 归一化，同时产出「归一化下标 → 原文下标」映射。 */
    private fun normalize(s: String, toggles: Toggles): Pair<String, IntArray> {
        val sb = StringBuilder(s.length)
        val map = ArrayList<Int>(s.length)
        for (i in s.indices) {
            var c = s[i]
            if (toggles.stripInvisible && INVISIBLE.indexOf(c) >= 0) continue
            if (toggles.foldFullWidth) {
                if (c == '\u3000') c = ' '
                else if (c in '\uFF01'..'\uFF5E') c = (c.code - 0xFEE0).toChar()
            }
            sb.append(c)
            map.add(i)
        }
        return sb.toString() to map.toIntArray()
    }

    /**
     * 主检测入口。
     *
     * @param text 待检测文本（白名单块已剥离）
     * @param ruleSet 自定义规则集
     * @param kind 该条历史类型
     * @param toggles 分类开关
     * @param enabledGroups 启用的规则分组
     * @return 命中列表，按位置升序
     */
    fun detect(
        text: String,
        ruleSet: GuardRuleSet,
        kind: PromptTurnKind,
        toggles: Toggles = Toggles(),
        enabledGroups: Set<String> = emptySet()
    ): List<Hit> {
        if (text.isBlank()) return emptyList()

        val hits = ArrayList<Hit>(8)
        val (norm, idxMap) = normalize(text, toggles)

        val isTool = kind == PromptTurnKind.TOOL_CALL || kind == PromptTurnKind.TOOL_RESULT
        val isSummary = kind == PromptTurnKind.SUMMARY
        val skipBuiltin = isTool || isSummary

        // ① 自定义规则
        if (toggles.keywords) {
            val applicable = ruleSet.forKind(kind, enabledGroups)
            for ((rule, regex) in applicable) {
                val at = ruleSet.firstIndex(rule, regex, norm)
                if (at < 0) continue
                val orig = idxMap.getOrElse(at) { at }
                val len = if (regex != null) {
                    regex.find(norm)?.value?.length ?: rule.text.length
                } else {
                    rule.text.length
                }
                hits.add(
                    Hit(
                        rule = "kw:" + rule.raw,
                        category = Category.KEYWORD,
                        index = orig,
                        snippet = snippet(text, orig, len)
                    )
                )
            }
        }

        // ② 内置残片
        if (toggles.builtin && !skipBuiltin) {
            for (frag in BUILTIN_FRAGMENTS) {
                val probe = if (toggles.foldFullWidth) foldFullWidth(frag) else frag
                val at = norm.indexOf(probe)
                if (at < 0) continue
                val orig = idxMap.getOrElse(at) { at }
                hits.add(
                    Hit(
                        rule = "builtin:" + frag,
                        category = Category.BUILTIN,
                        index = orig,
                        snippet = snippet(text, orig, frag.length)
                    )
                )
            }
        }

        // ③ 结构配对
        if (toggles.structure && !skipBuiltin) {
            checkStructure(norm, text, idxMap)?.let { hits.add(it) }
        }

        // ④ 角色 banner
        if (toggles.role && !skipBuiltin) {
            checkRole(norm, text, idxMap)?.let { hits.add(it) }
        }

        return hits.sortedBy { it.index }
    }

    private fun snippet(text: String, index: Int, len: Int): String {
        val start = index.coerceIn(0, text.length)
        val end = (start + len.coerceAtLeast(1)).coerceAtMost(text.length)
        val s = text.substring(start, end)
        return if (s.length > 80) s.take(80) + "…" else s
    }

    /**
     * 结构检查：标签形态错误、标签错配、标签未闭合、标签未终止。
     * 返回首个问题即停（一处截断就足以判定输出被切）。
     */
    private fun checkStructure(norm: String, original: String, idxMap: IntArray): Hit? {
        // 形态错误：`< name ...>` 这类名字前带空白的畸形闭合标签
        var i = 0
        while (i < norm.length) {
            val lt = norm.indexOf('<', i)
            if (lt < 0) break
            val gt = norm.indexOf('>', lt + 1)
            if (gt < 0) break
            if (gt - lt in 2..60) {
                val inner = norm.substring(lt + 1, gt)
                if (inner.isNotEmpty() && inner[0] == '/') {
                    val name = inner.substring(1)
                    if (name.isNotEmpty() && name[0].isWhitespace()) {
                        val orig = idxMap.getOrElse(lt) { lt }
                        return Hit(
                            rule = "struct:malformed_tag",
                            category = Category.STRUCTURE,
                            index = orig,
                            snippet = snippet(original, orig, gt - lt + 1)
                        )
                    }
                }
            }
            i = gt + 1
        }

        // 标签栈配对
        val stack = ArrayDeque<Pair<String, Int>>()
        var p = 0
        while (p < norm.length) {
            val lt = norm.indexOf('<', p)
            if (lt < 0) break
            if (lt + 1 >= norm.length) break
            val isClose = norm[lt + 1] == '/'
            var ns = lt + if (isClose) 2 else 1
            val nameStart = ns
            while (ns < norm.length && (norm[ns].isLetterOrDigit() || norm[ns] == '_')) ns++
            if (ns == nameStart) { p = lt + 1; continue }
            val name = norm.substring(nameStart, ns)
            if (name !in STRUCT_TAGS) { p = lt + 1; continue }
            // 标签名后必须是空白或 '>'，否则是正常文本里的尖括号
            if (ns < norm.length && norm[ns] != '>' && !norm[ns].isWhitespace()) { p = lt + 1; continue }
            val gt = norm.indexOf('>', ns)
            if (gt < 0) {
                val orig = idxMap.getOrElse(lt) { lt }
                return Hit(
                    rule = "struct:unterminated_" + name,
                    category = Category.STRUCTURE,
                    index = orig,
                    snippet = snippet(original, orig, name.length + 2)
                )
            }
            val selfClosing = gt > lt + 1 && norm[gt - 1] == '/'
            if (isClose) {
                if (stack.isEmpty() || stack.last().first != name) {
                    val orig = idxMap.getOrElse(lt) { lt }
                    return Hit(
                        rule = "struct:unpaired_" + name,
                        category = Category.STRUCTURE,
                        index = orig,
                        snippet = snippet(original, orig, name.length + 2)
                    )
                }
                stack.removeLast()
            } else if (!selfClosing) {
                stack.addLast(name to lt)
            }
            p = gt + 1
        }

        if (stack.isNotEmpty()) {
            val (name, at) = stack.last()
            val orig = idxMap.getOrElse(at) { at }
            return Hit(
                rule = "struct:unclosed_" + name,
                category = Category.STRUCTURE,
                index = orig,
                snippet = snippet(original, orig, name.length + 2)
            )
        }
        return null
    }

    /** 角色 banner 检查：行首出现角色标记即判定泄漏。 */
    private fun checkRole(norm: String, original: String, idxMap: IntArray): Hit? {
        var lineStart = 0
        while (lineStart <= norm.length) {
            val lineEnd = norm.indexOf('\n', lineStart).let { if (it < 0) norm.length else it }
            if (lineEnd > lineStart) {
                val line = norm.substring(lineStart, lineEnd).trimStart()
                val lower = line.lowercase()
                for (banner in ROLE_BANNERS) {
                    if (lower.startsWith(banner)) {
                        val orig = idxMap.getOrElse(lineStart) { lineStart }
                        return Hit(
                            rule = "role:" + banner,
                            category = Category.ROLE,
                            index = orig,
                            snippet = snippet(original, orig, banner.length)
                        )
                    }
                }
            }
            if (lineEnd >= norm.length) break
            lineStart = lineEnd + 1
        }
        return null
    }
}