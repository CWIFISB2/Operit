"use strict";
/* METADATA
{
  "name": "worldbook_v2_tools",
  "display_name": {
    "zh": "世界书 v2 增强工具",
    "en": "World Book v2 Tools"
  },
  "description": {
    "zh": "世界书 v2 增强字段管理：概率、互斥分组、时效（sticky/cooldown/delay）、递归控制、关键词逻辑、排序、角色过滤。可与 v1 的 29 个工具并存使用。",
    "en": "World Book v2 enhanced fields: probability, inclusion groups, timing (sticky/cooldown/delay), recursion control, key logic, ordering, character filter. Coexists with v1's 29 tools."
  },
  "category": "Utility",
  "tools": [
    {
      "name": "v2_get_entry",
      "description": {
        "zh": "读取单个条目的全部 v2 字段（含默认值补齐）。",
        "en": "Read all v2 fields of one entry (with defaults filled)."
      },
      "parameters": [
        { "name": "id", "description": { "zh": "条目 ID", "en": "Entry ID" }, "type": "string", "required": true }
      ]
    },
    {
      "name": "v2_list_entries",
      "description": {
        "zh": "列出所有条目的 v2 字段摘要，可按特性筛选。",
        "en": "List v2 field summaries of all entries, filterable by feature."
      },
      "parameters": [
        {
          "name": "filter",
          "description": {
            "zh": "筛选：all / probability / groups / timing / recursion / charfilter / nondefault",
            "en": "Filter: all / probability / groups / timing / recursion / charfilter / nondefault"
          },
          "type": "string",
          "required": false
        }
      ]
    },
    {
      "name": "v2_patch_entry",
      "description": {
        "zh": "修改单个条目的 v2 字段。只传要改的字段，其余保持不变。",
        "en": "Patch v2 fields of one entry. Only pass fields to change."
      },
      "parameters": [
        { "name": "id", "description": { "zh": "条目 ID", "en": "Entry ID" }, "type": "string", "required": true },
        { "name": "probability", "description": { "zh": "概率 0-100", "en": "Probability 0-100" }, "type": "number", "required": false },
        { "name": "keyLogic", "description": { "zh": "主词逻辑：and_any/and_all/not_any/not_all", "en": "Key logic: and_any/and_all/not_any/not_all" }, "type": "string", "required": false },
        { "name": "secondaryLogic", "description": { "zh": "次词逻辑，同上", "en": "Secondary logic, same values" }, "type": "string", "required": false },
        { "name": "matchWholeWords", "description": { "zh": "全词匹配", "en": "Match whole words" }, "type": "boolean", "required": false },
        { "name": "inclusionGroups", "description": { "zh": "互斥组名，逗号分隔", "en": "Inclusion groups, comma-separated" }, "type": "string", "required": false },
        { "name": "groupWeight", "description": { "zh": "组内权重", "en": "Group weight" }, "type": "number", "required": false },
        { "name": "prioritizeInclusion", "description": { "zh": "按命中数确定性优选", "en": "Prioritize by hit count" }, "type": "boolean", "required": false },
        { "name": "sticky", "description": { "zh": "命中后持续条数", "en": "Sticky turns" }, "type": "number", "required": false },
        { "name": "cooldown", "description": { "zh": "冷却条数", "en": "Cooldown turns" }, "type": "number", "required": false },
        { "name": "delay", "description": { "zh": "延迟条数", "en": "Delay turns" }, "type": "number", "required": false },
        { "name": "excludeRecursion", "description": { "zh": "内容不参与递归", "en": "Exclude from recursion" }, "type": "boolean", "required": false },
        { "name": "preventRecursion", "description": { "zh": "不被递归触发", "en": "Prevent recursive trigger" }, "type": "boolean", "required": false },
        { "name": "position", "description": { "zh": "位置：prepend/append/at_depth", "en": "Position: prepend/append/at_depth" }, "type": "string", "required": false },
        { "name": "depth", "description": { "zh": "插入深度", "en": "Insertion depth" }, "type": "number", "required": false },
        { "name": "order", "description": { "zh": "排序，越小越优先", "en": "Order, smaller first" }, "type": "number", "required": false },
        { "name": "characterFilterType", "description": { "zh": "角色过滤：include/exclude/空=不限", "en": "Char filter: include/exclude/empty" }, "type": "string", "required": false },
        { "name": "characterFilterNames", "description": { "zh": "角色卡 ID 列表，逗号分隔", "en": "Character card IDs, comma-separated" }, "type": "string", "required": false }
      ]
    },
    {
      "name": "v2_patch_many",
      "description": {
        "zh": "批量修改多个条目的同一组 v2 字段。",
        "en": "Batch patch the same v2 fields on multiple entries."
      },
      "parameters": [
        { "name": "ids", "description": { "zh": "条目 ID 列表，逗号分隔", "en": "Entry IDs, comma-separated" }, "type": "string", "required": true },
        { "name": "patch", "description": { "zh": "要改的字段 JSON", "en": "Fields to patch as JSON" }, "type": "string", "required": true }
      ]
    },
    {
      "name": "v2_reset_fields",
      "description": {
        "zh": "把指定条目的 v2 字段重置为默认值（恢复 v1 行为）。",
        "en": "Reset v2 fields of entries to defaults (back to v1 behavior)."
      },
      "parameters": [
        { "name": "ids", "description": { "zh": "条目 ID 列表，逗号分隔；留空=全部", "en": "Entry IDs, comma-separated; empty=all" }, "type": "string", "required": false }
      ]
    },
    {
      "name": "v2_set_runtime",
      "description": {
        "zh": "设置 v2 引擎运行时参数（token 预算、最少激活、递归深度）。",
        "en": "Set v2 engine runtime params (token budget, min activations, recursion depth)."
      },
      "parameters": [
        { "name": "enabled", "description": { "zh": "总开关", "en": "Master switch" }, "type": "boolean", "required": false },
        { "name": "tokenBudget", "description": { "zh": "Token 预算，0=不限", "en": "Token budget, 0=unlimited" }, "type": "number", "required": false },
        { "name": "minActivations", "description": { "zh": "最少激活条数", "en": "Min activations" }, "type": "number", "required": false },
        { "name": "maxRecursionDepth", "description": { "zh": "递归最大深度，0=关闭", "en": "Max recursion depth, 0=off" }, "type": "number", "required": false }
      ]
    },
    {
      "name": "v2_get_runtime",
      "description": {
        "zh": "读取当前 v2 运行时参数。",
        "en": "Read current v2 runtime params."
      },
      "parameters": []
    },
    {
      "name": "v2_stats",
      "description": {
        "zh": "统计有多少条目使用了各 v2 特性。",
        "en": "Count how many entries use each v2 feature."
      },
      "parameters": []
    },
    {
      "name": "v2_dry_run",
      "description": {
        "zh": "干跑：给定输入文本，看会激活哪些条目（不实际注入）。",
        "en": "Dry run: given input text, see which entries activate (no real injection)."
      },
      "parameters": [
        { "name": "text", "description": { "zh": "待测试的输入文本", "en": "Input text to test" }, "type": "string", "required": true },
        { "name": "historyDepth", "description": { "zh": "额外扫描的历史条数", "en": "Extra history turns to scan" }, "type": "number", "required": false }
      ]
    },
    {
      "name": "v2_export_st",
      "description": {
        "zh": "导出为 SillyTavern 格式（含 v2 字段）。",
        "en": "Export as SillyTavern format (with v2 fields)."
      },
      "parameters": [
        { "name": "name", "description": { "zh": "世界书名", "en": "Worldbook name" }, "type": "string", "required": false }
      ]
    },
    {
      "name": "v2_migrate",
      "description": {
        "zh": "把存量 v1 条目补齐 v2 字段（一次性迁移，幂等）。",
        "en": "Migrate existing v1 entries to v2 fields (one-time, idempotent)."
      },
      "parameters": []
    }
  ]
}
*/
Object.defineProperty(exports, ":esModule", { value: true });
// 世界书 v2 · 工具层
//
// 与 v1 的 29 个工具完全并存：v1 管基础字段，v2 管增强字段。
// 底层走 wb_store_v2（自动补字段 + 保留 v1 字段），不碰 wb_data.js。
var wb_data_js_1 = require("../shared/wb_data.js");
var wb_fields_js_1 = require("../shared/wb_fields.js");
var wb_store_v2_js_1 = require("../shared/wb_store_v2.js");
var wb_engine_js_1 = require("../shared/wb_engine.js");

