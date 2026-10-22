"use strict";
Object.defineProperty(exports, ":esModule", { value: true });
exports.V2_FIELDS = exports.V2_DEFAULTS = void 0;
exports.normalizeV2Entry = normalizeV2Entry;
exports.isV2Field = isV2Field;
exports.pickV2Fields = pickV2Fields;
exports.stToV2 = stToV2;
exports.v2ToSt = v2ToSt;
exports.migrateEntry = migrateEntry;
exports.diffV2 = diffV2;
// 世界书 v2 · 字段扩展与迁移
//
// 职责：只做「字段层」的事，不碰存储与注入。
//   - 定义 v2 新字段与默认值
//   - 从任意输入中提取/补全 v2 字段
//   - SillyTavern 双向映射（导入/导出）
//   - 旧数据迁移（v1 → v2，纯增量，不删旧字段）
//
// 设计原则：
//   1. 所有 v2 字段都可缺失。缺失 = 用默认值 = 行为等同 v1。
//   2. 迁移只增不减：旧字段原样保留，新字段补上默认值。
//   3. 不引入任何运行时依赖（纯数据处理）。
/** 所有 v2 新字段的默认值。null 表示"未设置"。 */
exports.V2_DEFAULTS = {
    // ---- 匹配 ----
    keyLogic: "and_any", // and_any | and_all | not_any | not_all
    secondaryLogic: "and_any", // 同上，作用于 secondary keys
    matchWholeWords: false,
    // ---- 概率 ----
    probability: 100, // 0-100，100 = 必定
    // ---- 分组 ----
    inclusionGroups: "", // 逗号分隔的组名
    groupWeight: 100,
    prioritizeInclusion: false,
    // ---- 时效 ----
    sticky: 0,
    cooldown: 0,
    delay: 0,
    // ---- 递归 ----
    excludeRecursion: false, // 内容不参与递归扫描
    preventRecursion: false, // 本条目不被递归触发
    // ---- 位置 ----
    position: "append", // prepend | append | at_depth
    depth: 0,
    // ---- 排序 ----
    order: 100, // 越小越优先
    // ---- 角色过滤 ----
    characterFilter: null, // { type, names, tags }
    // ---- 触发类型过滤 ----
    triggers: [], // ["chat","continue","impersonate",...]
    // ---- 自动化 ----
    automationId: "",
};
/** 所有 v2 新字段名（用于提取与 diff）。 */
exports.V2_FIELDS = Object.keys(exports.V2_DEFAULTS);
/** 判断某个 key 是否是 v2 字段。 */
function isV2Field(key) {
    return Object.prototype.hasOwnProperty.call(exports.V2_DEFAULTS, key);
}
/** 把 inclusionGroups 归一成逗号分隔字符串。 */
function normGroups(v) {
    if (v == null)
        return "";
    if (Array.isArray(v)) {
        var out = [];
        for (var i = 0; i < v.length; i += 1) {
            var s = String(v[i] == null ? "" : v[i]).trim();
            if (s && out.indexOf(s) < 0)
                out.push(s);
        }
        return out.join(",");
    }
    var parts = String(v).split(",");
    var res = [];
    for (var j = 0; j < parts.length; j += 1) {
        var t = String(parts[j] || "").trim();
        if (t && res.indexOf(t) < 0)
            res.push(t);
    }
    return res.join(",");
}
/** 把 triggers 归一成字符串数组。 */
function normTriggers(v) {
    if (v == null)
        return [];
    var arr = Array.isArray(v) ? v : String(v).split(",");
    var out = [];
    for (var i = 0; i < arr.length; i += 1) {
        var s = String(arr[i] == null ? "" : arr[i]).trim();
        if (s && out.indexOf(s) < 0)
            out.push(s);
    }
    return out;
}
/** 把 characterFilter 归一。 */
function normCharFilter(v) {
    if (v == null)
        return null;
    if (typeof v !== "object")
        return null;
    var type = String(v.type || "include");
    if (type !== "include" && type !== "exclude")
        type = "include";
    var names = [];
    if (Array.isArray(v.names)) {
        for (var i = 0; i < v.names.length; i += 1) {
            var s = String(v.names[i] == null ? "" : v.names[i]).trim();
            if (s)
                names.push(s);
        }
    }
    var tags = [];
    if (Array.isArray(v.tags)) {
        for (var j = 0; j < v.tags.length; j += 1) {
            var t = String(v.tags[j] == null ? "" : v.tags[j]).trim();
            if (t)
                tags.push(t);
        }
    }
    if (names.length === 0 && tags.length === 0)
        return null;
    return { type: type, names: names, tags: tags };
}
/** 数值字段的取值范围约束。 */
function clampInt(v, min, max, dft) {
    var n = Number(v);
    if (!isFinite(n))
        return dft;
    n = Math.round(n);
    if (n < min)
        return min;
    if (n > max)
        return max;
    return n;
}
function normEnum(v, allowed, dft) {
    var s = String(v == null ? "" : v).trim();
    for (var i = 0; i < allowed.length; i += 1) {
        if (allowed[i] === s)
            return s;
    }
    return dft;
}
function normBool(v, dft) {
    if (v === true)
        return true;
    if (v === false)
        return false;
    if (typeof v === "string") {
        var s = v.trim().toLowerCase();
        if (s === "true" || s === "1" || s === "on" || s === "yes")
            return true;
        if (s === "false" || s === "0" || s === "off" || s === "no")
            return false;
    }
    if (typeof v === "number")
        return v !== 0;
    return dft;
}
/**
 * 从任意输入中提取并校准 v2 字段。
 *
 * @param src 任意对象（可能是 v1 条目、ST 条目、或已含 v2 字段的条目）
 * @returns 只含 v2 字段的对象（全部有值，缺失用默认）
 */
