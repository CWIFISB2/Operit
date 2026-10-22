"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveGroups = resolveGroups;
exports.parseGroups = parseGroups;
// 世界书 v2 · Inclusion Group 裁决
//
// 语义对齐 SillyTavern：
//   inclusionGroups：逗号分隔的多个组名。一个条目可同时属于多个组。
//   groupWeight    ：组内权重，默认 100。
//   prioritizeInclusion：按「命中关键词数」确定性排序取最高者；
//                        未开则按权重加权随机。
//
// 裁决规则：
//   同一个组内，最终只允许 1 个条目入选（其余被禁用）。
//   一个条目若同时属于多个组，任一组被淘汰则整条淘汰。
//
// 返回 { winners, losers }，losers 带原因便于诊断。
/** 解析条目所属分组名数组。 */
function parseGroups(entry) {
    var raw = entry.inclusionGroups != null ? entry.inclusionGroups : entry.inclusion_groups;
    if (raw == null)
        return [];
    var list = [];
    if (Array.isArray(raw)) {
        for (var i = 0; i < raw.length; i += 1) {
            var s = String(raw[i] == null ? "" : raw[i]).trim();
            if (s)
                list.push(s);
        }
    }
    else {
        var parts = String(raw).split(",");
        for (var j = 0; j < parts.length; j += 1) {
            var t = String(parts[j] || "").trim();
            if (t)
                list.push(t);
        }
    }
    // 去重
    var out = [];
    for (var k = 0; k < list.length; k += 1) {
        if (out.indexOf(list[k]) < 0)
            out.push(list[k]);
    }
    return out;
}
function weightOf(entry) {
    var w = Number(entry.groupWeight != null ? entry.groupWeight : entry.group_weight);
    if (!isFinite(w) || w <= 0)
        return 100;
    return w;
}
/**
 * 裁决。
 *
 * @param candidates 已通过关键词/时效筛选的条目数组
 * @param hitCounts  Map<entryId, 命中关键词数>，供 prioritizeInclusion 排序
 * @param rand      可注入的随机源（便于测试）
 * @returns { winners, losers }
 */
function resolveGroups(candidates, hitCounts, rand) {
    var random = typeof rand === "function" ? rand : Math.random;
    // 按组归集：groupName -> entry[]
    var buckets = {};
    var entryGroups = {};
    for (var i = 0; i < candidates.length; i += 1) {
        var e = candidates[i];
        var gs = parseGroups(e);
        var id = String(e.id || "");
        entryGroups[id] = gs;
        for (var g = 0; g < gs.length; g += 1) {
            var name = gs[g];
            if (!buckets[name])
                buckets[name] = [];
            buckets[name].push(e);
        }
    }
    // 每组选一个赢家
    var winners = {};
    var groupWinner = {};
    for (var name2 in buckets) {
        if (!Object.prototype.hasOwnProperty.call(buckets, name2))
            continue;
        var list = buckets[name2];
        if (list.length === 0)
            continue;
        if (list.length === 1) {
            groupWinner[name2] = String(list[0].id || "");
            winners[groupWinner[name2]] = true;
            continue;
        }
        // 判断是否有条目声明 prioritizeInclusion
        var anyPrioritize = false;
        for (var p = 0; p < list.length; p += 1) {
            if (list[p].prioritizeInclusion === true || list[p].prioritize_inclusion === true) {
                anyPrioritize = true;
                break;
            }
        }
        var chosen = null;
        if (anyPrioritize) {
            // 确定性：命中关键词数高者优先；相同则 groupWeight 高者；再相同则 order 小者
            var best = null;
            for (var q = 0; q < list.length; q += 1) {
                var cand = list[q];
                var candId = String(cand.id || "");
                var candHits = Number((hitCounts && hitCounts[candId]) || 0);
                var candW = weightOf(cand);
                var candOrder = Number(cand.order != null ? cand.order : (cand.priority != null ? 100 - Number(cand.priority) : 100));
                if (!best) {
                    best = { e: cand, hits: candHits, w: candW, order: candOrder };
                    continue;
                }
                if (candHits > best.hits) {
                    best = { e: cand, hits: candHits, w: candW, order: candOrder };
                }
                else if (candHits === best.hits && candW > best.w) {
                    best = { e: cand, hits: candHits, w: candW, order: candOrder };
                }
                else if (candHits === best.hits && candW === best.w && candOrder < best.order) {
                    best = { e: cand, hits: candHits, w: candW, order: candOrder };
                }
            }
            chosen = best ? best.e : list[0];
        }
        else {
            // 加权随机
            var total = 0;
            for (var r = 0; r < list.length; r += 1)
                total += weightOf(list[r]);
            var roll = random() * total;
            var acc = 0;
            for (var s = 0; s < list.length; s += 1) {
                acc += weightOf(list[s]);
                if (roll < acc) {
                    chosen = list[s];
                    break;
                }
            }
            if (!chosen)
                chosen = list[list.length - 1];
        }
        groupWinner[name2] = String(chosen.id || "");
        winners[groupWinner[name2]] = true;
    }
    // 淘汰：任一组未选中则整条淘汰
    var winList = [];
    var loseList = [];
    for (var i2 = 0; i2 < candidates.length; i2 += 1) {
        var ent = candidates[i2];
        var eid = String(ent.id || "");
        var eg = entryGroups[eid] || [];
        if (eg.length === 0) {
            winList.push(ent);
            continue;
        }
        var lostGroup = null;
        for (var k2 = 0; k2 < eg.length; k2 += 1) {
            var gn = eg[k2];
            if (groupWinner[gn] !== eid) {
                lostGroup = gn;
                break;
            }
        }
        if (lostGroup === null) {
            winList.push(ent);
        }
        else {
            loseList.push({ entry: ent, group: lostGroup, winnerId: groupWinner[lostGroup] });
        }
    }
    return { winners: winList, losers: loseList };
}