var V2_RUNTIME_FILE = "worldbook_v2.json";
function runtimePath() {
    return String(wb_data_js_1.NATIVE_DIR || "") + "/" + V2_RUNTIME_FILE;
}
var DEFAULT_RUNTIME = {
    enabled: true,
    tokenBudget: 0,
    minActivations: 0,
    maxRecursionDepth: 5,
    stickyEnabled: true,
    appendToExisting: true,
};
async function readRuntime() {
    try {
        var r = await Tools.Files.read(runtimePath());
        var txt = String((r && r.content) || "").trim();
        if (!txt)
            return Object.assign({}, DEFAULT_RUNTIME);
        return Object.assign({}, DEFAULT_RUNTIME, JSON.parse(txt));
    }
    catch (_e) {
        return Object.assign({}, DEFAULT_RUNTIME);
    }
}
async function writeRuntime(cfg) {
    try {
        await Tools.Files.write(runtimePath(), JSON.stringify(cfg, null, 2));
        return { ok: true };
    }
    catch (err) {
        return { ok: false, error: String((err && err.message) || err) };
    }
}
function toBool(v) {
    if (v === true || v === "true" || v === 1 || v === "1")
        return true;
    if (v === false || v === "false" || v === 0 || v === "0")
        return false;
    return undefined;
}
function splitIds(v) {
    if (Array.isArray(v))
        return v.map(function (x) { return String(x).trim(); }).filter(Boolean);
    if (typeof v === "string")
        return v.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
    return [];
}
/** 从工具参数里挑出 v2 字段（含驼峰转换）。 */
function buildV2Patch(params) {
    var p = params || {};
    var patch = {};
    var setIf = function (key, val) {
        if (val !== undefined && val !== null && val !== "")
            patch[key] = val;
    };
    setIf("probability", p.probability);
    setIf("keyLogic", p.keyLogic);
    setIf("secondaryLogic", p.secondaryLogic);
    var mw = toBool(p.matchWholeWords);
    if (mw !== undefined)
        patch.matchWholeWords = mw;
    setIf("inclusionGroups", p.inclusionGroups);
    setIf("groupWeight", p.groupWeight);
    var pi = toBool(p.prioritizeInclusion);
    if (pi !== undefined)
        patch.prioritizeInclusion = pi;
    setIf("sticky", p.sticky);
    setIf("cooldown", p.cooldown);
    setIf("delay", p.delay);
    var er = toBool(p.excludeRecursion);
    if (er !== undefined)
        patch.excludeRecursion = er;
    var prr = toBool(p.preventRecursion);
    if (prr !== undefined)
        patch.preventRecursion = prr;
    setIf("position", p.position);
    setIf("depth", p.depth);
    setIf("order", p.order);
    // 角色过滤：type + names 组合
    var ft = String(p.characterFilterType || "").trim();
    var fnames = splitIds(p.characterFilterNames);
    if (ft === "" && fnames.length === 0) {
        // 显式清空
        if (p.characterFilterType === "" || p.characterFilterNames === "") {
            patch.characterFilter = null;
        }
    }
    else if (ft && fnames.length > 0) {
        patch.characterFilter = { type: ft, names: fnames, tags: [] };
    }
    else if (ft === "" && fnames.length > 0) {
        patch.characterFilter = { type: "include", names: fnames, tags: [] };
    }
    return patch;
}
// ============ 工具实现 ============
async function v2GetEntry(params) {
    var id = String((params && params.id) || "");
    if (!id)
        return { success: false, message: "缺少 id" };
    var list = await wb_store_v2_js_1.readEntriesV2();
    for (var i = 0; i < list.length; i += 1) {
        if (String(list[i].id || "") === id) {
            var v2 = wb_fields_js_1.normalizeV2Entry(list[i]);
            return {
                success: true,
                entry: list[i],
                v2: v2,
                isDefault: JSON.stringify(v2) === JSON.stringify(wb_fields_js_1.V2_DEFAULTS),
            };
        }
    }
    return { success: false, message: "条目不存在: " + id };
}
async function v2ListEntries(params) {
    var filter = String((params && params.filter) || "all");
    var list = await wb_store_v2_js_1.readEntriesV2();
    var out = [];
    for (var i = 0; i < list.length; i += 1) {
        var e = list[i];
        var v = wb_fields_js_1.normalizeV2Entry(e);
        var changed = false;
        if (v.probability !== 100 || v.inclusionGroups || v.sticky || v.cooldown || v.delay ||
            v.excludeRecursion || v.preventRecursion || v.keyLogic !== "and_any" ||
            v.order !== 100 || v.characterFilter || v.matchWholeWords || v.prioritizeInclusion) {
            changed = true;
        }
        var keep = false;
        if (filter === "all")
            keep = true;
        else if (filter === "probability")
            keep = v.probability !== 100;
        else if (filter === "groups")
            keep = !!v.inclusionGroups;
        else if (filter === "timing")
            keep = v.sticky > 0 || v.cooldown > 0 || v.delay > 0;
        else if (filter === "recursion")
            keep = v.excludeRecursion || v.preventRecursion;
        else if (filter === "charfilter")
            keep = !!v.characterFilter;
        else if (filter === "nondefault")
            keep = changed;
        else
            keep = true;
        if (!keep)
            continue;
        out.push({
            id: String(e.id || ""),
            name: String(e.name || ""),
            keywords: Array.isArray(e.keywords) ? e.keywords : [],
            always_active: e.always_active === true,
            probability: v.probability,
            keyLogic: v.keyLogic,
            inclusionGroups: v.inclusionGroups,
            groupWeight: v.groupWeight,
            prioritizeInclusion: v.prioritizeInclusion,
            sticky: v.sticky,
            cooldown: v.cooldown,
            delay: v.delay,
            recursion: (v.excludeRecursion ? "exclude" : (v.preventRecursion ? "prevent" : "")),
            position: v.position,
            depth: v.depth,
            order: v.order,
            charFilter: v.characterFilter,
            hasV2: changed,
        });
    }
    return { success: true, total: list.length, count: out.length, filter: filter, entries: out };
}
async function v2PatchEntry(params) {
    var id = String((params && params.id) || "");
    if (!id)
        return { success: false, message: "缺少 id" };
    var patch = buildV2Patch(params);
    if (Object.keys(patch).length === 0) {
        return { success: false, message: "没有要修改的 v2 字段" };
    }
    var res = await wb_store_v2_js_1.patchEntryV2(id, patch);
    return res.ok
        ? { success: true, message: "已更新 " + res.changed.length + " 个字段", changed: res.changed, v2: wb_fields_js_1.normalizeV2Entry(res.entry) }
        : { success: false, message: String(res.error || "更新失败") };
}
async function v2PatchMany(params) {
    var ids = splitIds(params && params.ids);
    if (ids.length === 0)
        return { success: false, message: "缺少 ids" };
    var raw = params && params.patch;
    var patch = {};
    if (typeof raw === "string") {
        try {
            patch = JSON.parse(raw);
        }
        catch (_e) {
            return { success: false, message: "patch 不是合法 JSON" };
        }
    }
    else if (raw && typeof raw === "object") {
        patch = raw;
    }
    if (Object.keys(patch).length === 0)
        return { success: false, message: "patch 为空" };
    var res = await wb_store_v2_js_1.patchManyV2(ids, patch);
    return {
        success: res.ok === true,
        message: res.ok ? ("已更新 " + res.updated + " 条") : String(res.error || "更新失败"),
        updated: res.updated,
    };
}
async function v2ResetFields(params) {
    var ids = splitIds(params && params.ids);
    var list = await wb_store_v2_js_1.readEntriesV2();
    var targets = [];
    if (ids.length === 0) {
        for (var i = 0; i < list.length; i += 1)
            targets.push(String(list[i].id || ""));
    }
    else {
        targets = ids;
    }
    if (targets.length === 0)
        return { success: true, message: "没有条目需要重置", updated: 0 };
    var res = await wb_store_v2_js_1.patchManyV2(targets, wb_fields_js_1.V2_DEFAULTS);
    return {
        success: res.ok === true,
        message: res.ok ? ("已重置 " + res.updated + " 条为默认值") : String(res.error || "重置失败"),
        updated: res.updated,
    };
}
async function v2SetRuntime(params) {
    var cfg = await readRuntime();
    var p = params || {};
    if (p.enabled !== undefined) {
        var b = toBool(p.enabled);
        if (b !== undefined)
            cfg.enabled = b;
    }
    if (p.tokenBudget !== undefined) {
        var tb = Number(p.tokenBudget);
        if (isFinite(tb) && tb >= 0)
            cfg.tokenBudget = Math.round(tb);
    }
    if (p.minActivations !== undefined) {
        var ma = Number(p.minActivations);
        if (isFinite(ma) && ma >= 0)
            cfg.minActivations = Math.round(ma);
    }
    if (p.maxRecursionDepth !== undefined) {
        var md = Number(p.maxRecursionDepth);
        if (isFinite(md) && md >= 0)
            cfg.maxRecursionDepth = Math.round(md);
    }
    var w = await writeRuntime(cfg);
    return w.ok
        ? { success: true, message: "运行时参数已更新", runtime: cfg }
        : { success: false, message: String(w.error || "写入失败") };
}
async function v2GetRuntime() {
    var cfg = await readRuntime();
    return { success: true, runtime: cfg, path: runtimePath() };
}
async function v2Stats() {
    var list = await wb_store_v2_js_1.readEntriesV2();
    var stat = wb_store_v2_js_1.v2Stats(list);
    var groups = {};
    for (var i = 0; i < list.length; i += 1) {
        var v = wb_fields_js_1.normalizeV2Entry(list[i]);
        if (!v.inclusionGroups)
            continue;
        var gs = v.inclusionGroups.split(",");
        for (var j = 0; j < gs.length; j += 1) {
            var g = gs[j].trim();
            if (!g)
                continue;
            groups[g] = (groups[g] || 0) + 1;
        }
    }
    return {
        success: true,
        stats: stat,
        inclusionGroupNames: Object.keys(groups).sort(),
        inclusionGroupCounts: groups,
    };
}
async function v2DryRun(params) {
    var text = String((params && params.text) || "");
    if (!text)
        return { success: false, message: "缺少 text" };
    var list = await wb_store_v2_js_1.readEntriesV2();
    if (list.length === 0)
        return { success: true, message: "世界书为空", activated: [] };
    var cfg = await readRuntime();
    // 强制清掉上轮的 _matched 标记
    for (var i = 0; i < list.length; i += 1)
        delete list[i]._matched;
    var res = wb_engine_js_1.runPipeline(list, text, 0, {
        tokenBudget: cfg.tokenBudget,
        minActivations: cfg.minActivations,
        maxRecursionDepth: cfg.maxRecursionDepth,
    });
    var activated = [];
    for (var k = 0; k < res.entries.length; k += 1) {
        var e = res.entries[k];
        activated.push({
            id: String(e.id || ""),
            name: String(e.name || ""),
            always_active: e.always_active === true,
            forced: e._forced === true,
        });
    }
    return {
        success: true,
        input: text,
        totalEntries: list.length,
        activatedCount: activated.length,
        activated: activated,
        diag: res.diag,
    };
}
async function v2ExportSt(params) {
    var name = String((params && params.name) || "worldbook_v2_export");
    var list = await wb_store_v2_js_1.readEntriesV2();
    var out = wb_store_v2_js_1.toSillyTavernV2(list, name);
    return {
        success: true,
        count: Object.keys(out.entries).length,
        name: name,
        data: out,
    };
}
async function v2Migrate() {
    var res = await wb_store_v2_js_1.migrateAllOnce();
    if (!res.ok)
        return { success: false, message: String(res.error || "迁移失败") };
    if (res.skipped) {
        return { success: true, message: "已迁移过（跳过）", count: res.count, skipped: true };
    }
    return {
        success: true,
        message: "迁移完成，共 " + res.count + " 条",
        count: res.count,
        changed: res.changed,
    };
}
// ============ 导出 ============
async function wrap(handler, params) {
    try {
        var result = await handler(params);
        complete(result);
    }
    catch (error) {
        complete({ success: false, message: String((error && error.message) || error) });
    }
}
exports.v2_get_entry = function (p) { return wrap(v2GetEntry, p); };
exports.v2_list_entries = function (p) { return wrap(v2ListEntries, p); };
exports.v2_patch_entry = function (p) { return wrap(v2PatchEntry, p); };
exports.v2_patch_many = function (p) { return wrap(v2PatchMany, p); };
exports.v2_reset_fields = function (p) { return wrap(v2ResetFields, p); };
exports.v2_set_runtime = function (p) { return wrap(v2SetRuntime, p); };
exports.v2_get_runtime = function (p) { return wrap(v2GetRuntime, p); };
exports.v2_stats = function (p) { return wrap(v2Stats, p); };
exports.v2_dry_run = function (p) { return wrap(v2DryRun, p); };
exports.v2_export_st = function (p) { return wrap(v2ExportSt, p); };
exports.v2_migrate = function (p) { return wrap(v2Migrate, p); };

