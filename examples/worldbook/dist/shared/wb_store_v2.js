"use strict";
Object.defineProperty(exports, ":esModule", { value: true });
// 世界书 v2 · 存储补丁层
//
// 不直接改 wb_data.js（1198 行，改坏风险高），而是包一层：
//   读：原样透传，但把每条 entry 补上 v2 字段（缺失填默认）
//   写：保留原有 v1 校验逻辑，但额外把 v2 字段一起落盘
//
// 这样 v1 的所有工具/UI 都不用改，新字段自动跟着走。
var wb_data_1 = require("./wb_data.js");
var wb_fields_1 = require("./wb_fields.js");
/** 迁移标记文件，避免每次读都做全量迁移。 */
var MIGRATE_FLAG = "worldbook_v2_migrated.json";
function flagPath() {
    return String(wb_data_1.NATIVE_DIR || "") + "/" + MIGRATE_FLAG;
}
/**
 * 读取条目并对每条补齐 v2 字段。
 *
 * 这是所有读取路径的统一入口。v1 的 readEntries 返回什么，
 * 这里就返回什么，只是每条多了 v2 字段。
 */
async function readEntriesV2() {
    var raw = [];
    try {
        raw = await wb_data_1.readEntries();
    }
    catch (_e) {
        return [];
    }
    if (!Array.isArray(raw))
        return [];
    var out = [];
    for (var i = 0; i < raw.length; i += 1) {
        var e = raw[i];
        if (!e || typeof e !== "object")
            continue;
        out.push(wb_fields_1.migrateEntry(e));
    }
    return out;
}
/**
 * 写入条目。
 *
 * 先过一遍 v1 的 safeWriteEntries（保留其校验与备份），
 * 再确保 v2 字段没被丢。
 */
async function writeEntriesV2(entries) {
    var prepared = [];
    for (var i = 0; i < entries.length; i += 1) {
        var e = entries[i];
        if (!e || typeof e !== "object")
            continue;
        prepared.push(wb_fields_1.migrateEntry(e));
    }
    try {
        await wb_data_1.safeWriteEntries(prepared);
        return { ok: true, count: prepared.length };
    }
    catch (err) {
        return { ok: false, count: 0, error: String((err && err.message) || err) };
    }
}
/**
 * 部分更新：只改指定的 v2 字段，其余原样保留。
 *
 * @param entryId 条目 id
 * @param patch   要改的字段（只认 v2 字段，v1 字段被忽略）
 */
async function patchEntryV2(entryId, patch) {
    var all = [];
    try {
        all = await wb_data_1.readEntries();
    }
    catch (_e) {
        return { ok: false, error: "read failed" };
    }
    if (!Array.isArray(all))
        return { ok: false, error: "entries not array" };
    var id = String(entryId || "");
    var found = -1;
    for (var i = 0; i < all.length; i += 1) {
        if (String((all[i] && all[i].id) || "") === id) {
            found = i;
            break;
        }
    }
    if (found < 0)
        return { ok: false, error: "entry not found: " + id };
    var v2patch = wb_fields_1.pickV2Fields(patch);
    var merged = {};
    var old = all[found];
    for (var k in old) {
        if (Object.prototype.hasOwnProperty.call(old, k))
            merged[k] = old[k];
    }
    for (var p in v2patch) {
        if (Object.prototype.hasOwnProperty.call(v2patch, p))
            merged[p] = v2patch[p];
    }
    // 归一（夹取范围、校验枚举）
    var normalized = wb_fields_1.normalizeV2Entry(merged);
    for (var f in normalized) {
        if (Object.prototype.hasOwnProperty.call(normalized, f))
            merged[f] = normalized[f];
    }
    all[found] = merged;
    var res = await writeEntriesV2(all);
    return res.ok
        ? { ok: true, entry: merged, changed: Object.keys(v2patch) }
        : { ok: false, error: res.error };
}
/**
 * 批量设置 v2 字段（同值批量改）。
 *
 * @param ids   目标条目 id 数组
 * @param patch 要改的 v2 字段
 */
async function patchManyV2(ids, patch) {
    var all = [];
    try {
        all = await wb_data_1.readEntries();
    }
    catch (_e) {
        return { ok: false, error: "read failed", updated: 0 };
    }
    if (!Array.isArray(all))
        return { ok: false, error: "entries not array", updated: 0 };
    var idSet = {};
    for (var i = 0; i < ids.length; i += 1)
        idSet[String(ids[i])] = true;
    var v2patch = wb_fields_1.pickV2Fields(patch);
    var updated = 0;
    for (var j = 0; j < all.length; j += 1) {
        var e = all[j];
        if (!e || typeof e !== "object")
            continue;
        if (idSet[String(e.id || "")] !== true)
            continue;
        for (var p in v2patch) {
            if (Object.prototype.hasOwnProperty.call(v2patch, p))
                e[p] = v2patch[p];
        }
        var norm = wb_fields_1.normalizeV2Entry(e);
        for (var f in norm) {
            if (Object.prototype.hasOwnProperty.call(norm, f))
                e[f] = norm[f];
        }
        updated += 1;
    }
    if (updated === 0)
        return { ok: true, updated: 0 };
    var res = await writeEntriesV2(all);
    return { ok: res.ok, updated: updated, error: res.error };
}
/**
 * 导出为 SillyTavern 格式（带 v2 字段）。
 *
 * 替代原 toSillyTavernLorebook，多写 v2 字段，其余格式不变。
 */
