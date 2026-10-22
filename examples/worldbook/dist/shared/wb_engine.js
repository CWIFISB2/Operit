"use strict";
Object.defineProperty(exports, "__esModule", { version: true });
exports.runPipeline = runPipeline;
exports.buildInjection = buildInjection;
exports.splitByPosition = splitByPosition;
exports.normalizeInjectPosition = normalizeInjectPosition;
exports.toPromptTurnKind = toPromptTurnKind;
exports.insertAtDepth = insertAtDepth;
// 世界书 v2 · 引擎总流水线
//
// 完整流程（顺序与 SillyTavern 对齐）：
//   ① 候选收集：enabled / character 绑定 / 隐藏 / 强制激活
//   ② 扫描文本：raw + processed + scan_depth 条历史用户消息
//   ③ 初次命中：常驻直入 + 关键词匹配
//   ④ 时效检查：delay / cooldown / sticky
//   ⑤ 概率掷骰：probability（滚动一次定生死，常驻不掷）
//   ⑥ 递归扫描：内容触发链式激活
//   ⑦ Inclusion Group 裁决：同组只留一个
//   ⑧ Token 预算裁剪：按 order + minActivations
//   ⑨ 排序输出：order 升序，供按 position/depth 组装
var wb_match_1 = require("./wb_match.js");
var wb_timing_1 = require("./wb_timing.js");
var wb_group_1 = require("./wb_group.js");
var wb_recursion_1 = require("./wb_recursion.js");
var wb_budget_1 = require("./wb_budget.js");
/** 归一化注入位置：v1 三值 + v2 扩展。 */
function normalizeInjectPosition(entry) {
    var p = String(entry.inject_position || entry.position || "append");
    if (p === "prepend" || p === "at_depth")
        return p;
    return "append";
}
/** 条目最终注入到哪个 turn kind。 */
function toPromptTurnKind(entry) {
    var t = String(entry.inject_target || entry.role || "system");
    if (t === "assistant")
        return "ASSISTANT";
    if (t === "user")
        return "USER";
    return "SYSTEM";
}
/** 组装注入块（与 v1 格式完全一致，保证下游解析不变）。 */
function buildInjection(entries) {
    var parts = ["<worldbook>"];
    for (var i = 0; i < entries.length; i += 1) {
        var e = entries[i];
        parts.push("<entry name=\"" + String(e.name || "") + "\">");
        parts.push(String(e.content || ""));
        parts.push("</entry>");
    }
    parts.push("</worldbook>");
    return parts.join("\n");
}
/** 按位置拆成 prepend / append 两组。 */
function splitByPosition(entries) {
    var prependEntries = [];
    var appendEntries = [];
    for (var i = 0; i < entries.length; i += 1) {
        if (normalizeInjectPosition(entries[i]) === "prepend")
            prependEntries.push(entries[i]);
        else
            appendEntries.push(entries[i]);
    }
    return { prependEntries: prependEntries, appendEntries: appendEntries };
}
/** 把条目按 depth 插入历史。 */
function insertAtDepth(history, entries) {
    if (!entries || entries.length === 0)
        return history;
    var grouped = {};
    var order = [];
    for (var i = 0; i < entries.length; i += 1) {
        var entry = entries[i];
        var depth = Math.max(0, Number(entry.insertion_depth != null ? entry.insertion_depth : entry.depth) || 0);
        var kind = toPromptTurnKind(entry);
        var key = kind + ":" + depth;
        if (!grouped[key]) {
            grouped[key] = { depth: depth, kind: kind, entries: [] };
            order.push(key);
        }
        grouped[key].entries.push(entry);
    }
    var nextHistory = history.slice();
    var groups = [];
    for (var j = 0; j < order.length; j += 1)
        groups.push(grouped[order[j]]);
    // 深度大的先插（从后往前），避免下标漂移
    groups.sort(function (a, b) { return b.depth - a.depth; });
    for (var g = 0; g < groups.length; g += 1) {
        var grp = groups[g];
        var idx = Math.max(0, nextHistory.length - grp.depth);
        nextHistory.splice(idx, 0, { kind: grp.kind, content: buildInjection(grp.entries) });
    }
    return nextHistory;
}
/** 是否命中关键词（用于 minActivations / 诊断）。 */
function isKeywordHitEntry(entry) {
    return entry.always_active !== true && !entry._forced && entry._matched === true;
}
/**
 * 运行完整流水线。
 *
 * @param candidates  候选条目（已做 enabled / character / hidden / forced 过滤）
 * @param scanText    第一轮扫描文本
 * @param msgIndex    当前用户消息累计序号
 * @param cfg         { tokenBudget, minActivations, maxRecursionDepth, chance: ()=>number }
 * @returns { entries, diag }
 */