function normalizeV2Entry(src) {
    var s = src || {};
    // 兼容蛇形/驼峰双写法
    var pick = function () {
        var keys = [];
        for (var _i = 0; _i < arguments.length; _i += 1)
            keys.push(arguments[_i]);
        for (var i = 0; i < keys.length; i += 1) {
            if (s[keys[i]] !== undefined && s[keys[i]] !== null)
                return s[keys[i]];
        }
        return undefined;
    };
    // 位置：v1 用 inject_position，v2 用 position
    var rawPos = pick("position", "inject_position");
    var pos = normEnum(rawPos, ["prepend", "append", "at_depth"], "append");
    // depth：v1 用 insertion_depth，v2 用 depth
    var rawDepth = pick("depth", "insertion_depth");
    return {
        keyLogic: normEnum(pick("keyLogic", "key_logic"), ["and_any", "and_all", "not_any", "not_all"], "and_any"),
        secondaryLogic: normEnum(pick("secondaryLogic", "secondary_logic"), ["and_any", "and_all", "not_any", "not_all"], "and_any"),
        matchWholeWords: normBool(pick("matchWholeWords", "match_whole_words"), false),
        probability: clampInt(pick("probability"), 0, 100, 100),
        inclusionGroups: normGroups(pick("inclusionGroups", "inclusion_groups")),
        groupWeight: clampInt(pick("groupWeight", "group_weight"), 1, 100000, 100),
        prioritizeInclusion: normBool(pick("prioritizeInclusion", "prioritize_inclusion"), false),
        sticky: clampInt(pick("sticky"), 0, 10000, 0),
        cooldown: clampInt(pick("cooldown"), 0, 10000, 0),
        delay: clampInt(pick("delay"), 0, 10000, 0),
        excludeRecursion: normBool(pick("excludeRecursion", "exclude_recursion"), false),
        preventRecursion: normBool(pick("preventRecursion", "prevent_recursion"), false),
        position: pos,
        depth: clampInt(rawDepth, 0, 10000, 0),
        order: clampInt(pick("order"), -100000, 100000, 100),
        characterFilter: normCharFilter(pick("characterFilter", "character_filter")),
        triggers: normTriggers(pick("triggers")),
        automationId: String(pick("automationId", "automation_id") || ""),
    };
}
/** 只挑出 v2 字段（用于 patch 更新，不碰 v1 字段）。 */
function pickV2Fields(src) {
    var out = {};
    if (!src || typeof src !== "object")
        return out;
    for (var i = 0; i < exports.V2_FIELDS.length; i += 1) {
        var k = exports.V2_FIELDS[i];
        if (Object.prototype.hasOwnProperty.call(src, k) && src[k] !== undefined) {
            out[k] = src[k];
        }
    }
    return out;
}
// ================= SillyTavern 双向映射 =================
/** ST → v2。ST 的 entries 对象或单条 entry 都支持。 */
function stToV2(st) {
    var s = st || {};
    var pick = function () {
        var keys = [];
        for (var _i = 0; _i < arguments.length; _i += 1)
            keys.push(arguments[_i]);
        for (var i = 0; i < keys.length; i += 1) {
            if (s[keys[i]] !== undefined && s[keys[i]] !== null)
                return s[keys[i]];
        }
        return undefined;
    };
    // ST position: 0=before_char, 1=after_char, 2=before_an, 3=after_an, 4=at_depth
    var rawPos = pick("position");
    var pos = "append";
    var depth = clampInt(pick("depth"), 0, 10000, 0);
    if (rawPos === 4 || rawPos === "at_depth") {
        pos = "at_depth";
    }
    else if (rawPos === 0 || rawPos === "before_char") {
        pos = "prepend";
    }
    else {
        pos = "append";
    }
    // ST role: 0=system,1=user,2=assistant
    var rawRole = pick("role");
    var role = "system";
    if (rawRole === 1 || rawRole === "user")
        role = "user";
    else if (rawRole === 2 || rawRole === "assistant")
        role = "assistant";
    var out = normalizeV2Entry({
        order: pick("order"),
        probability: pick("probability"),
        inclusionGroups: pick("group"),
        groupWeight: pick("group_weight", "groupWeight"),
        prioritizeInclusion: pick("group_override", "prioritizeInclusion"),
        sticky: pick("sticky"),
        cooldown: pick("cooldown"),
        delay: pick("delay"),
        excludeRecursion: pick("exclude_recursion", "excludeRecursion"),
        preventRecursion: pick("prevent_recursion", "preventRecursion"),
        matchWholeWords: pick("match_whole_words", "matchWholeWords"),
        position: pos,
        depth: depth,
        automationId: pick("automation_id", "automationId"),
        triggers: pick("triggers"),
    });
    // ST 的 selectiveLogic: 0=AND ANY,1=NOT ALL,2=NOT ANY,3=AND ALL
    var sl = pick("selectiveLogic", "selective_logic");
    if (sl === 0)
        out.keyLogic = "and_any";
    else if (sl === 1)
        out.keyLogic = "not_all";
    else if (sl === 2)
        out.keyLogic = "not_any";
    else if (sl === 3)
        out.keyLogic = "and_all";
    // ST 的 role 存到 inject_target（v1 字段，不算 v2）
    out._stRole = role;
    return out;
}
/** v2 → ST 字段片段（供导出用）。 */
function v2ToSt(entry) {
    var v = normalizeV2Entry(entry);
    var pos = 1; // after_char
    if (v.position === "prepend")
        pos = 0;
    else if (v.position === "at_depth")
        pos = 4;
    var sl = 0;
    if (v.keyLogic === "not_all")
        sl = 1;
    else if (v.keyLogic === "not_any")
        sl = 2;
    else if (v.keyLogic === "and_all")
        sl = 3;
    return {
        order: v.order,
        position: pos,
        depth: v.depth,
        probability: v.probability,
        group: v.inclusionGroups,
        group_weight: v.groupWeight,
        group_override: v.prioritizeInclusion,
        sticky: v.sticky,
        cooldown: v.cooldown,
        delay: v.delay,
        exclude_recursion: v.excludeRecursion,
        prevent_recursion: v.preventRecursion,
        match_whole_words: v.matchWholeWords,
        selectiveLogic: sl,
        automation_id: v.automationId,
        triggers: v.triggers,
    };
}
/**
 * 迁移：把 v1 条目补齐 v2 字段。
 *
 * 只增不减：v1 字段原样保留，只补缺失的 v2 字段。
 * 幂等：已迁移过的条目再跑一遍结果不变。
 */
