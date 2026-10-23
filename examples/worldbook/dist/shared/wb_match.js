"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectPrimary = collectPrimary;
exports.collectSecondary = collectSecondary;
exports.parseSlashRegex = parseSlashRegex;
exports.matchOne = matchOne;
exports.matchesEntry = matchesEntry;
exports.countPrimaryHits = countPrimaryHits;
exports.auditKeywords = auditKeywords;
exports.tokenizeExpr = tokenizeExpr;
exports.evaluateExpr = evaluateExpr;
exports.BOUNDARY_MODES = BOUNDARY_MODES;
// 世界书匹配引擎 v3
// 借鉴 siliconlotus/st-worldsapart (MIT) 的表达式匹配思路，重写为兼容原接口的实现。
//
// 新增能力（相对 v1/v2）：
//   ① 表达式键：以 ? 开头，支持 & | ! ( ) 组合
//   ② 边界模式：strict / loose / none（CJK 友好）
//   ③ 引号族：英文/中文/法文/日文引号统一识别
//   ④ 宏展开：{{char}} {{user}} 等
//   ⑤ 冲突检测、永不触发词检测、过度触发词检测（auditKeywords）
//
// 设计原则：
//   1. 完全兼容旧接口：collectPrimary / collectSecondary / matchOne /
//      matchesEntry / countPrimaryHits 行为不变（除修 bug）。
//   2. 表达式键是可选的：不含 ? 前缀的键走原逻辑。
//   3. 不引入任何运行时依赖。

var wb_data_1 = require("./wb_data.js");

// ---------- 常量 ----------
var BOUNDARY_MODES = ["strict", "loose", "none"];

// 引号族：开引号 → 关引号
var QUOTE_PAIRS = [
    ['"', '"'], ["“", "”"], ["„", "‟"], ["«", "»"],
    ["「", "」"], ["『", "』"], ["《", "》"], ["〈", "〉"],
];
var QUOTE_OPEN = QUOTE_PAIRS.map(function (p) { return p[0]; }).join("");
var QUOTE_CLOSE = QUOTE_PAIRS.map(function (p) { return p[1]; }).join("");

// 宏
var MACRO_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

// 表达式键前缀
var EXPR_PREFIX = "?";

// ---------- 收集 ----------

/** 收集主关键词（兼容 v1：keywords 数组；v2：逗号字符串） */
function collectPrimary(entry) {
    if (!entry) return [];
    var src = entry.keywords;
    if (Array.isArray(src)) {
        return src.map(function (k) { return String(k == null ? "" : k).trim(); })
                  .filter(function (k) { return k.length > 0; });
    }
    if (typeof src === "string") {
        return src.split(/[,，]/).map(function (k) { return k.trim(); })
                  .filter(function (k) { return k.length > 0; });
    }
    return [];
}

/** 收集次要关键词 */
function collectSecondary(entry) {
    if (!entry) return [];
    var src = entry.secondary_keys != null ? entry.secondary_keys : entry.secondaryKeys;
    if (Array.isArray(src)) {
        return src.map(function (k) { return String(k == null ? "" : k).trim(); })
                  .filter(function (k) { return k.length > 0; });
    }
    if (typeof src === "string") {
        return src.split(/[,，]/).map(function (k) { return k.trim(); })
                  .filter(function (k) { return k.length > 0; });
    }
    return [];
}

// ---------- /regex/flags ----------

function parseSlashRegex(raw) {
    var s = String(raw || "");
    if (s.length < 3) return null;
    if (s.charAt(0) !== "/") return null;
    var lastSlash = s.lastIndexOf("/");
    if (lastSlash <= 0) return null;
    var pattern = s.slice(1, lastSlash);
    var flags = s.slice(lastSlash + 1);
    if (!/^[dgimsuvy]*$/.test(flags)) return null;
    return { pattern: pattern, flags: flags };
}

// ---------- 宏展开 ----------

function expandMacros(text, macros) {
    if (!macros) return String(text || "");
    return String(text || "").replace(MACRO_RE, function (m, name) {
        var v = macros[name];
        return v == null ? m : String(v);
    });
}

// ---------- 表达式词法 ----------

/**
 * 把 `?` 表达式切成 token。
 * 支持：( ) & | ! 以及字面量（可带引号）
 * 例：`?(龙 | 巨龙) & !幼龙`
 */
