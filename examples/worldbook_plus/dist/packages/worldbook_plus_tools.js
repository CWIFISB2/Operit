"use strict";
/* METADATA
{
  "name": "worldbook_plus_tools",
  "display_name": { "zh": "世界书增强工具", "en": "World Book Plus Tools" },
  "description": {
    "zh": "世界书完整工具集：8 个条目管理工具（对齐官方）+ 21 个增强工具（健康检查/去重/token预算/链式匹配/冲突检测/导出/激活/素材库/事件/隐藏/强制激活/孤儿清理/绑定总览/批量/任务预期桥接）。",
    "en": "Full world book toolkit: 8 entry-management tools + 16 enhanced tools."
  },
  "category": "Utility",
  "tools": [
    { "name": "list_entries", "description": { "zh": "列出所有世界书条目摘要。", "en": "List all entry summaries." }, "parameters": [] },
    { "name": "get_entry", "description": { "zh": "获取条目完整详情。", "en": "Get full entry details." }, "parameters": [
      { "name": "id", "description": { "zh": "条目 ID", "en": "Entry ID" }, "type": "string", "required": true }
    ]},
    { "name": "create_entry", "description": { "zh": "创建新的世界书条目。", "en": "Create a new entry." }, "parameters": [
      { "name": "name", "description": { "zh": "条目名称", "en": "Name" }, "type": "string", "required": true },
      { "name": "content", "description": { "zh": "注入内容", "en": "Content" }, "type": "string", "required": true },
      { "name": "keywords", "description": { "zh": "关键词，逗号分隔", "en": "Comma-separated keywords" }, "type": "string", "required": false },
      { "name": "is_regex", "description": { "zh": "关键词是否为正则", "en": "Keywords as regex" }, "type": "boolean", "required": false },
      { "name": "case_sensitive", "description": { "zh": "大小写敏感", "en": "Case sensitive" }, "type": "boolean", "required": false },
      { "name": "always_active", "description": { "zh": "是否常驻激活", "en": "Always active" }, "type": "boolean", "required": false },
      { "name": "enabled", "description": { "zh": "是否启用", "en": "Enabled" }, "type": "boolean", "required": false },
      { "name": "priority", "description": { "zh": "优先级", "en": "Priority" }, "type": "number", "required": false },
      { "name": "scan_depth", "description": { "zh": "扫描深度", "en": "Scan depth" }, "type": "number", "required": false },
      { "name": "inject_target", "description": { "zh": "注入目标 system/user/assistant", "en": "Injection target" }, "type": "string", "required": false },
      { "name": "inject_position", "description": { "zh": "注入位置 prepend/append/at_depth", "en": "Injection position" }, "type": "string", "required": false },
      { "name": "insertion_depth", "description": { "zh": "at_depth 插入深度", "en": "Insertion depth" }, "type": "number", "required": false },
      { "name": "character_card_id", "description": { "zh": "绑定角色卡 ID", "en": "Bound card ID" }, "type": "string", "required": false }
    ]},
    { "name": "update_entry", "description": { "zh": "更新已有条目。", "en": "Update an existing entry." }, "parameters": [
      { "name": "id", "description": { "zh": "条目 ID", "en": "Entry ID" }, "type": "string", "required": true },
      { "name": "name", "description": { "zh": "新名称", "en": "New name" }, "type": "string", "required": false },
      { "name": "content", "description": { "zh": "新内容", "en": "New content" }, "type": "string", "required": false },
      { "name": "keywords", "description": { "zh": "新关键词，逗号分隔", "en": "New keywords" }, "type": "string", "required": false },
      { "name": "is_regex", "description": { "zh": "关键词是否为正则", "en": "Keywords as regex" }, "type": "boolean", "required": false },
      { "name": "case_sensitive", "description": { "zh": "大小写敏感", "en": "Case sensitive" }, "type": "boolean", "required": false },
      { "name": "always_active", "description": { "zh": "是否常驻激活", "en": "Always active" }, "type": "boolean", "required": false },
      { "name": "enabled", "description": { "zh": "是否启用", "en": "Enabled" }, "type": "boolean", "required": false },
      { "name": "priority", "description": { "zh": "优先级", "en": "Priority" }, "type": "number", "required": false },
      { "name": "scan_depth", "description": { "zh": "扫描深度", "en": "Scan depth" }, "type": "number", "required": false },
      { "name": "inject_target", "description": { "zh": "注入目标", "en": "Injection target" }, "type": "string", "required": false },
      { "name": "inject_position", "description": { "zh": "注入位置", "en": "Injection position" }, "type": "string", "required": false },
      { "name": "insertion_depth", "description": { "zh": "插入深度", "en": "Insertion depth" }, "type": "number", "required": false },
      { "name": "character_card_id", "description": { "zh": "绑定角色卡 ID", "en": "Bound card ID" }, "type": "string", "required": false }
    ]},
    { "name": "delete_entry", "description": { "zh": "删除条目。", "en": "Delete an entry." }, "parameters": [
      { "name": "id", "description": { "zh": "条目 ID", "en": "Entry ID" }, "type": "string", "required": true }
    ]},
    { "name": "toggle_entry", "description": { "zh": "切换条目启用状态。", "en": "Toggle entry enabled state." }, "parameters": [
      { "name": "id", "description": { "zh": "条目 ID", "en": "Entry ID" }, "type": "string", "required": true }
    ]},
    { "name": "import_entries", "description": { "zh": "从 JSON 导入条目。兼容 Operit 数组、SillyTavern lorebook、角色卡 character_book。", "en": "Import entries from JSON." }, "parameters": [
      { "name": "path", "description": { "zh": "导入文件路径；与 content 二选一", "en": "Import file path" }, "type": "string", "required": false },
      { "name": "content", "description": { "zh": "原始 JSON 文本；与 path 二选一", "en": "Raw JSON text" }, "type": "string", "required": false },
      { "name": "character_card_id", "description": { "zh": "导入后统一绑定角色卡", "en": "Bind all to card" }, "type": "string", "required": false }
    ]},
    { "name": "list_character_cards_proxy", "description": { "zh": "列出所有角色卡。", "en": "List all character cards." }, "parameters": [] },
    { "name": "wbplus_health", "description": { "zh": "健康检查：条目统计、token 占用、死条目、超大条目、绑定分布。", "en": "Health check." }, "parameters": [
      { "name": "oversized_threshold", "description": { "zh": "超大条目 token 阈值，默认 1200", "en": "Oversized threshold" }, "type": "number", "required": false }
    ]},
    { "name": "wbplus_dedupe", "description": { "zh": "去重检测与合并。scan 只报告；merge 按 keep 策略删重并自动备份。", "en": "Duplicate scan and merge." }, "parameters": [
      { "name": "action", "description": { "zh": "scan（默认）或 merge", "en": "scan or merge" }, "type": "string", "required": false },
      { "name": "keep", "description": { "zh": "newest（默认）/ oldest / highest_priority", "en": "Keep policy" }, "type": "string", "required": false }
    ]},
    { "name": "wbplus_budget", "description": { "zh": "token 预算分析：当前总 token、超出量、裁剪候选。", "en": "Token budget analysis." }, "parameters": [
      { "name": "budget", "description": { "zh": "token 预算上限", "en": "Budget ceiling" }, "type": "number", "required": true }
    ]},
    { "name": "wbplus_match", "description": { "zh": "链式匹配模拟：给定文本返回命中条目及评分。", "en": "Match simulation with scoring." }, "parameters": [
      { "name": "text", "description": { "zh": "要模拟的输入文本", "en": "Input text" }, "type": "string", "required": true },
      { "name": "sensitivity", "description": { "zh": "灵敏度 0-1，默认 0.7", "en": "Sensitivity" }, "type": "number", "required": false },
      { "name": "top_k", "description": { "zh": "最多返回条数，0=不限", "en": "Max results" }, "type": "number", "required": false }
    ]},
    { "name": "wbplus_conflicts", "description": { "zh": "关键词冲突检测。", "en": "Keyword conflict scan." }, "parameters": [
      { "name": "min_count", "description": { "zh": "最少共用条目数，默认 2", "en": "Min shared count" }, "type": "number", "required": false }
    ]},
    { "name": "wbplus_export", "description": { "zh": "批量导出：operit 或 sillytavern 格式，可写文件。", "en": "Bulk export." }, "parameters": [
      { "name": "format", "description": { "zh": "operit（默认）或 sillytavern", "en": "operit or sillytavern" }, "type": "string", "required": false },
      { "name": "path", "description": { "zh": "可选写出路径", "en": "Output path" }, "type": "string", "required": false },
      { "name": "enabled_only", "description": { "zh": "仅导出启用条目", "en": "Enabled only" }, "type": "boolean", "required": false }
    ]},
    { "name": "wbplus_activate", "description": { "zh": "激活检测：check/get/set。三路判定（子串/词边界/CJK方括号）消息是否进入注入模式。", "en": "Activation gate: check/get/set." }, "parameters": [
      { "name": "action", "description": { "zh": "check（默认）/ get / set", "en": "check/get/set" }, "type": "string", "required": false },
      { "name": "text", "description": { "zh": "check 时待判定文本", "en": "Text to check" }, "type": "string", "required": false },
      { "name": "words", "description": { "zh": "set 时子串激活词，逗号分隔", "en": "Substring words" }, "type": "string", "required": false },
      { "name": "exact_words", "description": { "zh": "set 时词边界精确词，逗号分隔", "en": "Exact words" }, "type": "string", "required": false }
    ]},
    { "name": "wbplus_kb", "description": { "zh": "素材库召回：加权评分（主副关键词门控+别名+名称加成），可选输出参考文本。", "en": "KB recall with weighted scoring." }, "parameters": [
      { "name": "text", "description": { "zh": "查询文本", "en": "Query text" }, "type": "string", "required": true },
      { "name": "top_k", "description": { "zh": "返回条数，默认 5", "en": "Top K" }, "type": "number", "required": false },
      { "name": "min_score", "description": { "zh": "最低分，默认 1", "en": "Min score" }, "type": "number", "required": false },
      { "name": "reference", "description": { "zh": "是否输出参考文本块", "en": "Output reference block" }, "type": "boolean", "required": false }
    ]},
    { "name": "wbplus_event_marker", "description": { "zh": "事件自动标记：days/activity/risk/confirm/close，自动推进天数与结算概率。", "en": "Event automation marker." }, "parameters": [
      { "name": "days", "description": { "zh": "推进天数", "en": "Days" }, "type": "number", "required": false },
      { "name": "activity", "description": { "zh": "活动阶段 none/ongoing/completed/cancelled", "en": "Activity" }, "type": "string", "required": false },
      { "name": "risk", "description": { "zh": "风险等级 none/low/medium/high/very_high", "en": "Risk" }, "type": "string", "required": false },
      { "name": "confirm", "description": { "zh": "确认 none/positive/negative", "en": "Confirm" }, "type": "string", "required": false },
      { "name": "close", "description": { "zh": "是否归档事件", "en": "Close" }, "type": "boolean", "required": false }
    ]},
    { "name": "wbplus_event", "description": { "zh": "延迟概率事件状态机：status/start/resolve/advance/summary/reset。", "en": "Delayed probabilistic event state machine." }, "parameters": [
      { "name": "action", "description": { "zh": "status（默认）/ start / resolve / advance / summary / reset", "en": "Action" }, "type": "string", "required": false },
      { "name": "name", "description": { "zh": "start 时事件名", "en": "Event name" }, "type": "string", "required": false },
      { "name": "chance", "description": { "zh": "start 时初始概率 0-100", "en": "Initial chance" }, "type": "number", "required": false },
      { "name": "resolution_delay", "description": { "zh": "隐藏判定延迟天数", "en": "Resolution delay" }, "type": "number", "required": false },
      { "name": "reveal_delay", "description": { "zh": "揭晓延迟天数", "en": "Reveal delay" }, "type": "number", "required": false },
      { "name": "roll", "description": { "zh": "resolve 时随机值 1-100", "en": "Roll value" }, "type": "number", "required": false },
      { "name": "days", "description": { "zh": "advance 时推进天数", "en": "Days" }, "type": "number", "required": false }
    ]}
  ,
    { "name": "wbplus_ai_judge", "description": { "zh": "AI 召回判定：对 recall_mode=ai 的条目，用当前输入文本判断是否召回，返回召回的 ID 清单。", "en": "AI recall judge for recall_mode=ai entries." }, "parameters": [
      { "name": "probe", "description": { "zh": "当前输入文本，用于判定召回", "en": "Current input text" }, "type": "string", "required": true }
    ]}
  ,
    { "name": "wbplus_recall_cfg", "description": { "zh": "读取或保存 AI 召回配置（recall_config.json）。", "en": "Read or save AI recall config." }, "parameters": [
      { "name": "action", "description": { "zh": "get 或 set", "en": "get or set" }, "type": "string", "required": true },
      { "name": "config", "description": { "zh": "action=set 时传入的 JSON 串", "en": "JSON string when action=set" }, "type": "string", "required": false }
    ]}
  ,
    { "name": "wbplus_te_status", "description": { "zh": "任务预期桥接：查看当前对话的预期与保留条目状态。", "en": "Task-expectation bridge: show expectation and reserved entries." }, "parameters": [
      { "name": "chat_id", "description": { "zh": "对话 ID", "en": "Chat ID" }, "type": "string", "required": true }
    ]}
  ,
    { "name": "wbplus_te_sync", "description": { "zh": "任务预期桥接：把当前对话预期同步为保留条目（常驻 system 注入）。", "en": "Task-expectation bridge: sync expectation into a reserved entry." }, "parameters": [
      { "name": "chat_id", "description": { "zh": "对话 ID", "en": "Chat ID" }, "type": "string", "required": true }
    ]}
  ,
    { "name": "wbplus_te_verify", "description": { "zh": "任务预期桥接：按校验结果调整约束条目注入位置（未满足→prepend，满足→append）。", "en": "Task-expectation bridge: adjust injection position by verify result." }, "parameters": [
      { "name": "chat_id", "description": { "zh": "对话 ID", "en": "Chat ID" }, "type": "string", "required": true },
      { "name": "passed", "description": { "zh": "是否满足预期", "en": "Whether expectation passed" }, "type": "boolean", "required": true }
    ]}
  ,
    { "name": "wbplus_te_remedy", "description": { "zh": "任务预期桥接：下发纠偏条目（未满足预期时熔断补救）。", "en": "Task-expectation bridge: raise a remedy entry." }, "parameters": [
      { "name": "chat_id", "description": { "zh": "对话 ID", "en": "Chat ID" }, "type": "string", "required": true },
      { "name": "note", "description": { "zh": "备注", "en": "Note" }, "type": "string", "required": false }
    ]}
  ,
    { "name": "wbplus_hide", "description": { "zh": "隐藏/恢复条目：隐藏=从列表与注入中排除但不删除（可逆）。action=hide/unhide/list/clear。", "en": "Hide/unhide entries reversibly." }, "parameters": [
      { "name": "action", "description": { "zh": "hide（默认）/ unhide / list / clear", "en": "hide/unhide/list/clear" }, "type": "string", "required": false },
      { "name": "ids", "description": { "zh": "条目 ID，逗号分隔", "en": "Comma-separated entry IDs" }, "type": "string", "required": false }
    ]}
  ,
    { "name": "wbplus_force", "description": { "zh": "按对话强制激活：动作 add/remove/list/set，scope=default|chat，让指定条目在该对话无视关键词直接注入（含隐藏条目）。", "en": "Chat-scoped force activation." }, "parameters": [
      { "name": "action", "description": { "zh": "add（默认）/ remove / list / set", "en": "add/remove/list/set" }, "type": "string", "required": false },
      { "name": "ids", "description": { "zh": "条目 ID，逗号分隔", "en": "Comma-separated entry IDs" }, "type": "string", "required": false },
      { "name": "scope", "description": { "zh": "default（默认）或 chat", "en": "default or chat" }, "type": "string", "required": false },
      { "name": "chat_id", "description": { "zh": "scope=chat 时的对话 ID", "en": "Chat ID when scope=chat" }, "type": "string", "required": false }
    ]}
  ,
    { "name": "wbplus_orphans", "description": { "zh": "孤儿条目：找出未归入任何分组的条目，可选 append_to 分组 ID 归并。", "en": "Find entries not in any group." }, "parameters": [
      { "name": "append_to", "description": { "zh": "可选：把孤儿归并到的分组 ID", "en": "Optional group ID to merge orphans into" }, "type": "string", "required": false }
    ]}
  ,
    { "name": "wbplus_bindings", "description": { "zh": "绑定总览：全局/角色卡/分组三维分布统计。", "en": "Binding overview: global/card/group distribution." }, "parameters": [] }
  ,
    { "name": "wbplus_bulk", "description": { "zh": "批量条目操作：action=enable/disable/delete/set_priority/bind_card；目标用 ids 或过滤器（filter_enabled/filter_disabled/filter_always_active/keyword/name_contains）。", "en": "Bulk entry operations with filters." }, "parameters": [
      { "name": "action", "description": { "zh": "enable/disable/delete/set_priority/bind_card", "en": "Bulk action" }, "type": "string", "required": true },
      { "name": "ids", "description": { "zh": "条目 ID，逗号分隔", "en": "Comma-separated entry IDs" }, "type": "string", "required": false },
      { "name": "filter_enabled", "description": { "zh": "只选启用条目", "en": "Only enabled entries" }, "type": "boolean", "required": false },
      { "name": "filter_disabled", "description": { "zh": "只选禁用条目", "en": "Only disabled entries" }, "type": "boolean", "required": false },
      { "name": "filter_always_active", "description": { "zh": "只选常驻条目", "en": "Only always-active entries" }, "type": "boolean", "required": false },
      { "name": "keyword", "description": { "zh": "关键词含此串的条目", "en": "Entries containing keyword" }, "type": "string", "required": false },
      { "name": "name_contains", "description": { "zh": "名称含此串的条目", "en": "Entries whose name contains" }, "type": "string", "required": false },
      { "name": "priority", "description": { "zh": "set_priority 时的目标优先级", "en": "Priority for set_priority" }, "type": "number", "required": false },
      { "name": "character_card_id", "description": { "zh": "bind_card 时的角色卡 ID（空串=解绑）", "en": "Card ID for bind_card" }, "type": "string", "required": false }
    ]}
  ]
}
*/
Object.defineProperty(exports, "__esModule", { value: true });
const wb_data_js_1 = require("../shared/wb_data.js");
const task_expectation_bridge_js_1 = require("../shared/task_expectation_bridge.js");
const GROUPS_FILE = "/sdcard/Download/Operit/plugins/com.operit.worldbook/groups.json";
const EVENT_FILE = "/sdcard/Download/Operit/plugins/com.operit.worldbook/event_state.json";
function genId() {
    return `wb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function splitKeywords(raw) {
    if (!raw)
        return [];
    return String(raw).split(/[,，]/).map((k) => k.trim()).filter((k) => k.length > 0);
}
function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}
function normTarget(v) {
    if (v === "user")
        return "user";
    if (v === "assistant")
        return "assistant";
    return "system";
}
function normPos(v) {
    if (v === "prepend")
        return "prepend";
    if (v === "at_depth")
        return "at_depth";
    return "append";
}
async function wrap(handler) {
    try {
        complete(await handler());
    }
    catch (error) {
        const message = error && error.message ? String(error.message) : String(error);
        complete({ success: false, message });
    }
}
// ============ 官方同名 8 工具 ============
exports.list_entries = () => wrap(async () => {
    const entries = await (0, wb_data_js_1.readEntries)();
    const list = entries.map((e) => ({
        id: e.id, name: e.name, enabled: e.enabled !== false, always_active: !!e.always_active,
        priority: e.priority ?? 50, keywords: e.keywords || [], is_regex: !!e.is_regex,
        scan_depth: e.scan_depth ?? 0, inject_target: e.inject_target || "system",
        inject_position: e.inject_position || "append", insertion_depth: e.insertion_depth ?? 0,
        character_card_id: e.character_card_id || ""
    })).sort((a, b) => b.priority - a.priority);
    return { success: true, count: list.length, entries: list };
});
exports.get_entry = (params) => wrap(async () => {
    const entries = await (0, wb_data_js_1.readEntries)();
    const id = String(params?.id || "").trim();
    const found = entries.find((e) => e.id === id);
    if (!found)
        return { success: false, code: "ENTRY_NOT_FOUND", message: `条目不存在: ${id}` };
    return { success: true, entry: found };
});
exports.create_entry = (params) => wrap(async () => {
    const entries = await (0, wb_data_js_1.readEntries)();
    const now = new Date().toISOString();
    const target = normTarget(params?.inject_target);
    const entry = {
        id: genId(),
        name: String(params?.name || ""),
        content: String(params?.content || ""),
        keywords: splitKeywords(params?.keywords),
        is_regex: params?.is_regex === true,
        case_sensitive: params?.case_sensitive === true,
        always_active: params?.always_active === true,
        enabled: params?.enabled !== false,
        priority: num(params?.priority, 50),
        scan_depth: num(params?.scan_depth, 0),
        inject_target: target,
        inject_position: target === "assistant" ? "at_depth" : normPos(params?.inject_position),
        insertion_depth: num(params?.insertion_depth, 0),
        character_card_id: String(params?.character_card_id || "").trim(),
        created_at: now,
        updated_at: now
    };
    entries.push(entry);
    await (0, wb_data_js_1.safeWriteEntries)(entries);
    return { success: true, message: "条目已创建", entry };
});
exports.update_entry = (params) => wrap(async () => {
    const entries = await (0, wb_data_js_1.readEntries)();
    const id = String(params?.id || "").trim();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1)
        return { success: false, code: "ENTRY_NOT_FOUND", message: `条目不存在: ${id}` };
    const next = { ...entries[idx] };
    if (params?.name != null)
        next.name = String(params.name);
    if (params?.content != null)
        next.content = String(params.content);
    if (params?.keywords != null)
        next.keywords = splitKeywords(params.keywords);
    if (params?.is_regex != null)
        next.is_regex = params.is_regex === true;
    if (params?.case_sensitive != null)
        next.case_sensitive = params.case_sensitive === true;
    if (params?.always_active != null)
        next.always_active = params.always_active === true;
    if (params?.enabled != null)
        next.enabled = params.enabled !== false;
    if (params?.priority != null)
        next.priority = num(params.priority, next.priority);
    if (params?.scan_depth != null)
        next.scan_depth = num(params.scan_depth, next.scan_depth);
    if (params?.inject_target != null)
        next.inject_target = normTarget(params.inject_target);
    if (params?.inject_position != null)
        next.inject_position = normPos(params.inject_position);
    if (params?.insertion_depth != null)
        next.insertion_depth = num(params.insertion_depth, next.insertion_depth ?? 0);
    if (next.inject_target === "assistant")
        next.inject_position = "at_depth";
    if (params?.character_card_id != null)
        next.character_card_id = String(params.character_card_id || "").trim();
    next.updated_at = new Date().toISOString();
    entries[idx] = next;
    await (0, wb_data_js_1.safeWriteEntries)(entries);
    return { success: true, message: "条目已更新", entry: next };
});
exports.delete_entry = (params) => wrap(async () => {
    const entries = await (0, wb_data_js_1.readEntries)();
    const id = String(params?.id || "").trim();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1)
        return { success: false, code: "ENTRY_NOT_FOUND", message: `条目不存在: ${id}` };
    const [removed] = entries.splice(idx, 1);
    await (0, wb_data_js_1.safeWriteEntries)(entries);
    try {
        const groups = await (0, wb_data_js_1.readGroups)();
        let dirty = false;
        for (const g of groups) {
            const gi = g.entry_ids.indexOf(id);
            if (gi !== -1) {
                g.entry_ids.splice(gi, 1);
                dirty = true;
            }
        }
        if (dirty)
            await Tools.Files.write(GROUPS_FILE, JSON.stringify(groups, null, 2));
    }
    catch (_e) { }
    return { success: true, message: `条目已删除: ${removed.name}` };
});
exports.toggle_entry = (params) => wrap(async () => {
    const entries = await (0, wb_data_js_1.readEntries)();
    const id = String(params?.id || "").trim();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1)
        return { success: false, code: "ENTRY_NOT_FOUND", message: `条目不存在: ${id}` };
    entries[idx] = { ...entries[idx], enabled: entries[idx].enabled === false, updated_at: new Date().toISOString() };
    await (0, wb_data_js_1.safeWriteEntries)(entries);
    return { success: true, message: `${entries[idx].name} 已${entries[idx].enabled ? "启用" : "禁用"}`, entry: entries[idx] };
});
exports.import_entries = (params) => wrap(async () => {
    let raw = String(params?.content || "").trim();
    if (!raw) {
        const path = String(params?.path || "").trim();
        if (!path)
            return { success: false, code: "IMPORT_PATH_REQUIRED", message: "导入路径或内容不能为空" };
        const r = await Tools.Files.read(path);
        raw = String(r?.content || "").trim();
        if (!raw)
            return { success: false, code: "IMPORT_FILE_EMPTY", message: "导入文件为空" };
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (e) {
        return { success: false, code: "INVALID_JSON", message: `不是有效 JSON: ${e.message}` };
    }
    const normalized = (0, wb_data_js_1.normalizeImportedPayload)(parsed);
    if (normalized.entries.length === 0)
        return { success: false, code: "NO_IMPORTABLE_ENTRIES", message: "没有可导入条目" };
    const entries = await (0, wb_data_js_1.readEntries)();
    const now = new Date().toISOString();
    const cardId = String(params?.character_card_id || "").trim();
    const added = normalized.entries.map((n) => ({
        id: genId(), name: n.name, content: n.content, keywords: n.keywords,
        is_regex: n.is_regex, case_sensitive: n.case_sensitive, always_active: n.always_active,
        enabled: n.enabled, priority: n.priority, scan_depth: n.scan_depth,
        inject_target: n.inject_target, inject_position: n.inject_position,
        insertion_depth: n.insertion_depth, character_card_id: cardId,
        created_at: now, updated_at: now
    }));
    entries.push(...added);
    await (0, wb_data_js_1.safeWriteEntries)(entries);
    return {
        success: true,
        message: normalized.warnings.length > 0 ? `已导入 ${added.length} 条，${normalized.warnings.length} 条提示` : `已导入 ${added.length} 条`,
        source_type: normalized.source, imported_count: added.length, warnings: normalized.warnings
    };
});
exports.list_character_cards_proxy = () => wrap(async () => {
    try {
        const result = await Tools.Chat.listCharacterCards();
        const cards = Array.isArray(result?.cards) ? result.cards : [];
        const list = cards.map((c) => ({
            id: String(c?.id || "").trim(), name: String(c?.name || "").trim(),
            description: String(c?.description || "").trim(), isDefault: c?.isDefault === true
        })).filter((c) => !!c.id);
        return { success: true, totalCount: list.length, cards: list };
    }
    catch (_e) {
        return { success: true, totalCount: 0, cards: [] };
    }
});
// ============ 7 个增强工具 ============
exports.wbplus_health = (params) => wrap(async () => {
    const entries = (await (0, wb_data_js_1.readEntries)()).filter((e) => !(0, task_expectation_bridge_js_1.isReservedEntry)(e));
    const t = Number(params?.oversized_threshold);
    return { success: true, report: (0, wb_data_js_1.healthCheck)(entries, Number.isFinite(t) && t > 0 ? t : 1200) };
});
exports.wbplus_dedupe = (params) => wrap(async () => {
    const entries = (await (0, wb_data_js_1.readEntries)()).filter((e) => !(0, task_expectation_bridge_js_1.isReservedEntry)(e));
    const clusters = (0, wb_data_js_1.findDuplicates)(entries);
    const action = String(params?.action || "scan").toLowerCase();
    if (action !== "merge")
        return { success: true, action: "scan", cluster_count: clusters.length, clusters };
    if (clusters.length === 0)
        return { success: true, action: "merge", removed_count: 0, removed: [], message: "无重复条目" };
    const keep = String(params?.keep || "newest").toLowerCase();
    const toRemove = new Set();
    const removed = [];
    for (const c of clusters) {
        const group = c.entry_ids.map((id) => entries.find((e) => e.id === id)).filter((e) => !!e);
        if (group.length < 2)
            continue;
        let keeper = group[0];
        if (keep === "oldest")
            keeper = group.reduce((a, b) => String(a.created_at || "") <= String(b.created_at || "") ? a : b);
        else if (keep === "highest_priority")
            keeper = group.reduce((a, b) => ((a.priority ?? 50) >= (b.priority ?? 50) ? a : b));
        else
            keeper = group.reduce((a, b) => String(a.updated_at || a.created_at || "") >= String(b.updated_at || b.created_at || "") ? a : b);
        for (const e of group) {
            if (e.id === keeper.id)
                continue;
            toRemove.add(e.id);
            removed.push({ id: e.id, name: e.name, reason: c.reason });
        }
    }
    const next = entries.filter((e) => !toRemove.has(e.id));
    await (0, wb_data_js_1.safeWriteEntries)(next);
    return { success: true, action: "merge", keep, removed_count: removed.length, remaining_count: next.length, removed };
});
exports.wbplus_budget = (params) => wrap(async () => {
    const entries = (await (0, wb_data_js_1.readEntries)()).filter((e) => !(0, task_expectation_bridge_js_1.isReservedEntry)(e));
    const budget = Number(params?.budget);
    if (!Number.isFinite(budget) || budget <= 0)
        return { success: false, message: "budget 必须是正数" };
    return { success: true, advice: (0, wb_data_js_1.budgetAdvice)(entries, budget) };
});
exports.wbplus_match = (params) => wrap(async () => {
    const text = String(params?.text || "");
    if (!text.trim())
        return { success: false, message: "text 不能为空" };
    const entries = (await (0, wb_data_js_1.readEntries)()).filter((e) => !(0, task_expectation_bridge_js_1.isReservedEntry)(e));
    const sens = Number.isFinite(Number(params?.sensitivity)) ? Number(params.sensitivity) : 0.7;
    const topK = num(params?.top_k, 0);
    const hits = (0, wb_data_js_1.matchEntriesScored)(entries, text, sens, topK);
    return {
        success: true, hit_count: hits.length, sensitivity: sens,
        hits: hits.map((e) => ({ id: e.id, name: e.name, score: e._match_score, matched_keys: e._matched_keys, priority: e.priority ?? 50 }))
    };
});
exports.wbplus_conflicts = (params) => wrap(async () => {
    const entries = (await (0, wb_data_js_1.readEntries)()).filter((e) => !(0, task_expectation_bridge_js_1.isReservedEntry)(e));
    const mc = Number(params?.min_count);
    const floor = Number.isFinite(mc) && mc >= 2 ? mc : 2;
    const conflicts = (0, wb_data_js_1.findKeywordConflicts)(entries).filter((c) => c.entry_ids.length >= floor);
    return { success: true, conflict_count: conflicts.length, conflicts };
});
exports.wbplus_export = (params) => wrap(async () => {
    let entries = (await (0, wb_data_js_1.readEntries)()).filter((e) => !(0, task_expectation_bridge_js_1.isReservedEntry)(e));
    if (params?.enabled_only === true)
        entries = entries.filter((e) => e.enabled !== false);
    const format = String(params?.format || "operit").toLowerCase();
    const payload = format === "sillytavern" ? (0, wb_data_js_1.toSillyTavernLorebook)(entries) : entries.map((e) => ({ ...e }));
    const json = JSON.stringify(payload, null, 2);
    const target = String(params?.path || "").trim();
    if (target) {
        await Tools.Files.write(target, json);
        return { success: true, format, entry_count: entries.length, written_to: target, bytes: json.length };
    }
    return { success: true, format, entry_count: entries.length, bytes: json.length, content: json };
});
async function readEventState() {
    try {
        const r = await Tools.Files.read(EVENT_FILE);
        const txt = String(r?.content || "").trim();
        if (!txt)
            return (0, wb_data_js_1.createDefaultEventState)();
        return (0, wb_data_js_1.normalizeEventState)(JSON.parse(txt));
    }
    catch (_e) {
        return (0, wb_data_js_1.createDefaultEventState)();
    }
}
async function writeEventState(st) {
    await Tools.Files.write(EVENT_FILE, JSON.stringify(st, null, 2));
}
exports.wbplus_event = (params) => wrap(async () => {
    const action = String(params?.action || "status").toLowerCase();
    let st = await readEventState();
    if (action === "reset") {
        st = (0, wb_data_js_1.createDefaultEventState)();
        await writeEventState(st);
        return { success: true, action: "reset", state: st, message: "事件状态已重置" };
    }
    if (action === "start") {
        st = (0, wb_data_js_1.startEvent)(st, {
            name: params?.name,
            chance: num(params?.chance, 0),
            resolutionDelay: num(params?.resolution_delay, 0),
            revealDelay: num(params?.reveal_delay, 0)
        });
        await writeEventState(st);
        return { success: true, action: "start", state: st };
    }
    if (action === "resolve") {
        st = (0, wb_data_js_1.resolveEvent)(st, num(params?.roll, 1));
        await writeEventState(st);
        return { success: true, action: "resolve", state: st };
    }
    if (action === "advance") {
        st = (0, wb_data_js_1.advanceDays)(st, num(params?.days, 1));
        await writeEventState(st);
        return { success: true, action: "advance", state: st };
    }
    if (action === "summary") {
        return { success: true, action: "summary", summary: (0, wb_data_js_1.buildEventSummary)(st), state: st };
    }
    return { success: true, action: "status", state: st, summary: (0, wb_data_js_1.buildEventSummary)(st) };
});
// ============ 增强工具实体（移植 quillplus / auto-worldbook） ============
exports.wbplus_activate = (params) => wrap(async () => {
    const action = String(params?.action || "check").toLowerCase();
    if (action === "check") {
        const text = String(params?.text || "");
        if (!text.trim())
            return { success: false, message: "text 不能为空" };
        const cfg = await (0, wb_data_js_1.readActivationConfig)();
        const r = (0, wb_data_js_1.detectActivation)(text, cfg);
        return { success: true, activated: r.activated, reason: r.reason, matched: r.matched, word_count: (0, wb_data_js_1.activationWordCount)(cfg) };
    }
    if (action === "get") {
        const cfg = await (0, wb_data_js_1.readActivationConfig)();
        return { success: true, config: cfg, word_count: (0, wb_data_js_1.activationWordCount)(cfg) };
    }
    if (action === "set") {
        const words = String(params?.words || "").split(/[,，]/).map((x) => x.trim()).filter((x) => x.length > 0);
        const exact = String(params?.exact_words || "").split(/[,，]/).map((x) => x.trim()).filter((x) => x.length > 0);
        await (0, wb_data_js_1.writeActivationConfig)({ activation_words: words, exact_match_words: exact });
        return { success: true, activation_words: words.length, exact_match_words: exact.length };
    }
    return { success: false, message: "action 需为 check/get/set" };
});
exports.wbplus_kb = (params) => wrap(async () => {
    const text = String(params?.text || "");
    if (!text.trim())
        return { success: false, message: "text 不能为空" };
    const entries = (await (0, wb_data_js_1.readEntries)()).filter((e) => !(0, task_expectation_bridge_js_1.isReservedEntry)(e));
    const inputLower = text.toLowerCase();
    const topK = num(params?.top_k, 5);
    const minScore = num(params?.min_score, 1);
    const scored = entries
        .filter((e) => e.enabled !== false)
        .map((e) => { const d = (0, wb_data_js_1.scoreEntryDetailed)(e, inputLower); return { e, score: d.score, matched: d.matched }; })
        .filter((x) => x.score >= minScore)
        .sort((a, b) => b.score - a.score || (b.e.priority || 50) - (a.e.priority || 50));
    const hits = topK > 0 ? scored.slice(0, topK) : scored;
    const out = { success: true, hit_count: hits.length, hits: hits.map((x) => ({ id: x.e.id, name: x.e.name, score: x.score, matched: x.matched })) };
    if (params?.reference)
        out.reference_text = (0, wb_data_js_1.buildReferenceText)(hits.map((x) => x.e));
    return out;
});
exports.wbplus_event_marker = (params) => wrap(async () => {
    const raw = await (0, wb_data_js_1.readEventStateRaw)();
    const marker = { v: 2, days: num(params?.days, 0), activity: String(params?.activity || "none"), risk: String(params?.risk || "none"), confirm: String(params?.confirm || "none"), close: params?.close === true };
    const res = (0, wb_data_js_1.applyAutomationMarker)(raw, marker, { autoResolve: params?.advance !== false });
    await (0, wb_data_js_1.writeEventStateRaw)(res.state);
    return { success: true, state: res.state, notices: res.notices };
});


exports.wbplus_recall_cfg = (params) => wrap(async () => {
    const P = "/sdcard/Download/Operit/plugins/com.operit.worldbook/recall_config.json";
    const action = String((params && params.action) || "get");
    if (action === "set") {
        const cfg = String((params && params.config) || "");
        if (!cfg)
            return { success: false, message: "config 为空" };
        await Tools.Files.mkdir("/sdcard/Download/Operit/plugins/com.operit.worldbook", true);
        await Tools.Files.write(P, cfg);
        return { success: true, message: "已保存" };
    }
    try {
        const r = await Tools.Files.read(P);
        const t = String((r && r.content) || "").trim();
        return { success: true, config: t };
    }
    catch (e) {
        return { success: true, config: "" };
    }
});
async function toolSelfApiCall(content) {
    let cfg = {};
    try {
        const r = await Tools.Files.read("/sdcard/Download/Operit/plugins/com.operit.worldbook/recall_config.json");
        const t = String((r && r.content) || "").trim();
        if (t)
            cfg = JSON.parse(t) || {};
    }
    catch (_e) { cfg = {}; }
    const base = String(cfg.apiBase || "").replace(/\/+$/, "");
    const key = String(cfg.apiKey || "");
    if (base && key) {
        const url = /\/chat\/completions$/.test(base) ? base : (base + "/chat/completions");
        const bodyObj = { model: String(cfg.model || "gpt-4o-mini"), messages: [{ role: "user", content: content }], temperature: 0 };
        const r2 = await Tools.Net.http({
            url: url,
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
            body: JSON.stringify(bodyObj),
            connect_timeout: 15,
            read_timeout: 60,
            validateStatus: false
        });
        const rawBody = String((r2 && r2.content) || "");
        const sc = (r2 && r2.statusCode) || 0;
        if (sc >= 400)
            throw new Error("HTTP " + sc + " | " + rawBody.slice(0, 300));
        let obj = null;
        try { obj = JSON.parse(rawBody); } catch (_pe) { obj = null; }
        if (obj && obj.choices && obj.choices[0]) {
            const ch0 = obj.choices[0];
            return { text: String((ch0.message && ch0.message.content) || ch0.text || "") };
        }
        return { text: rawBody };
    }
    return await Tools.Chat.call({ functionType: "CHAT", turns: [{ kind: "USER", content: content }], recordTokenUsage: false, enableThinking: false });
}
exports.wbplus_ai_judge = (params) => wrap(async () => {
    const probe = String((params && params.probe) || "").trim();
    if (!probe)
        return { success: false, message: "空探针" };
    const wb = await (0, wb_data_js_1.readEntries)();
    const aiEntries = (wb || []).filter((e) => e && e.enabled !== false && e.recall_mode === "ai");
    if (aiEntries.length === 0)
        return { success: true, count: 0, message: "无 recall_mode=ai 的条目", approved: [] };
    const lines = [];
    lines.push("你是世界书召回判定器。根据当前输入判断下列条目是否需要注入上下文。");
    lines.push("每条条目附有关键词，关键词是该条目最核心的触发线索，请重点参考；但不受关键词字面限制——语义相关、场景吻合也应判定召回。");
    lines.push("只输出 JSON 数组，元素形如 {\"i\": 序号, \"r\": true 或 false}，不要解释。");
    lines.push("");
    lines.push("【当前输入】");
    lines.push(probe);
    lines.push("");
    lines.push("【候选条目】");
    for (let i = 0; i < aiEntries.length; i += 1) {
        const e = aiEntries[i];
        const nm = String(e.name || e.id || "");
        const kw = Array.isArray(e.keywords) ? e.keywords.join("/") : "";
        const body = String(e.content || "").replace(/\s+/g, " ").slice(0, 200);
        lines.push((i + 1) + ". " + nm + (kw ? (" ｜ 关键词:" + kw) : "") + " ｜ " + body);
    }
    const res = await toolSelfApiCall(lines.join("\n"));
    const text = String((res && res.text) || "");
    try {
        await Tools.Files.mkdir("/sdcard/Download/Operit/plugins/com.operit.worldbook", true);
        await Tools.Files.write("/sdcard/Download/Operit/plugins/com.operit.worldbook/recall_ai_raw.log", text);
    }
    catch (_e) { }
    const parsed = [];
    const approved = [];
    let arr = null;
    try {
        let t = text.trim();
        t = t.replace(/<think[\s\S]*?<\/think>/gi, "");
        t = t.replace(/<thinking[\s\S]*?<\/thinking>/gi, "");
        t = t.replace(/<details[\s\S]*?<\/details>/gi, "");
        const lastClose = Math.max(t.lastIndexOf("</think>"), t.lastIndexOf("</thinking>"), t.lastIndexOf("</details>"));
        if (lastClose >= 0) t = t.slice(lastClose + 1).trim();
        t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
        const start = t.indexOf("[");
        const end = t.lastIndexOf("]");
        if (start >= 0 && end > start) {
            t = t.slice(start, end + 1);
        }
        arr = JSON.parse(t);
    }
    catch (pe) {
        return { success: false, message: "解析失败：" + pe.message, raw_head: text.slice(0, 400) };
    }
    if (!Array.isArray(arr)) {
        return { success: false, message: "解析结果非数组", raw_head: text.slice(0, 400) };
    }
    for (const it of arr) {
        const idx = parseInt(it && it.i, 10);
        const rec = !!(it && it.r === true);
        const nm2 = (idx >= 1 && idx <= aiEntries.length) ? String(aiEntries[idx - 1].name || aiEntries[idx - 1].id || "") : "?";
        parsed.push({ i: idx, r: rec, name: nm2 });
        if (rec && idx >= 1 && idx <= aiEntries.length)
            approved.push(String(aiEntries[idx - 1].id));
    }
    return {
        success: true,
        count: aiEntries.length,
        approved,
        details: parsed,
        raw_head: text.slice(0, 300)
    };
});
// ============ 任务预期 × 世界书增强 桥接工具 ============
exports.wbplus_te_status = (params) => wrap(async () => {
    const chatId = String(params?.chat_id || "").trim();
    const all = await (0, wb_data_js_1.readEntries)();
    const reserved = all.filter((e) => (0, task_expectation_bridge_js_1.isReservedEntry)(e));
    const resolved = chatId ? await (0, task_expectation_bridge_js_1.resolveExpectationForChat)(chatId) : null;
    return {
        success: true,
        chat_id: chatId,
        expectation_found: !!resolved,
        expectation: resolved ? resolved.expectation : null,
        reserved_entries: reserved.map((e) => ({ id: e.id, name: e.name, enabled: e.enabled !== false, priority: e.priority ?? 50 }))
    };
});
exports.wbplus_te_sync = (params) => wrap(async () => {
    const chatId = String(params?.chat_id || "").trim();
    if (!chatId)
        return { success: false, message: "chat_id 不能为空" };
    const r = await (0, task_expectation_bridge_js_1.syncExpectationEntry)(chatId);
    return { success: r.success, action: r.action, entry_id: r.entryId, reason: r.reason };
});
exports.wbplus_te_verify = (params) => wrap(async () => {
    const chatId = String(params?.chat_id || "").trim();
    if (!chatId)
        return { success: false, message: "chat_id 不能为空" };
    const r = await (0, task_expectation_bridge_js_1.applyExpectationVerify)(chatId, params?.passed === true);
    return { success: r.success, entry_id: r.entryId, passed: params?.passed === true };
});
exports.wbplus_te_remedy = (params) => wrap(async () => {
    const chatId = String(params?.chat_id || "").trim();
    if (!chatId)
        return { success: false, message: "chat_id 不能为空" };
    const r = await (0, task_expectation_bridge_js_1.raiseRemedyEntry)(chatId, String(params?.note || ""));
    return { success: r.success, entry_id: r.entryId };
});
// ============ 增强工具实体（移植 Lorebook-Manager / forced-world-info） ============
exports.wbplus_hide = (params) => wrap(async () => {
    const action = String(params?.action || "hide").toLowerCase();
    const ids = String(params?.ids || "").split(/[,，]/).map((x) => x.trim()).filter((x) => x.length > 0);
    if (action === "list") {
        const hidden = await (0, wb_data_js_1.readHiddenIds)();
        const entries = (await (0, wb_data_js_1.readEntries)()).filter((e) => !(0, task_expectation_bridge_js_1.isReservedEntry)(e));
        const map = new Map(entries.map((e) => [e.id, e.name]));
        return { success: true, hidden_count: hidden.length, hidden: hidden.map((id) => ({ id, name: map.get(id) || "(已不存在)" })) };
    }
    if (action === "clear") {
        const before = (await (0, wb_data_js_1.readHiddenIds)()).length;
        await (0, wb_data_js_1.writeHiddenIds)([]);
        return { success: true, cleared: before, message: `已恢复 ${before} 条隐藏条目` };
    }
    if (ids.length === 0)
        return { success: false, message: "ids 不能为空" };
    const cur = await (0, wb_data_js_1.readHiddenIds)();
    let next;
    if (action === "unhide") {
        const rm = new Set(ids);
        next = cur.filter((id) => !rm.has(id));
    }
    else if (action === "hide") {
        next = Array.from(new Set([...cur, ...ids]));
    }
    else {
        return { success: false, message: "action 需为 hide/unhide/list/clear" };
    }
    await (0, wb_data_js_1.writeHiddenIds)(next);
    return { success: true, action, affected: ids.length, hidden_count: next.length };
});
exports.wbplus_force = (params) => wrap(async () => {
    const action = String(params?.action || "add").toLowerCase();
    const scope = String(params?.scope || "default").toLowerCase();
    const chatId = String(params?.chat_id || "").trim();
    if (scope === "chat" && !chatId)
        return { success: false, message: "scope=chat 时必须提供 chat_id" };
    const cfg = await (0, wb_data_js_1.readForceConfig)();
    if (action === "list") {
        const entries = (await (0, wb_data_js_1.readEntries)()).filter((e) => !(0, task_expectation_bridge_js_1.isReservedEntry)(e));
        const map = new Map(entries.map((e) => [e.id, e.name]));
        const ids = Array.from((0, wb_data_js_1.forcedIdsForChat)(cfg, chatId));
        return { success: true, scope, default_count: cfg.default.length, chat_count: chatId ? (cfg.chats[chatId] || []).length : 0, effective: ids.map((id) => ({ id, name: map.get(id) || "(已不存在)" })) };
    }
    const ids = String(params?.ids || "").split(/[,，]/).map((x) => x.trim()).filter((x) => x.length > 0);
    if (action !== "set" && ids.length === 0)
        return { success: false, message: "ids 不能为空" };
    if (scope === "chat") {
        const cur = new Set(Array.isArray(cfg.chats[chatId]) ? cfg.chats[chatId] : []);
        if (action === "set")
            cfg.chats[chatId] = ids;
        else if (action === "remove")
            ids.forEach((id) => cur.delete(id));
        else
            ids.forEach((id) => cur.add(id));
        if (action !== "set")
            cfg.chats[chatId] = Array.from(cur);
    }
    else {
        const cur = new Set(Array.isArray(cfg.default) ? cfg.default : []);
        if (action === "set")
            cfg.default = ids;
        else if (action === "remove")
            ids.forEach((id) => cur.delete(id));
        else
            ids.forEach((id) => cur.add(id));
        if (action !== "set")
            cfg.default = Array.from(cur);
    }
    const clean = await (0, wb_data_js_1.writeForceConfig)(cfg);
    return { success: true, action, scope, default_count: clean.default.length, chat_count: chatId ? (clean.chats[chatId] || []).length : 0 };
});
exports.wbplus_orphans = (params) => wrap(async () => {
    const entries = (await (0, wb_data_js_1.readEntries)()).filter((e) => !(0, task_expectation_bridge_js_1.isReservedEntry)(e));
    const groups = await (0, wb_data_js_1.readGroups)();
    const rep = (0, wb_data_js_1.analyzeOrphans)(entries, groups);
    const appendTo = String(params?.append_to || "").trim();
    if (!appendTo || rep.orphan_count === 0)
        return { success: true, ...rep };
    const target = groups.find((g) => g.id === appendTo);
    if (!target)
        return { success: false, message: `分组不存在: ${appendTo}`, ...rep };
    const idSet = new Set(Array.isArray(target.entry_ids) ? target.entry_ids : []);
    for (const o of rep.orphans)
        idSet.add(o.id);
    target.entry_ids = Array.from(idSet);
    await (0, wb_data_js_1.writeGroups)(groups);
    return { success: true, appended_to: appendTo, appended_count: rep.orphan_count, orphan_count: 0, total_entries: rep.total_entries };
});
exports.wbplus_bindings = () => wrap(async () => {
    const entries = (await (0, wb_data_js_1.readEntries)()).filter((e) => !(0, task_expectation_bridge_js_1.isReservedEntry)(e));
    const groups = await (0, wb_data_js_1.readGroups)();
    return { success: true, overview: (0, wb_data_js_1.buildBindingOverview)(entries, groups) };
});
exports.wbplus_bulk = (params) => wrap(async () => {
    const action = String(params?.action || "").toLowerCase();
    if (!["enable", "disable", "delete", "set_priority", "bind_card"].includes(action))
        return { success: false, message: "action 需为 enable/disable/delete/set_priority/bind_card" };
    const entries = (await (0, wb_data_js_1.readEntries)()).filter((e) => !(0, task_expectation_bridge_js_1.isReservedEntry)(e));
    const ids = String(params?.ids || "").split(/[,，]/).map((x) => x.trim()).filter((x) => x.length > 0);
    const targets = (0, wb_data_js_1.resolveBulkTargets)(entries, {
        ids,
        filter_enabled: params?.filter_enabled === true,
        filter_disabled: params?.filter_disabled === true,
        filter_always_active: params?.filter_always_active === true,
        keyword: params?.keyword,
        name_contains: params?.name_contains
    });
    if (targets.length === 0)
        return { success: true, action, affected: 0, message: "无匹配条目" };
    const targetIds = new Set(targets.map((e) => e.id));
    const all = await (0, wb_data_js_1.readEntries)();
    let next = all;
    if (action === "delete") {
        const rm = new Set(targetIds);
        const next = all.filter((e) => !rm.has(e.id));
        await (0, wb_data_js_1.safeWriteEntries)(next);
        const groups = await (0, wb_data_js_1.readGroups)();
        let dirty = false;
        for (const g of groups) {
            const before = Array.isArray(g.entry_ids) ? g.entry_ids.length : 0;
            g.entry_ids = (Array.isArray(g.entry_ids) ? g.entry_ids : []).filter((id) => !rm.has(id));
            if (g.entry_ids.length !== before)
                dirty = true;
        }
        if (dirty)
            await (0, wb_data_js_1.writeGroups)(groups);
        const hidden = await (0, wb_data_js_1.readHiddenIds)();
        await (0, wb_data_js_1.writeHiddenIds(hidden.filter((id) => !rm.has(id))));
        return { success: true, action, affected: targetIds.size, remaining: next.length, groups_cleaned: dirty };
    }
    const now = new Date().toISOString();
    next = all.map((e) => {
        if ((0, task_expectation_bridge_js_1.isReservedEntry)(e) || !targetIds.has(e.id))
            return e;
        const n = { ...e, updated_at: now };
        if (action === "enable")
            n.enabled = true;
        else if (action === "disable")
            n.enabled = false;
        else if (action === "set_priority")
            n.priority = num(params?.priority, n.priority ?? 50);
        else if (action === "bind_card")
            n.character_card_id = String(params?.character_card_id || "").trim();
        return n;
    });
    await (0, wb_data_js_1.safeWriteEntries)(next);
    return { success: true, action, affected: targetIds.size };
});