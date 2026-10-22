"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TE_REMEDY_NAME = exports.TE_CONSTRAINT_NAME = exports.TE_STATE_FILE = exports.TE_RESERVED_PREFIX = void 0;
exports.isReservedEntry = isReservedEntry;
exports.reservedEntryChatId = reservedEntryChatId;
exports.isReservedEntryForChat = isReservedEntryForChat;
exports.resolveExpectationForChat = resolveExpectationForChat;
exports.syncExpectationEntry = syncExpectationEntry;
exports.applyExpectationVerify = applyExpectationVerify;
exports.raiseRemedyEntry = raiseRemedyEntry;
exports.autoSyncExpectationEntries = autoSyncExpectationEntries;
// 任务预期 × 世界书增强 桥接层
// 职责：以 worldbook_plus 为中心，把 task_expectation 的对话级约束
// 落成一条保留世界书条目（__te__ 前缀），由常驻 system 注入内核自动生效。
// task_expectation 只提供 state.json 作为约束源，本模块单向读取 + 落条目。
const wb_data_js_1 = require("./wb_data.js");
exports.TE_RESERVED_PREFIX = "__te__";
exports.TE_STATE_FILE = "/sdcard/Download/Operit/plugins/com.operit.task_expectation/state.json";
exports.TE_CONSTRAINT_NAME = "__te__约束";
exports.TE_REMEDY_NAME = "__te__补救";
function isReservedEntry(entry) {
    return String(entry?.name || "").startsWith(exports.TE_RESERVED_PREFIX);
}
// 从保留条目 id 反解其源对话 chatId（te__<chatId> / te_remedy__<chatId>）
function reservedEntryChatId(entry) {
    const id = String(entry?.id || "");
    if (id.startsWith("te_remedy__"))
        return id.slice("te_remedy__".length);
    if (id.startsWith("te__"))
        return id.slice("te__".length);
    return null;
}
// 保留条目只在其源对话内生效，避免全局注入污染其它对话
function isReservedEntryForChat(entry, chatId) {
    return reservedEntryChatId(entry) === String(chatId || "").trim();
}
async function readTEState() {
    try {
        const r = await Tools.Files.read(exports.TE_STATE_FILE);
        const txt = String(r?.content || "").trim();
        if (!txt)
            return { version: 2, chats: {} };
        const parsed = JSON.parse(txt);
        if (parsed && typeof parsed === "object" && parsed.chats && typeof parsed.chats === "object") {
            return parsed;
        }
        return { version: 2, chats: {} };
    }
    catch (_e) {
        return { version: 2, chats: {} };
    }
}
// 解析当前 chatId 对应的 TE state 键：先按 chatId 精确匹配，再按对话标题匹配
async function resolveExpectationForChat(chatId) {
    const normalizedChatId = String(chatId || "").trim();
    if (!normalizedChatId)
        return null;
    const state = await readTEState();
    const chats = state.chats || {};
    if (chats[normalizedChatId]?.expectation) {
        return { key: normalizedChatId, expectation: chats[normalizedChatId].expectation };
    }
    // 回退：state.json 的键可能是对话标题而非 chatId
    let title = "";
    try {
        const found = await Tools.Chat.findChat({ query: normalizedChatId, match: "exact", index: 0 });
        const chat = found?.chat || {};
        title = String(chat.name || chat.title || "").trim();
    }
    catch (_e) { }
    if (title && chats[title]?.expectation) {
        return { key: title, expectation: chats[title].expectation };
    }
    // 再退一步：仅有一个 active 预期时，孤键也认领（单会话常见态）
    const activeKeys = Object.keys(chats).filter((k) => chats[k]?.expectation?.active === true);
    if (!title && activeKeys.length === 1) {
        return { key: activeKeys[0], expectation: chats[activeKeys[0]].expectation };
    }
    return null;
}
function constraintEntryId(chatId) {
    return `te__${String(chatId || "").trim()}`;
}
// 约束条目内容：纯文本，不做变量渲染，避免约束文本被变量解析改写
function buildConstraintContent(exp) {
    const title = String(exp.title || "全局任务预期").trim();
    const body = String(exp.content || "").trim();
    return [`【任务预期·强制约束】`, `标题：${title}`, `要求：${body}`, `请在所有后续任务中优先满足以上要求，完成后再继续。`].join("\n");
}
// 把当前对话的预期 upsert 成保留条目；预期消失/失效则禁用该条目（不删除，留痕）
async function syncExpectationEntry(chatId) {
    const normalizedChatId = String(chatId || "").trim();
    if (!normalizedChatId)
        return { success: false, action: "noop", reason: "chatId 为空" };
    const resolved = await resolveExpectationForChat(normalizedChatId);
    const entries = await (0, wb_data_js_1.readEntries)();
    const entryId = constraintEntryId(normalizedChatId);
    const idx = entries.findIndex((e) => e.id === entryId);
    const active = !!resolved && resolved.expectation.active === true &&
        String(resolved.expectation.content || "").trim().length > 0;
    if (!active) {
        if (idx !== -1 && entries[idx].enabled !== false) {
            entries[idx] = { ...entries[idx], enabled: false, updated_at: new Date().toISOString() };
            await (0, wb_data_js_1.safeWriteEntries)(entries);
            return { success: true, action: "disable", entryId, reason: "无有效预期，已禁用保留条目" };
        }
        return { success: true, action: "noop", entryId };
    }
    const now = new Date().toISOString();
    const desired = {
        id: entryId,
        name: exports.TE_CONSTRAINT_NAME,
        content: buildConstraintContent(resolved.expectation),
        keywords: [],
        is_regex: false,
        case_sensitive: false,
        always_active: true,
        enabled: true,
        priority: 999,
        scan_depth: 0,
        inject_target: "system",
        inject_position: "prepend",
        insertion_depth: 0,
        character_card_id: "",
        created_at: idx !== -1 ? entries[idx].created_at : now,
        updated_at: now
    };
    if (idx !== -1 &&
        entries[idx].content === desired.content &&
        entries[idx].enabled === true &&
        entries[idx].always_active === true &&
        entries[idx].inject_target === "system" &&
        (entries[idx].inject_position || "append") === "prepend") {
        return { success: true, action: "noop", entryId, reason: "内容未变" };
    }
    if (idx === -1)
        entries.push(desired);
    else
        entries[idx] = desired;
    await (0, wb_data_js_1.safeWriteEntries)(entries);
    return { success: true, action: "upsert", entryId };
}
// flip 校验结果影响注入位置：未满足 → 强制 prepend 高优先；满足 → 降为 append
async function applyExpectationVerify(chatId, passed) {
    const entryId = constraintEntryId(chatId);
    const entries = await (0, wb_data_js_1.readEntries)();
    const idx = entries.findIndex((e) => e.id === entryId);
    if (idx === -1)
        return { success: false };
    entries[idx] = {
        ...entries[idx],
        inject_position: passed ? "append" : "prepend",
        priority: passed ? 500 : 999,
        updated_at: new Date().toISOString()
    };
    await (0, wb_data_js_1.safeWriteEntries)(entries);
    return { success: true, entryId };
}
// 失败熔断：report(false) 时写出补救条目
async function raiseRemedyEntry(chatId, note) {
    const entryId = `te_remedy__${String(chatId || "").trim()}`;
    const entries = await (0, wb_data_js_1.readEntries)();
    const idx = entries.findIndex((e) => e.id === entryId);
    const now = new Date().toISOString();
    const remedy = {
        id: entryId,
        name: exports.TE_REMEDY_NAME,
        content: `【任务预期·纠偏】上一轮未满足强制预期。请立即回退到预期轨道并补齐缺失要求。\n备注：${String(note || "").trim() || "（无）"}`,
        keywords: [],
        is_regex: false,
        case_sensitive: false,
        always_active: true,
        enabled: true,
        priority: 998,
        scan_depth: 0,
        inject_target: "system",
        inject_position: "prepend",
        insertion_depth: 0,
        character_card_id: "",
        created_at: idx !== -1 ? entries[idx].created_at : now,
        updated_at: now
    };
    if (idx === -1)
        entries.push(remedy);
    else
        entries[idx] = remedy;
    await (0, wb_data_js_1.safeWriteEntries)(entries);
    return { success: true, entryId };
}
// hook 前置自动同步：读一次小 json，未变则 noop，成本极低
const _syncCache = new Map();
async function autoSyncExpectationEntries(chatId) {
    const cid = String(chatId || "").trim();
    if (!cid)
        return;
    try {
        // 先读轻量 TE state，算出指纹；指纹未变则跳过昂贵的 entries 读写
        const resolved = await resolveExpectationForChat(cid);
        const fingerprint = resolved
            ? `${resolved.expectation.active === true}|${String(resolved.expectation.content || "")}|${String(resolved.expectation.title || "")}`
            : "none";
        if (_syncCache.get(cid) === fingerprint)
            return;
        const r = await syncExpectationEntry(cid);
        if (r.success)
            _syncCache.set(cid, fingerprint);
    }
    catch (_e) { }
}