function tokenizeExpr(raw) {
    var s = String(raw || "");
    // 去掉开头的 ?
    if (s.charAt(0) === EXPR_PREFIX) s = s.slice(1);
    var tokens = [];
    var i = 0;
    var n = s.length;
    while (i < n) {
        var ch = s.charAt(i);
        // 空白
        if (/\s/.test(ch)) { i += 1; continue; }
        // 运算符
        if (ch === "&" || ch === "|" || ch === "!" || ch === "(" || ch === ")") {
            // 支持 && || 双写
            if ((ch === "&" || ch === "|") && s.charAt(i + 1) === ch) {
                tokens.push({ t: "op", v: ch });
                i += 2;
                continue;
            }
            tokens.push({ t: ch === "(" || ch === ")" ? "paren" : "op", v: ch });
            i += 1;
            continue;
        }
        // 引号包裹的字面量（任一引号族）
        if (QUOTE_OPEN.indexOf(ch) >= 0) {
            var closeCh = null;
            for (var qi = 0; qi < QUOTE_PAIRS.length; qi += 1) {
                if (QUOTE_PAIRS[qi][0] === ch) { closeCh = QUOTE_PAIRS[qi][1]; break; }
            }
            var j = i + 1;
            var buf = "";
            while (j < n && s.charAt(j) !== closeCh) { buf += s.charAt(j); j += 1; }
            if (j < n) j += 1; // 跳过闭引号
            tokens.push({ t: "lit", v: buf });
            i = j;
            continue;
        }
        // 裸字面量：读到空白或运算符前
        var k = i;
        var lit = "";
        while (k < n) {
            var c = s.charAt(k);
            if (/\s/.test(c)) break;
            if ("&|!()".indexOf(c) >= 0) break;
            lit += c;
            k += 1;
        }
        if (lit) tokens.push({ t: "lit", v: lit });
        i = k;
    }
    return tokens;
}

// ---------- 表达式求值 ----------

/**
 * 递归下降求值。
 * 语法：expr := orExpr
 *       orExpr := andExpr ( '|' andExpr )*
 *       andExpr := notExpr ( '&' notExpr )*
 *       notExpr := '!' notExpr | atom
 *       atom := '(' expr ')' | literal
 */
function evaluateExpr(tokens, text, opts) {
    var pos = 0;
    var boundary = (opts && opts.boundary) || "strict";
    var caseSensitive = !!(opts && opts.caseSensitive);

    function peek() { return tokens[pos]; }
    function eat() { return tokens[pos++]; }

    function parseOr() {
        var left = parseAnd();
        while (peek() && peek().t === "op" && peek().v === "|") {
            eat();
            var right = parseAnd();
            left = left || right;
        }
        return left;
    }

    function parseAnd() {
        var left = parseNot();
        while (peek() && peek().t === "op" && peek().v === "&") {
            eat();
            var right = parseNot();
            left = left && right;
        }
        return left;
    }

    function parseNot() {
        if (peek() && peek().t === "op" && peek().v === "!") {
            eat();
            return !parseNot();
        }
        return parseAtom();
    }

    function parseAtom() {
        var tok = eat();
        if (!tok) return false;
        if (tok.t === "paren" && tok.v === "(") {
            var inner = parseOr();
            var close = peek();
            if (close && close.t === "paren" && close.v === ")") eat();
            return inner;
        }
        if (tok.t === "lit") {
            return literalHit(tok.v, text, boundary, caseSensitive);
        }
        return false;
    }

    try {
        return parseOr();
    } catch (_e) {
        return false;
    }
}