function runPipeline(candidates, scanText, msgIndex, cfg) {
    var c = cfg || {};
    var chance = typeof c.chance === "function" ? c.chance : Math.random;
    var diag = {
        total: candidates.length,
        always: 0,
        keywordHit: 0,
        timingBlocked: 0,
        chanceDropped: 0,
        recursionAdded: 0,
        groupDropped: 0,
        budgetDropped: 0,
        final: 0,
        trace: [],
    };
    // ---------- ③ 初次命中 ----------
    var firstHits = [];
    var hitCounts = {};
    for (var i = 0; i < candidates.length; i += 1) {
        var e = candidates[i];
        var eid = String(e.id || "");
        var isAlways = e.always_active === true || e._forced === true;
        var hit = false;
        var kwHits = 0;
        if (isAlways) {
            hit = true;
            diag.always += 1;
        }
        else {
            // 【关键】先查时效：若处于 sticky 窗口内，无需关键词命中即入选。
            // 这一步必须在关键词匹配之前，否则 sticky 永远不生效
            // （关键词已经不出现了，进不了候选）。
            var preTiming = wb_timing_1.resolveTiming(e, msgIndex);
            if (preTiming.ok && preTiming.sticky) {
                hit = true;
                diag.stickyActive = (diag.stickyActive || 0) + 1;
                diag.trace.push({ id: eid, stage: "sticky", reason: preTiming.reason });
            }
            else {
                var prim = wb_match_1.collectPrimary(e);
                if (prim.length > 0 && scanText) {
                    hit = wb_match_1.matchesEntry(e, scanText);
                    if (hit) {
                        kwHits = wb_match_1.countPrimaryHits(e, scanText);
                        diag.keywordHit += 1;
                        e._matched = true;
                    }
                }
            }
        }
        if (!hit)
            continue;
        hitCounts[eid] = kwHits;
        firstHits.push(e);
    }
    // ---------- ④ 时效检查 ----------
    var afterTiming = [];
    for (var t = 0; t < firstHits.length; t += 1) {
        var te = firstHits[t];
        var isAlwaysE = te.always_active === true || te._forced === true;
        var teId = String(te.id || "");
        var res = wb_timing_1.resolveTiming(te, msgIndex);
        if (!res.ok) {
            diag.timingBlocked += 1;
            diag.trace.push({ id: teId, stage: "timing", reason: res.reason });
            continue;
        }
        // sticky 生效期内：直接放行，且不推进状态（避免续期）
        if (res.sticky) {
            afterTiming.push(te);
            continue;
        }
        // ---------- ⑤ 概率掷骰 ----------
        var prob = Number(te.probability);
        if (!isAlwaysE && isFinite(prob) && prob > 0 && prob < 100) {
            if (chance() * 100 >= prob) {
                diag.chanceDropped += 1;
                diag.trace.push({ id: teId, stage: "chance", reason: "probability:" + prob });
                continue;
            }
        }
        // 真正命中：推进 sticky / cooldown 状态
        // （只有本轮真正被关键词触发才推进，sticky 期内不重复推进）
        if (!isAlwaysE && te._matched === true) {
            wb_timing_1.recordHit(te, msgIndex);
        }
        afterTiming.push(te);
    }
    // ---------- ⑥ 递归扫描 ----------
    var afterRecursion = afterTiming;
    var maxDepth = Number(c.maxRecursionDepth);
    if (!isFinite(maxDepth) || maxDepth < 0)
        maxDepth = 5;
    var nonHits = [];
    for (var n = 0; n < candidates.length; n += 1) {
        var ce = candidates[n];
        var cid = String(ce.id || "");
        var already = false;
        for (var a = 0; a < afterTiming.length; a += 1) {
            if (String(afterTiming[a].id || "") === cid) {
                already = true;
                break;
            }
        }
        if (!already)
            nonHits.push(ce);
    }
    if (maxDepth > 0 && afterTiming.length > 0 && nonHits.length > 0) {
        var rec = wb_recursion_1.scanRecursive(nonHits, afterTiming, scanText, { maxDepth: maxDepth });
        afterRecursion = rec.hits;
        diag.recursionAdded = rec.trace.length;
        for (var r = 0; r < rec.trace.length; r += 1) {
            diag.trace.push({ id: rec.trace[r].id, stage: "recursion", reason: "depth:" + rec.trace[r].depth });
        }
    }
    // ---------- ⑦ Inclusion Group 裁决 ----------
    var grouped = wb_group_1.resolveGroups(afterRecursion, hitCounts, chance);
    diag.groupDropped = grouped.losers.length;
    for (var l = 0; l < grouped.losers.length; l += 1) {
        diag.trace.push({
            id: String(grouped.losers[l].entry.id || ""),
            stage: "group",
            reason: "lost_group:" + grouped.losers[l].group + " winner:" + grouped.losers[l].winnerId,
        });
    }
    // ---------- ⑧ Token 预算 ----------
    var budgetResult = wb_budget_1.applyBudget(grouped.winners, Number(c.tokenBudget) || 0, {
        minActivations: Number(c.minActivations) || 0,
        isKeywordHit: isKeywordHitEntry,
    });
    diag.budgetDropped = budgetResult.dropped.length;
    for (var d = 0; d < budgetResult.dropped.length; d += 1) {
        diag.trace.push({
            id: String(budgetResult.dropped[d].entry.id || ""),
            stage: "budget",
            reason: "cost:" + budgetResult.dropped[d].cost,
        });
    }
    // ---------- ⑨ 排序输出 ----------
    var finalList = budgetResult.kept.slice();
    finalList.sort(function (x, y) {
        var cx = (x.always_active || x._forced) ? 0 : 1;
        var cy = (y.always_active || y._forced) ? 0 : 1;
        if (cx !== cy)
            return cx - cy;
        return wb_budget_1.orderOf(x) - wb_budget_1.orderOf(y);
    });
    diag.final = finalList.length;
    return { entries: finalList, diag: diag };
}