// ===== v3 体检工具（合并进本子包，避免新增子包）=====
var wb_match_3 = require("../shared/wb_match.js");
var wb_diag_3 = require("../shared/wb_diagnostics.js");

async function v3AuditKeywords(params) {
    var p2 = params || {};
    var limit = Number(p2.sample_limit) > 0 ? Number(p2.sample_limit) : 20;
    var entries = await wb_data_js_1.readEntries();
    var rep = wb_match_3.auditKeywords(entries);
    var lines = [];
    var i, nMax;
    lines.push("=== 关键词审计 ===");
    lines.push("条目 " + rep.stats.entries + " | 关键词 " + rep.stats.totalKeys + " (去重后 " + rep.stats.uniqueKeys + ") | 问题 " + rep.stats.issueCount);
    lines.push("");
    if (rep.never.length) {
        lines.push("[永不触发] " + rep.never.length + " 项");
        nMax = Math.min(rep.never.length, limit);
        for (i = 0; i < nMax; i += 1) lines.push("  - " + rep.never[i].entry + " / " + rep.never[i].key + " -- " + rep.never[i].reason);
        if (rep.never.length > nMax) lines.push("  ... 还有 " + (rep.never.length - nMax) + " 项");
        lines.push("");
    }
    if (rep.overbroad.length) {
        lines.push("[过宽关键词] " + rep.overbroad.length + " 项");
        nMax = Math.min(rep.overbroad.length, limit);
        for (i = 0; i < nMax; i += 1) lines.push("  - " + rep.overbroad[i].entry + " / " + rep.overbroad[i].key + " -- " + rep.overbroad[i].reason);
        if (rep.overbroad.length > nMax) lines.push("  ... 还有 " + (rep.overbroad.length - nMax) + " 项");
        lines.push("");
    }
    if (rep.duplicates.length) {
        lines.push("[重复关键词] " + rep.duplicates.length + " 项");
        nMax = Math.min(rep.duplicates.length, limit);
        for (i = 0; i < nMax; i += 1) lines.push("  - " + rep.duplicates[i].key + " 被 " + rep.duplicates[i].count + " 条共用: " + rep.duplicates[i].entries.join("、"));
        if (rep.duplicates.length > nMax) lines.push("  ... 还有 " + (rep.duplicates.length - nMax) + " 项");
        lines.push("");
    }
    if (rep.regexBad.length) {
        lines.push("[正则错误] " + rep.regexBad.length + " 项");
        for (i = 0; i < Math.min(rep.regexBad.length, limit); i += 1) lines.push("  - " + rep.regexBad[i].entry + " / " + rep.regexBad[i].key + " -- " + rep.regexBad[i].reason);
        lines.push("");
    }
    if (!rep.stats.issueCount) lines.push("OK 没有发现问题");
    return { success: true, report: rep, text: lines.join("\n") };
}