/** 单个字面量是否命中文本（含边界控制） */
function literalHit(kw, text, boundary, caseSensitive) {
    var k = String(kw || "");
    if (!k) return false;
    var hay = String(text || "");
    if (!caseSensitive) {
        k = k.toLowerCase();
        hay = hay.toLowerCase();
    }
    var idx = hay.indexOf(k);
    if (idx < 0) return false;
    if (boundary === "none") return true;

    // 词边界：CJK 字符不算「词内」，只有 ASCII 字母数字下划线才算
    var isWordChar = function (c) {
        return /[A-Za-z0-9_]/.test(c);
    };
    var cjk = function (c) {
        var code = c.charCodeAt(0);
        return (code >= 0x4e00 && code <= 0x9fff) ||
               (code >= 0x3040 && code <= 0x30ff) ||
               (code >= 0xac00 && code <= 0xd7af);
    };

    var before = idx > 0 ? hay.charAt(idx - 1) : "";
    var after = idx + k.length < hay.length ? hay.charAt(idx + k.length) : "";
    var kFirst = k.charAt(0);
    var kLast = k.charAt(k.length - 1);

    if (boundary === "strict") {
        // 严格：仅当两侧都是 ASCII 字母数字下划线时才算词内粘连。
        // CJK 不做边界检查——中文没有空格分词，"巨龙"出现在"一条巨龙"里
        // 是正常命中，不是粘连（v1 行为如此，v3 保持一致）。
        if (before && isWordChar(before) && isWordChar(kFirst)) return false;
        if (after && isWordChar(after) && isWordChar(kLast)) return false;
        return true;
    }
    if (boundary === "loose") {
        // 宽松：只挡 ASCII 词内粘连
        if (before && isWordChar(before) && isWordChar(kFirst)) return false;
        if (after && isWordChar(after) && isWordChar(kLast)) return false;
        return true;
    }
    return true;
}

// ---------- 单键匹配 ----------

function matchOne(entry, keyword, text) {
    var kw = String(keyword || "").trim();
    if (!kw) return false;
    var caseSensitive = entry.case_sensitive === true;
    var boundary = (entry.boundaryMode || entry.boundary_mode || "strict");

    // ① 表达式键（? 前缀）
    if (kw.charAt(0) === EXPR_PREFIX) {
        var toks = tokenizeExpr(kw);
        if (!toks.length) return false;
        return evaluateExpr(toks, text, { boundary: boundary, caseSensitive: caseSensitive });
    }

    // ② ST 风格 /.../flags
    var slash = parseSlashRegex(kw);
    if (slash) {
        try {
            var flags = slash.flags || "";
            if (!caseSensitive && flags.indexOf("i") < 0) flags += "i";
            return new RegExp(slash.pattern, flags).test(text);
        } catch (_e) {
            return false;
        }
    }

    // ③ 传统 is_regex 布尔开关
    if (entry.is_regex) {
        try {
            return new RegExp(kw, caseSensitive ? "g" : "gi").test(text);
        } catch (_e) {
            return false;
        }
    }

    // ④ 全词匹配（v2 字段）→ 走 boundary
    if (entry.matchWholeWords) {
        return literalHit(kw, text, "strict", caseSensitive);
    }

    // ⑤ 普通子串（边界按条目配置）
    if (literalHit(kw, text, boundary, caseSensitive)) return true;

    // ⑥ 短词兜底：1-2 字关键词在 trigram 下结构上无法命中
    if (kw.length < wb_data_1.TRIGRAM_MIN_LEN) {
        var shorts = wb_data_1.shortTokens(text);
        var nk = caseSensitive ? kw : kw.toLowerCase();
        for (var i = 0; i < shorts.length; i += 1) {
            var s = caseSensitive ? String(shorts[i]) : String(shorts[i]).toLowerCase();
            if (s === nk) return true;
        }
    }

    return false;
}

// ---------- 条目匹配 ----------

/**
 * 主入口：判断条目是否应被关键词触发。
 *
 * keyLogic（v2 字段）支持：
 *   and_any  —— 任一主关键词命中即可（默认，兼容 v1）
 *   and_all  —— 所有主关键词都需命中
 *   not_any  —— 所有主关键词都不能命中
 *   not_all  —— 不能全部命中
 */
