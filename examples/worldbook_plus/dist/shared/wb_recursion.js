"use strict";
Object.defineProperty(exports, "__esModule", { version: true });
exports.scanRecursive = scanRecursive;
// 世界书 v2 · 递归扫描
//
// 语义对齐 SillyTavern：
//   被激活条目的「内容」也会成为后续条目的扫描文本，
//   从而触发链式激活（A 命中 → A 的内容里含 B 的关键词 → B 也命中）。
//
// 关键约束（与 ST 一致）：
//   1. excludeRecursion    ：该条目不被递归扫描看到（它的内容不参与后续触发），
//                            但它自己可以被正常触发
//   2. preventRecursion    ：该条目本身不被递归触发（只能由原始输入触发），
//                            但它的内容仍可触发别人
//   3. 深度上限：默认 5 层，防无限递归
//   4. 防环：已激活的条目不再重复扫描
//   5. 递归阶段不再对已激活条目做概率掷骰（避免同一轮概率反复变化）
var wb_match_1 = require("./wb_match.js");
/** 取条目的内容文本（用于递归扫描）。 */
function contentOf(entry) {
    var c = entry && entry.content != null ? String(entry.content) : "";
    return c;
}
/**
 * 递归扫描主循环。
 *
 * @param allEntries      所有候选条目（已通过 enabled / character / 时效 过滤）
 * @param initialHits     第一轮（原始输入）命中的条目数组
 * @param initialText     原始扫描文本
 * @param opts            { maxDepth, onScan }
 * @returns { hits, depthReached, trace }
 */
function scanRecursive(allEntries, initialHits, initialText, opts) {
    var o = opts || {};
    var maxDepth = Math.max(1, Number(o.maxDepth) || 5);
    var onScan = typeof o.onScan === "function" ? o.onScan : null;
    // 已激活集合
    var active = [];
    var activeIds = {};
    for (var i = 0; i < initialHits.length; i += 1) {
        var e0 = initialHits[i];
        var id0 = String(e0.id || "");
        if (activeIds[id0])
            continue;
        activeIds[id0] = true;
        active.push(e0);
    }
    var trace = [];
    var depth = 0;
    var frontier = initialHits.slice();
    while (depth < maxDepth && frontier.length > 0) {
        // 本轮递归的扫描文本 = 上一轮新激活条目的内容拼接
        var scanParts = [];
        for (var f = 0; f < frontier.length; f += 1) {
            var fe = frontier[f];
            // excludeRecursion：内容不参与递归扫描
            if (fe.excludeRecursion === true || fe.exclude_recursion === true)
                continue;
            var c = contentOf(fe);
            if (c)
                scanParts.push(c);
        }
        if (scanParts.length === 0)
            break;
        var scanText = scanParts.join("\n");
        var nextFrontier = [];
        for (var a = 0; a < allEntries.length; a += 1) {
            var cand = allEntries[a];
            var cid = String(cand.id || "");
            // 已激活：跳过
            if (activeIds[cid])
                continue;
            // preventRecursion：不允许被递归触发
            if (cand.preventRecursion === true || cand.prevent_recursion === true)
                continue;
            // 无关键词且非常驻：无法递归命中
            var prim = wb_match_1.collectPrimary(cand);
            if (prim.length === 0)
                continue;
            if (wb_match_1.matchesEntry(cand, scanText)) {
                activeIds[cid] = true;
                active.push(cand);
                nextFrontier.push(cand);
                trace.push({ depth: depth + 1, id: cid, name: String(cand.name || "") });
                if (onScan)
                    onScan(cand, depth + 1);
            }
        }
        frontier = nextFrontier;
        depth += 1;
    }
    return { hits: active, depthReached: depth, trace: trace };
}