function migrateEntry(entry) {
    var out = {};
    for (var k in entry) {
        if (Object.prototype.hasOwnProperty.call(entry, k))
            out[k] = entry[k];
    }
    var v2 = normalizeV2Entry(entry);
    // 只有当 v1 里没有对应 v2 字段时才补，避免覆盖已有 v2 值
    for (var i = 0; i < exports.V2_FIELDS.length; i += 1) {
        var f = exports.V2_FIELDS[i];
        if (out[f] === undefined) {
            out[f] = v2[f];
        }
    }
    // v1 的 priority → v2 的 order（反向映射，仅在 order 未设时）
    if (entry.order === undefined && entry.priority !== undefined) {
        var p = Number(entry.priority);
        if (isFinite(p)) {
            // v1: priority 越大越优先；v2: order 越小越优先
            out.order = 100 - p;
        }
    }
    return out;
}
/** 对比两条条目，返回 v2 字段的差异（用于 UI 高亮与变更检测）。 */
function diffV2(a, b) {
    var va = normalizeV2Entry(a);
    var vb = normalizeV2Entry(b);
    var out = [];
    for (var i = 0; i < exports.V2_FIELDS.length; i += 1) {
        var f = exports.V2_FIELDS[i];
        var x = JSON.stringify(va[f]);
        var y = JSON.stringify(vb[f]);
        if (x !== y)
            out.push({ field: f, from: va[f], to: vb[f] });
    }
    return out;
}