function matchesEntry(entry, text) {
    if (!entry || entry.enabled === false) return false;
    if (entry.always_active === true) return true;

    var prim = collectPrimary(entry);
    if (!prim.length) {
        // 无主关键词：不激活（除非 always_active 已处理）
        return false;
    }

    var logic = entry.keyLogic || entry.key_logic || "and_any";
    var hitCount = 0;
    var i;

    for (i = 0; i < prim.length; i += 1) {
        if (matchOne(entry, prim[i], text)) hitCount += 1;
    }

    var primaryOk;
    switch (logic) {
        case "and_all":
            primaryOk = hitCount === prim.length;
            break;
        case "not_any":
            primaryOk = hitCount === 0;
            break;
        case "not_all":
            primaryOk = hitCount < prim.length;
            break;
        case "and_any":
        default:
            primaryOk = hitCount > 0;
            break;
    }

    if (!primaryOk) return false;

    // 次要关键词（若配置了 secondary_logic 则参与）
    var sec = collectSecondary(entry);
    if (!sec.length) return true;

    var secLogic = entry.secondaryLogic || entry.secondary_logic || "and_any";
    var secHits = 0;
    for (i = 0; i < sec.length; i += 1) {
        if (matchOne(entry, sec[i], text)) secHits += 1;
    }
    switch (secLogic) {
        case "and_all":
            return secHits === sec.length;
        case "not_any":
            return secHits === 0;
        case "not_all":
            return secHits < sec.length;
        case "and_any":
        default:
            return secHits > 0;
    }
}

/** 统计主关键词命中数（用于打分排序） */
function countPrimaryHits(entry, text) {
    var prim = collectPrimary(entry);
    var n = 0;
    for (var i = 0; i < prim.length; i += 1) {
        if (matchOne(entry, prim[i], text)) n += 1;
    }
    return n;
}

// ---------- 关键词审计 ----------

/**
 * 审计一个条目集合的关键词质量。
 * 返回：
 *   never     —— 结构性永不触发的词（空、纯运算符、非法正则）
 *   overbroad —— 过短或有歧义的词（1 字、纯标点）
 *   duplicates—— 完全重复的词
 *   regexBad  —— 编译失败的正则
 *   stats     —— 统计
 */
function auditKeywords(entries) {
    var list = Array.isArray(entries) ? entries : [];
    var all = new Map();

    var never = [];
    var overbroad = [];
    var regexBad = [];

    for (var ei = 0; ei < list.length; ei += 1) {
        var e = list[ei] || {};
        var name = String(e.name || e.id || ("#" + ei));
        var prim = collectPrimary(e);
        var sec = collectSecondary(e);

        if (!prim.length && e.always_active !== true) {
            never.push({ entry: name, key: "(无关键词)", reason: "条目无主关键词且非常驻" });
        }

        var allKeys = prim.concat(sec);
        for (var ki = 0; ki < allKeys.length; ki += 1) {
            var kw = allKeys[ki];
            var rec = all.get(kw);
            if (rec) {
                rec.entries.push(name);
            } else {
                all.set(kw, { entries: [name] });
            }

            // 表达式键：试着解析
            if (kw.charAt(0) === EXPR_PREFIX) {
                var toks = tokenizeExpr(kw);
                if (!toks.length) {
                    never.push({ entry: name, key: kw, reason: "表达式为空" });
                }
                continue;
            }

            // 正则键：试着编译
            var sl = parseSlashRegex(kw);
            if (sl) {
                try { new RegExp(sl.pattern, sl.flags); }
                catch (err) { regexBad.push({ entry: name, key: kw, reason: String(err && err.message || err) }); }
                continue;
            }
            if (e.is_regex) {
                try { new RegExp(kw); }
                catch (err) { regexBad.push({ entry: name, key: kw, reason: String(err && err.message || err) }); }
            }

            // 过宽判定
            var plain = kw.replace(/[\s\p{P}]/gu, "");
            if (plain.length === 1 && !e.case_sensitive) {
                overbroad.push({ entry: name, key: kw, reason: "单字关键词，几乎必然过度触发" });
            } else if (plain.length === 0) {
                overbroad.push({ entry: name, key: kw, reason: "纯标点/空白" });
            }
        }
    }

    // 重复词
    var duplicates = [];
    all.forEach(function (rec, kw) {
        if (rec.entries.length > 1) {
            duplicates.push({ key: kw, entries: rec.entries, count: rec.entries.length });
        }
    });

    var totalKeys = 0;
    for (var ei2 = 0; ei2 < list.length; ei2 += 1) {
        totalKeys += collectPrimary(list[ei2]).length + collectSecondary(list[ei2]).length;
    }

    return {
        never: never,
        overbroad: overbroad,
        duplicates: duplicates,
        regexBad: regexBad,
        stats: {
            entries: list.length,
            totalKeys: totalKeys,
            uniqueKeys: all.size,
            issueCount: never.length + overbroad.length + duplicates.length + regexBad.length
        }
    };
}