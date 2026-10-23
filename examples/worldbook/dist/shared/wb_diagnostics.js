"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDiagnostics = runDiagnostics;
exports.diagnoseOneEntry = diagnoseOneEntry;
exports.SEVERITY = SEVERITY;
// 世界书诊断引擎 v3
// 借鉴 Coneja-Chibi/TunnelVision (AGPL) 的 diagnostics 思路，重写为 Operit ToolPkg 可用的纯函数实现。
//
// 20 项检查，分三级：
//   error    —— 导致功能不工作的
//   warning  —— 可能导致行为异常的
//   info     —— 优化建议
//
// 设计：不读文件、不依赖宿主，输入是「条目数组 + 可选上下文」，输出是结构化报告。
//       UI 层拿报告渲染，可点击跳转到对应条目。

var wb_match_1 = require("./wb_match.js");

var SEVERITY = { ERROR: "error", WARNING: "warning", INFO: "info" };

function issue(sev, code, title, detail, ref) {
    return {
        severity: sev,
        code: code,
        title: title,
        detail: detail || "",
        entryId: (ref && ref.id) || "",
        entryName: (ref && (ref.name || ref.id)) || "",
        key: (ref && ref.key) || ""
    };
}

/** 单条诊断：返回该条目的问题列表 */
function diagnoseOneEntry(entry) {
    var out = [];
    var e = entry || {};
    var name = String(e.name || e.id || "(未命名)");

    // ① 无名称
    if (!String(e.name || "").trim()) {
        out.push(issue(SEVERITY.WARNING, "NO_NAME", "条目没有名称", "名称为空，列表里难以辨认。建议补上名称。", e));
    }

    // ② 无内容
    if (!String(e.content || "").trim()) {
        out.push(issue(SEVERITY.ERROR, "NO_CONTENT", "条目没有内容", "注入内容为空，激活了也不会有任何效果。", e));
    }

    var prim = wb_match_1.collectPrimary(e);
    var sec = wb_match_1.collectSecondary(e);
    var always = e.always_active === true;

    // ③ 无关键词且非常驻
    if (!prim.length && !always) {
        out.push(issue(SEVERITY.ERROR, "NO_KEYS", "条目永远不会被激活", "没有主关键词，也不是常驻条目，永远触发不了。", e));
    }

    // ④ 常驻但有关键词（冗余）
    if (always && prim.length) {
        out.push(issue(SEVERITY.INFO, "ALWAYS_WITH_KEYS", "常驻条目仍配置了关键词", "常驻会无视关键词直接注入，" + prim.length + " 个关键词是多余的。", e));
    }

    // ⑤ 单字关键词
    for (var i = 0; i < prim.length; i += 1) {
        var kw = prim[i];
        if (kw.charAt(0) === "?") continue;
        if (wb_match_1.parseSlashRegex(kw)) continue;
        var plain = kw.replace(/[\s\p{P}]/gu, "");
        if (plain.length === 1) {
            out.push(issue(SEVERITY.WARNING, "SINGLE_CHAR_KEY", "单字关键词极易误触发",
                "「" + kw + "」只有一个字，几乎在任何文本里都能命中。建议加长或改用表达式键。", { id: e.id, name: name, key: kw }));
        } else if (plain.length === 0) {
            out.push(issue(SEVERITY.ERROR, "EMPTY_KEY", "关键词为空", "「" + kw + "」去掉标点和空白后没有内容。", { id: e.id, name: name, key: kw }));
        }
    }

    // ⑥ 非法正则
    if (e.is_regex) {
        for (var j = 0; j < prim.length; j += 1) {
            try { new RegExp(prim[j]); }
            catch (err) {
                out.push(issue(SEVERITY.ERROR, "BAD_REGEX", "正则表达式无法编译",
                    "「" + prim[j] + "」：" + String(err && err.message || err), { id: e.id, name: name, key: prim[j] }));
            }
        }
    }
    // /.../flags 形式
    for (var k = 0; k < prim.length; k += 1) {
        var sl = wb_match_1.parseSlashRegex(prim[k]);
        if (sl) {
            try { new RegExp(sl.pattern, sl.flags); }
            catch (err2) {
                out.push(issue(SEVERITY.ERROR, "BAD_REGEX", "/.../ 正则无法编译",
                    "「" + prim[k] + "」：" + String(err2 && err2.message || err2), { id: e.id, name: name, key: prim[k] }));
            }
        }
    }

    // ⑦ 空表达式
    for (var m = 0; m < prim.length; m += 1) {
        if (prim[m].charAt(0) === "?") {
            var toks = wb_match_1.tokenizeExpr(prim[m]);
            if (!toks.length) {
                out.push(issue(SEVERITY.ERROR, "EMPTY_EXPR", "表达式为空", "「" + prim[m] + "」没有有效内容。", { id: e.id, name: name, key: prim[m] }));
            } else {
                // ⑧ 表达式括号不配对
                var depth = 0, bad = false;
                for (var t = 0; t < toks.length; t += 1) {
                    if (toks[t].t === "paren" && toks[t].v === "(") depth += 1;
                    if (toks[t].t === "paren" && toks[t].v === ")") { depth -= 1; if (depth < 0) bad = true; }
                }
                if (depth !== 0 || bad) {
                    out.push(issue(SEVERITY.ERROR, "UNBALANCED_PAREN", "表达式括号不配对",
                        "「" + prim[m] + "」括号数量不匹配，求值会失败。", { id: e.id, name: name, key: prim[m] }));
                }
            }
        }
    }

    // ⑨ 概率为 0
    var prob = e.probability;
    if (prob != null && Number(prob) === 0) {
        out.push(issue(SEVERITY.WARNING, "ZERO_PROBABILITY", "触发概率为 0", "永远触发不了。若想禁用请用 enabled=false。", e));
    }
    // ⑩ 概率越界
    if (prob != null && (Number(prob) < 0 || Number(prob) > 100)) {
        out.push(issue(SEVERITY.WARNING, "PROBABILITY_RANGE", "触发概率超出 0-100", "当前值 " + prob + "，会被夹到边界。", e));
    }

    // ⑪ 分组但无权重
    var groups = e.inclusionGroups || e.inclusion_groups;
    if (groups && !e.groupWeight && !e.group_weight) {
        out.push(issue(SEVERITY.INFO, "GROUP_NO_WEIGHT", "配置了分组但没有权重", "同组竞争时会使用默认权重 100。", e));
    }

    // ⑫ 位置为 at_depth 但深度为 0
    var pos = e.position || e.inject_position;
    var depth = e.depth;
    if (pos === "at_depth" && (!depth || Number(depth) <= 0)) {
        out.push(issue(SEVERITY.WARNING, "DEPTH_ZERO", "位置是深度插入但深度为 0", "深度 0 等同于插入到最前，可能不是预期行为。", e));
    }

    // ⑬ 负数时序
    if (Number(e.sticky) < 0) out.push(issue(SEVERITY.WARNING, "NEGATIVE_STICKY", "粘性为负数", "会被当作 0。", e));
    if (Number(e.cooldown) < 0) out.push(issue(SEVERITY.WARNING, "NEGATIVE_COOLDOWN", "冷却为负数", "会被当作 0。", e));
    if (Number(e.delay) < 0) out.push(issue(SEVERITY.WARNING, "NEGATIVE_DELAY", "延迟为负数", "会被当作 0。", e));

    // ⑭ 递归双开（矛盾）
    if (e.excludeRecursion === true && e.preventRecursion === true) {
        out.push(issue(SEVERITY.INFO, "RECURSION_BOTH", "同时开启两种递归控制",
            "excludeRecursion 让内容不参与扫描，preventRecursion 让条目不被触发。同时开启通常只需要一个。", e));
    }

    // ⑮ 内容过长
    var clen = String(e.content || "").length;
    if (clen > 8000) {
        out.push(issue(SEVERITY.INFO, "CONTENT_LONG", "内容超过 8000 字",
            "当前 " + clen + " 字，会显著占用上下文预算。建议拆分或精简。", e));
    }

    // ⑯ 次要关键词但无主关键词
    if (!prim.length && sec.length && !always) {
        out.push(issue(SEVERITY.ERROR, "SECONDARY_WITHOUT_PRIMARY", "有次要关键词但没有主关键词",
            "次要词只在主词命中后才检查，主词为空时条目永远不会激活。", e));
    }

    return out;
}