function toSillyTavernV2(entries, name) {
    var out = {};
    var list = Array.isArray(entries) ? entries : [];
    for (var i = 0; i < list.length; i += 1) {
        var e = list[i] || {};
        var st = wb_fields_1.v2ToSt(e);
        // v1 字段（保持原映射）
        var base = {
            uid: i,
            key: Array.isArray(e.keywords) ? e.keywords : [],
            keysecondary: Array.isArray(e.secondary_keywords) ? e.secondary_keywords : [],
            comment: String(e.name || ""),
            content: String(e.content || ""),
            constant: e.always_active === true,
            selective: Array.isArray(e.secondary_keywords) && e.secondary_keywords.length > 0,
            disable: e.enabled === false,
            useRegex: e.is_regex === true,
            caseSensitive: e.case_sensitive === true,
        };
        // v2 字段覆盖（v2ToSt 已含 order/position/depth/probability 等）
        for (var k in st) {
            if (Object.prototype.hasOwnProperty.call(st, k))
                base[k] = st[k];
        }
        // ST 的 role
        var target = String(e.inject_target || "system");
        base.role = target === "user" ? 1 : (target === "#assistan.t/" ? 2 : 0);
        out[String(i)] = base;
    }
    return { name: name || "worldbook_v2_export", entries: out };
}
/**
 * 首次迁移：把存量条目的 v2 字段落盘一次。
 *
 * 幂等：靠 flag 文件判断，第二次直接跳过。
 * 只增不减：v1 字段完全不动。
 */
async function migrateAllOnce() {
    // 已迁移过？
    try {
        var r = await Tools.Files.read(flagPath());
        var txt = String((r && r.content) || "").trim();
        if (txt) {
            var f = JSON.parse(txt);
            if (f && f.done === true) {
                return { ok: true, skipped: true, count: Number(f.count) || 0 };
            }
        }
    }
    catch (_e) { }
    var raw = [];
    try {
        raw = await wb_data_1.readEntries();
    }
    catch (_e) {
        return { ok: false, error: "read failed" };
    }
    if (!Array.isArray(raw) || raw.length === 0) {
        // 空库也写 flag，避免每次都试
        try {
            await Tools.Files.write(flagPath(), JSON.stringify({ done: true, count: 0, at: Date.now() }));
        }
        catch (_e) { }
        return { ok: true, count: 0 };
    }
    var migrated = [];
    var changed = 0;
    for (var i = 0; i < raw.length; i += 1) {
        var e = raw[i];
        if (!e || typeof e !== "object") {
            migrated.push(e);
            continue;
        }
        var before = wb_fields_1.normalizeV2Entry(e);
        var after = wb_fields_1.migrateEntry(e);
        // 判断是否真的补了字段
        var hasAll = true;
        for (var f2 = 0; f2 < wb_fields_1.V2_FIELDS.length; f2 += 1) {
            if (after[wb_fields_1.V2_FIELDS[f2]] === undefined) {
                hasAll = false;
                break;
            }
        }
        if (!hasAll)
            changed += 1;
        migrated.push(after);
    }
    var res = await writeEntriesV2(migrated);
    if (!res.ok)
        return { ok: false, error: res.error };
    try {
        await Tools.Files.write(flagPath(), JSON.stringify({ done: true, count: migrated.length, at: Date.now() }));
    }
    catch (_e) { }
    return { ok: true, count: migrated.length, changed: changed };
}
/** 统计：有多少条目用了 v2 特性（供 UI 展示「已增强 N 条」）。 */
function v2Stats(entries) {
    var list = Array.isArray(entries) ? entries : [];
    var stat = {
        total: list.length,
        withProbability: 0,
        withGroups: 0,
        withTiming: 0,
        withRecursion: 0,
        withCharFilter: 0,
        withKeyLogic: 0,
        withOrder: 0,
    };
    for (var i = 0; i < list.length; i += 1) {
        var v = wb_fields_1.normalizeV2Entry(list[i]);
        if (v.probability < 100)
            stat.withProbability += 1;
        if (v.inclusionGroups)
            stat.withGroups += 1;
        if (v.sticky > 0 || v.cooldown > 0 || v.delay > 0)
            stat.withTiming += 1;
        if (v.excludeRecursion || v.preventRecursion)
            stat.withRecursion += 1;
        if (v.characterFilter)
            stat.withCharFilter += 1;
        if (v.keyLogic !== "and_any")
            stat.withKeyLogic += 1;
        if (v.order !== 100)
            stat.withOrder += 1;
    }
    return stat;
}
exports.readEntriesV2 = readEntriesV2;
exports.writeEntriesV2 = writeEntriesV2;
exports.patchEntryV2 = patchEntryV2;
exports.patchManyV2 = patchManyV2;
exports.toSillyTavernV2 = toSillyTavernV2;
exports.migrateAllOnce = migrateAllOnce;
exports.v2Stats = v2Stats;