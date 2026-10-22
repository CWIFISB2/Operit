"use strict";
Object.defineProperty(exports, "__esModule", { version: true });
// 世界书 v2 · 关键词匹配引擎
//
// 与 v1 的 matchesEntry 完全向后兼容：
//   - keywords 数组、is_regex、case_sensitive 语义不变
//   - 1-2 字短词走 shortTokens 兜底（不变）
// 新增：
//   - keys 字段（SillyTavern 原生命名，与 keywords 合并）
//   - keyLogic：and_any / and_all / not_any / not_all
//   - secondary keys 过滤
//   - matchWholeWords 全词匹配
//   - 正则 /.../flags 形态解析（ST 风格）
var wb_data_1 = require("./wb_data.js");
/** 把 entry 的所有主关键词收集成数组（兼容 keywords / keys 两套命名）。 */
function collectPrimary(entry) {
    var out = [];
    var a = Array.isArray(entry.keywords) ? entry.keywords : [];
    var b = Array.isArray(entry.keys) ? entry.keys : [];
    for (var i = 0; i < a.length; i += 1) {
        var v = String(a[i] == null ? "" : a[i]);
        if (v)
            out.push(v);
    }
    for (var j = 0; j < b.length; j += 1) {
        var w = String(b[j] == null ? "" : b[j]);
        if (w && out.indexOf(w) < 0)
            out.push(w);
    }
    return out;
}
/** 把 entry 的次级关键词收集成数组。 */
function collectSecondary(entry) {
    var out = [];
    var a = Array.isArray(entry.secondary_keywords) ? entry.secondary_keywords : [];
    var b = Array.isArray(entry.keysecondary) ? entry.keysecondary : [];
    for (var i = 0; i < a.length; i += 1) {
        var v = String(a[i] == null ? "" : a[i]);
        if (v)
            out.push(v);
    }
    for (var j = 0; j < b.length; j += 1) {
        var w = String(b[j] == null ? "" : b[j]);
        if (w && out.indexOf(w) < 0)
            out.push(w);
    }
    return out;
}
/**
 * 解析 ST 风格正则：/pattern/flags
 * 不是这个形态时返回 null，交由普通文本匹配。
 */
function parseSlashRegex(raw) {
    var s = String(raw || "");
    if (s.length < 3)
        return null;
    if (s.charAt(0) !== "/")
        return null;
    // 从末尾找最后一个未转义的 /
    var lastSlash = -1;
    for (var i = s.length - 1; i >= 1; i -= 1) {
        if (s.charAt(i) === "/") {
            var bs = 0;
            for (var j = i - 1; j >= 0 && s.charAt(j) === "\\"; j -= 1)
                bs += 1;
            if (bs % 2 === 0) {
                lastSlash = i;
                break;
            }
        }
    }
    if (lastSlash <= 0)
        return null;
    var pattern = s.slice(1, lastSlash);
    var flags = s.slice(lastSlash + 1);
    if (!/^[gimsuy]*$/.test(flags))
        return null;
    if (!pattern)
        return null;
    return { pattern: pattern, flags: flags };
}
/** 判断单个关键词是否命中文本。 */
function matchOne(entry, keyword, text) {
    var kw = String(keyword || "");
    if (!kw)
        return false;
    var caseSensitive = entry.case_sensitive === true;
    // ① ST 风格 /.../flags
    var slash = parseSlashRegex(kw);
    if (slash) {
        try {
            var flags = slash.flags || "";
            if (!caseSensitive && flags.indexOf("i") < 0)
                flags += "i";
            return new RegExp(slash.pattern, flags).test(text);
        }
        catch (_e) {
            return false;
        }
    }
    // ② 传统 is_regex 布尔开关
    if (entry.is_regex) {
        try {
            return new RegExp(kw, caseSensitive ? "g" : "gi").test(text);
        }
        catch (_e) {
            return false;
        }
    }
    // ③ 全词匹配
    if (entry.matchWholeWords) {
        try {
            var escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            // 词边界：前后不能是字母数字下划线；CJK 场景用空白/标点界定
            var re = new RegExp("(^|[^\\w\\u4e00-\\u9fff])" + escaped + "($|[^\\w\\u4e00-\\u9fff])", caseSensitive ? "g" : "gi");
            return re.test(text);
        }
        catch (_e) {
            return false;
        }
    }
    // ④ 普通子串（原 v1 逻辑）
    if (caseSensitive) {
        return text.indexOf(kw) >= 0;
    }
    var lower = text.toLowerCase();
    var nk = kw.toLowerCase();
    if (text.indexOf(kw) >= 0)
        return true;
    if (lower.indexOf(nk) >= 0)
        return true;
    // 短词兜底：1-2 字关键词在 trigram 下结构上无法命中，走输入侧短词集合
    // 注意：这里必须判断「关键词是否出现在文本中」，而不是「文本片段是否出现在文本中」
    // （后者恒真，会导致任意 1-2 字关键词无条件命中——v1 遗留 bug，已修）
    if (nk.length < wb_data_1.TRIGRAM_MIN_LEN) {
        var shorts = wb_data_1.shortTokens(text);
        for (var i = 0; i < shorts.length; i += 1) {
            if (String(shorts[i]).toLowerCase() === nk)
                return true;
        }
    }
    return false;
}
/**
 * 主入口：判断条目是否应被关键词触发。
 *
 * @param entry 条目
 * @param text 扫描文本（已拼接 raw + processed + 历史深度）
 * @returns true = 命中
 */
