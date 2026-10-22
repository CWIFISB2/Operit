package com.ai.assistance.operit.core.chat.guard

/**
 * 白名单块剥离器。
 *
 * 语义（与 JS 版 stripWhitelistBlocks 对齐）：
 * - 形如 &lt;worldbook&gt;…&lt;/worldbook&gt; 的整块内容不参与检测
 * - 未闭合的开标签，从开标签处到文末全部剥离（保守策略，宁漏判不误拦）
 * - 路径类白名单命中则整条不检测（正文正常引用路径容易与工具标签混淆）
 */
object OutputGuardWhitelist {

    /** 路径类白名单前缀。 */
    private val PATH_WHITELIST = listOf(
        "/data/user/",
        "/storage/emulated/",
        "/sdcard/",
        "/data/data/"
    )

    /**
     * 剥离白名单块，返回剩余可检测文本。
     */
    fun strip(text: String, tags: List<String>): String {
        if (text.isEmpty() || tags.isEmpty()) return text
        var out = text
        for (tag in tags) {
            out = stripOne(out, tag, 0)
        }
        return out
    }

    private fun stripOne(text: String, tag: String, depth: Int): String {
        if (depth > 20) return text
        val open = "<" + tag
        val close = "</" + tag + ">"
        val sb = StringBuilder()
        var cursor = 0
        while (cursor < text.length) {
            val start = text.indexOf(open, cursor)
            if (start < 0) {
                sb.append(text, cursor, text.length)
                break
            }
            // 确认是完整标签名，而不是更长标签的前缀（<file 不应吃掉 <filename）
            val afterName = start + open.length
            if (afterName < text.length) {
                val c = text[afterName]
                if (c != '>' && c != '/' && !c.isWhitespace()) {
                    // 不是目标标签，保留一个字符继续找
                    sb.append(text, cursor, start + 1)
                    cursor = start + 1
                    continue
                }
            }
            sb.append(text, cursor, start)
            val end = text.indexOf(close, afterName)
            if (end < 0) {
                // 未闭合：保守剥离到结尾
                cursor = text.length
                break
            }
            cursor = end + close.length
        }
        return sb.toString()
    }

    /** 路径类白名单命中判定。 */
    fun pathHit(text: String): Boolean {
        for (p in PATH_WHITELIST) {
            if (text.contains(p)) return true
        }
        return false
    }
}