async function v3Diagnose(params) {
    var entries = await wb_data_js_1.readEntries();
    var groups = [];
    try {
        var g = await wb_data_js_1.readGroups();
        groups = Array.isArray(g) ? g : [];
    } catch (_e) { groups = []; }
    var rep = wb_diag_3.runDiagnostics(entries, { groups: groups });
    var lines = [];
    var i, oi, sub;
    lines.push("=== 世界书诊断 ===");
    lines.push("条目 " + rep.summary.entries + " | 问题 " + rep.summary.total + " (错误 " + rep.summary.error + " / 警告 " + rep.summary.warning + " / 提示 " + rep.summary.info + ")");
    lines.push("");
    var order = ["error", "warning", "info"];
    var label = { error: "错误", warning: "警告", info: "提示" };
    for (oi = 0; oi < order.length; oi += 1) {
        sub = rep.issues.filter(function (x) { return x.severity === order[oi]; });
        if (!sub.length) continue;
        lines.push("[" + label[order[oi]] + "] " + sub.length + " 项");
        for (i = 0; i < sub.length && i < 30; i += 1) {
            lines.push("  - " + sub[i].title + (sub[i].entryName ? " (" + sub[i].entryName + ")" : ""));
            if (sub[i].detail) lines.push("      " + sub[i].detail);
        }
        if (sub.length > 30) lines.push("  ... 还有 " + (sub.length - 30) + " 项");
        lines.push("");
    }
    if (!rep.issues.length) lines.push("OK 完全健康");
    return { success: true, report: rep, text: lines.join("\n") };
}