/**
 * 全量诊断。
 *
 * @param entries  条目数组
 * @param opts     { groups, characterCards, tokenBudget }
 * @returns        结构化报告
 */
function runDiagnostics(entries, opts) {
    var list = Array.isArray(entries) ? entries : [];
    var options = opts || {};
    var issues = [];

    // ---- 逐条 ----
    var idMap = new Map();
    for (var i = 0; i < list.length; i += 1) {
        var e = list[i] || {};
        var one = diagnoseOneEntry(e);
        for (var j = 0; j < one.length; j += 1) issues.push(one[j]);

        // ⑰ 重复 ID
        var id = String(e.id || "");
        if (id) {
            if (idMap.has(id)) {
                issues.push(issue(SEVERITY.ERROR, "DUPLICATE_ID", "条目 ID 重复",
                    "ID「" + id + "」被多条使用，会导致读写错乱。", e));
            } else {
                idMap.set(id, e);
            }
        }
    }

    // ---- 跨条目 ----
    var keyOwners = new Map();
    for (var a = 0; a < list.length; a += 1) {
        var ea = list[a] || {};
        var keys = wb_match_1.collectPrimary(ea).concat(wb_match_1.collectSecondary(ea));
        for (var b = 0; b < keys.length; b += 1) {
            var kw = keys[b];
            if (!kw) continue;
            if (!keyOwners.has(kw)) keyOwners.set(kw, []);
            keyOwners.get(kw).push(ea);
        }
    }

    // ⑱ 跨条目重复关键词
    keyOwners.forEach(function (owners, kw) {
        if (owners.length > 1) {
            var names = [];
            for (var n = 0; n < owners.length; n += 1) {
                names.push(String(owners[n].name || owners[n].id || "?"));
            }
            issues.push(issue(SEVERITY.WARNING, "SHARED_KEY", "关键词被多条共用",
                "「" + kw + "」同时属于：" + names.join("、") + "。激活时会一起触发，确认是否预期。",
                { id: owners[0].id, name: names[0], key: kw }));
        }
    });

    // ⑲ 近似重复条目（名称高度相似）
    for (var x = 0; x < list.length; x += 1) {
        for (var y = x + 1; y < list.length; y += 1) {
            var n1 = String((list[x] && list[x].name) || "");
            var n2 = String((list[y] && list[y].name) || "");
            if (!n1 || !n2) continue;
            if (n1 === n2) {
                issues.push(issue(SEVERITY.WARNING, "DUPLICATE_NAME", "条目名称完全相同",
                    "「" + n1 + "」出现多次，容易混淆。", list[y]));
            } else if (n1.length > 2 && n2.length > 2) {
                // 一个包含另一个
                if (n1.indexOf(n2) >= 0 || n2.indexOf(n1) >= 0) {
                    issues.push(issue(SEVERITY.INFO, "SIMILAR_NAME", "条目名称高度相似",
                        "「" + n1 + "」与「" + n2 + "」可能重复。", list[y]));
                }
            }
        }
    }

    // ⑳ 空世界书
    if (!list.length) {
        issues.push(issue(SEVERITY.INFO, "EMPTY_BOOK", "世界书为空", "还没有任何条目。"));
    }

    // 分组引用完整性
    var g = options.groups;
    if (Array.isArray(g) && g.length) {
        var groupIds = new Set();
        for (var gi = 0; gi < g.length; gi += 1) {
            if (g[gi] && g[gi].id) groupIds.add(String(g[gi].id));
        }
        for (var li = 0; li < list.length; li += 1) {
            var eg = list[li] || {};
            var gid = eg.group_id || eg.groupId;
            if (gid && !groupIds.has(String(gid))) {
                issues.push(issue(SEVERITY.WARNING, "DANGLING_GROUP", "条目引用了不存在的分组",
                    "分组 ID「" + gid + "」不存在（可能被删了）。", eg));
            }
        }
    }

    // ---- 汇总 ----
    var bySeverity = { error: 0, warning: 0, info: 0 };
    for (var s = 0; s < issues.length; s += 1) {
        var sev = issues[s].severity;
        if (bySeverity[sev] == null) bySeverity[sev] = 0;
        bySeverity[sev] += 1;
    }

    return {
        ok: bySeverity.error === 0,
        issues: issues,
        summary: {
            entries: list.length,
            total: issues.length,
            error: bySeverity.error,
            warning: bySeverity.warning,
            info: bySeverity.info
        }
    };
}