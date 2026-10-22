"use strict";
Object.defineProperty(exports, "__esModule", { version: true });
exports.estimateTokens = estimateTokens;
exports.applyBudget = applyBudget;
// 世界书 v2 · Token 预算裁剪
//
// 语义对齐 SillyTavern：
//   - 按 order（越小越优先）排序，依次纳入直到预算耗尽
//   - minActivations：即使超预算，也要保证至少这么多条真正命中关键词的条目被纳入
//   - 常驻条目（always_active）优先于关键词条目
//   - 单个条目超预算时：若它是常驻条目，仍纳入（常驻是用户的明确要求）；
//                      若它是关键词条目，跳过
//
// Token 估算：不引入 tokenizer 依赖（沙盒里没有），用混合估算：
//   CJK 字符 ≈ 1 token / 字
//   ASCII 单词 ≈ 1 token / 4 字符
//   其余符号 ≈ 1 token / 2 字符
// 误差在 ±15% 内，对预算裁剪足够。
/** 估算文本 token 数。 */
function estimateTokens(text) {
    var s = String(text || "");
    if (!s)
        return 0;
    var cjk = 0;
    var ascii = 0;
    var other = 0;
    for (var i = 0; i < s.length; i += 1) {
        var code = s.charCodeAt(i);
        if (code >= 0x4e00 && code <= 0x9fff)
            cjk += 1; // CJK 统一汉字
        else if (code >= 0x3040 && code <= 0x30ff)
            cjk += 1; // 日文假名
        else if (code >= 0xac00 && code <= 0xd7af)
            cjk += 1; // 韩文
        else if (code < 0x80)
            ascii += 1;
        else
            other += 1;
    }
    return Math.ceil(cjk * 1.0 + ascii / 4 + other / 2);
}
/** 取条目的 order 值（越小越优先）。 */
function orderOf(entry) {
    // 优先用 order；回落 priority（v1 语义：priority 越大越优先，需反转）
    if (entry.order != null && entry.order !== "") {
        var o = Number(entry.order);
        if (isFinite(o))
            return o;
    }
    if (entry.priority != null && entry.priority !== "") {
        var p = Number(entry.priority);
        if (isFinite(p))
            return 100 - p;
    }
    return 100;
}
/**
 * 应用预算裁剪。
 *
 * @param entries   候选条目（已通过全部筛选）
 * @param budget    Token 预算（<=0 表示不限制）
 * @param opts      { minActivations, isKeywordHit: (entry)=>boolean }
 * @returns { kept, dropped, usedTokens }
 */
function applyBudget(entries, budget, opts) {
    var o = opts || {};
    var minActivations = Math.max(0, Number(o.minActivations) || 0);
    var isKeywordHit = typeof o.isKeywordHit === "function" ? o.isKeywordHit : function () { return false; };
    if (!budget || budget <= 0) {
        var used0 = 0;
        for (var u = 0; u < entries.length; u += 1)
            used0 += estimateTokens(entries[u].content);
        return { kept: entries.slice(), dropped: [], usedTokens: used0 };
    }
    // 排序：常驻优先，其次 order 小者优先
    var sorted = entries.slice().sort(function (x, y) {
        var cx = (x.always_active || x._forced) ? 0 : 1;
        var cy = (y.always_active || y._forced) ? 0 : 1;
        if (cx !== cy)
            return cx - cy;
        return orderOf(x) - orderOf(y);
    });
    var kept = [];
    var dropped = [];
    var used = 0;
    var keywordPicked = 0;
    for (var i = 0; i < sorted.length; i += 1) {
        var e = sorted[i];
        var cost = estimateTokens(e.content);
        var isAlways = e.always_active === true || e._forced === true;
        var isKw = isKeywordHit(e);
        var hasRoom = used + cost <= budget;
        // ① 有空间：纳入
        if (hasRoom) {
            kept.push(e);
            used += cost;
            if (isKw)
                keywordPicked += 1;
            continue;
        }
        // ② 无空间但常驻条目：仍纳入（用户明确要求）
        if (isAlways) {
            kept.push(e);
            used += cost;
            continue;
        }
        // ③ 无空间但还没满足 minActivations：关键词条目强行纳入
        if (isKw && keywordPicked < minActivations) {
            kept.push(e);
            used += cost;
            keywordPicked += 1;
            continue;
        }
        dropped.push({ entry: e, reason: "budget", cost: cost });
    }
    return { kept: kept, dropped: dropped, usedTokens: used };
}
exports.orderOf = orderOf;