async function v3TestMatch(params) {
    var p2 = params || {};
    var text = String(p2.text || "");
    if (!text) return { success: false, code: "NO_TEXT", message: "需要提供 text 参数" };
    var entries = await wb_data_js_1.readEntries();
    var list = Array.isArray(entries) ? entries : [];
    var activated = [];
    var i, k;
    for (i = 0; i < list.length; i += 1) {
        var e = list[i] || {};
        if (e.enabled === false) continue;
        if (!wb_match_3.matchesEntry(e, text)) continue;
        var always = e.always_active === true;
        var prim = wb_match_3.collectPrimary(e);
        var hitKeys = [];
        for (k = 0; k < prim.length; k += 1) {
            if (wb_match_3.matchOne(e, prim[k], text)) hitKeys.push(prim[k]);
        }
        activated.push({
            id: String(e.id || ""),
            name: String(e.name || e.id || ""),
            always: always,
            reason: always ? "常驻激活" : ("命中 " + hitKeys.length + "/" + prim.length + " 个关键词"),
            hitKeys: hitKeys,
            priority: Number(e.priority) || 50
        });
    }
    activated.sort(function (a, b) { return b.priority - a.priority; });
    var lines = [];
    lines.push("=== 匹配试跑 ===");
    lines.push("输入 " + text.length + " 字 | 条目 " + list.length + " | 激活 " + activated.length);
    lines.push("");
    if (!activated.length) lines.push("(没有条目会被激活)");
    else {
        for (i = 0; i < activated.length; i += 1) {
            lines.push("  [" + (i + 1) + "] " + activated[i].name + " -- " + activated[i].reason);
            if (activated[i].hitKeys.length) lines.push("      命中: " + activated[i].hitKeys.join("、"));
        }
    }
    return { success: true, text: lines.join("\n"), activated: activated, inputLength: text.length };
}