function matchesEntry(entry, text) {
    var primary = collectPrimary(entry);
    if (primary.length === 0)
        return false;
    if (!text)
        return false;
    var logic = String(entry.keyLogic || entry.key_logic || "and_any");
    // 逐条判定
    var hitFlags = [];
    var hitCount = 0;
    for (var i = 0; i < primary.length; i += 1) {
        var ok = matchOne(entry, primary[i], text);
        hitFlags.push(ok);
        if (ok)
            hitCount += 1;
    }
    // ① 主逻辑
    var pass = false;
    switch (logic) {
        case "and_all":
            pass = hitCount === primary.length;
            break;
        case "not_any":
            pass = hitCount === 0;
            break;
        case "not_all":
            pass = hitCount < primary.length;
            break;
        case "and_any":
        default:
            pass = hitCount > 0;
            break;
    }
    if (!pass)
        return false;
    // ② 次级过滤（仅在主逻辑通过后判定）
    var secondary = collectSecondary(entry);
    if (secondary.length > 0) {
        var secLogic = String(entry.secondaryLogic || entry.secondary_logic || "and_any");
        var secHit = 0;
        for (var k = 0; k < secondary.length; k += 1) {
            if (matchOne(entry, secondary[k], text))
                secHit += 1;
        }
        switch (secLogic) {
            case "and_all":
                if (secHit !== secondary.length)
                    return false;
                break;
            case "not_any":
                if (secHit > 0)
                    return false;
                break;
            case "not_all":
                if (secHit >= secondary.length)
                    return false;
                break;
            case "and_any":
            default:
                if (secHit === 0)
                    return false;
                break;
        }
    }
    return true;
}
/** 统计命中的主关键词数量（供 Prioritize Inclusion 排序用）。 */
function countPrimaryHits(entry, text) {
    var primary = collectPrimary(entry);
    var n = 0;
    for (var i = 0; i < primary.length; i += 1) {
        if (matchOne(entry, primary[i], text))
            n += 1;
    }
    return n;
}
exports.collectPrimary = collectPrimary;
exports.collectSecondary = collectSecondary;
exports.parseSlashRegex = parseSlashRegex;
exports.matchOne = matchOne;
exports.matchesEntry = matchesEntry;
exports.countPrimaryHits = countPrimaryHits;