async function v3ExplainEntry(params) {
    var p2 = params || {};
    var id = String(p2.id || "");
    var text = String(p2.text || "");
    if (!id) return { success: false, code: "NO_ID", message: "需要提供 id 参数" };
    var entries = await wb_data_js_1.readEntries();
    var list = Array.isArray(entries) ? entries : [];
    var target = null;
    var i, k;
    for (i = 0; i < list.length; i += 1) {
        if (String(list[i] && list[i].id) === id) { target = list[i]; break; }
    }
    if (!target) return { success: false, code: "NOT_FOUND", message: "条目不存在: " + id };
    var prim = wb_match_3.collectPrimary(target);
    var sec = wb_match_3.collectSecondary(target);
    var lines = [];
    lines.push("=== 条目解释: " + String(target.name || id) + " ===");
    lines.push("启用: " + (target.enabled === false ? "否" : "是") + " | 常驻: " + (target.always_active === true ? "是" : "否") + " | 逻辑: " + String(target.keyLogic || "and_any"));
    lines.push("");
    lines.push("主关键词 " + prim.length + " 个:");
    for (k = 0; k < prim.length; k += 1) {
        var hit = text ? wb_match_3.matchOne(target, prim[k], text) : null;
        lines.push("  " + (hit === null ? "?" : (hit ? "OK" : "NO")) + " " + prim[k]);
    }
    if (sec.length) {
        lines.push("");
        lines.push("次要关键词 " + sec.length + " 个 (逻辑 " + String(target.secondaryLogic || "and_any") + "):");
        for (k = 0; k < sec.length; k += 1) {
            var h2 = text ? wb_match_3.matchOne(target, sec[k], text) : null;
            lines.push("  " + (h2 === null ? "?" : (h2 ? "OK" : "NO")) + " " + sec[k]);
        }
    }
    if (text) {
        lines.push("");
        lines.push("综合结果: " + (wb_match_3.matchesEntry(target, text) ? "会激活" : "不激活"));
    }
    var d = wb_diag_3.diagnoseOneEntry(target);
    if (d.length) {
        lines.push("");
        lines.push("该条目有 " + d.length + " 个问题:");
        for (k = 0; k < d.length; k += 1) lines.push("  - [" + d[k].severity + "] " + d[k].title);
    }
    return { success: true, text: lines.join("\n"), entry: target, issues: d };
}

exports.wb_audit_keywords = function (p) { return wrap(v3AuditKeywords, p); };
exports.wb_diagnose = function (p) { return wrap(v3Diagnose, p); };
exports.wb_test_match = function (p) { return wrap(v3TestMatch, p); };
exports.wb_explain_entry = function (p) { return wrap(v3ExplainEntry, p); };