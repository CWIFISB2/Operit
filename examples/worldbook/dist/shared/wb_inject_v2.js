"use strict";
Object.defineProperty(exports, ":esModule", { value: true });
exports.systemPromptHook = systemPromptHook;
exports.finalizeHook = finalizeHook;
exports.getLastDiag = getLastDiag;
// 世界书注入内核 v2 —— 接入层
//
// 与 v1 的差异：
//   v1：本文件内直接做关键词匹配 + 位置组装（简单但能力有限）
//   v2：本文件只负责「取数据 → 调引擎 → 组装注入」，
//       匹配/时效/递归/分组/预算全部交给 wb_engine 流水线
//
// 兼容性保证：
//   - hook 名称与签名不变（systemPromptHook / finalizeHook）
//   - 注入块格式不变（<worldbook><entry name="...">...</entry></worldbook>）
//   - 数据来源不变（wb_data 的 readEntries / readHiddenIds / readForceConfig）
//   - v1 的所有字段语义不变（keywords / always_active / priority / scan_depth /
//     is_regex / case_sensitive / inject_position / insertion_depth）
var wb_data_js_1 = require("./wb_data.js");
var wb_engine_js_1 = require("./wb_engine.js");
var wb_timing_js_1 = require("./wb_timing.js");
// v2 运行时配置（存在 recall_config.json 的同目录，或环境变量）
var V2_CONFIG_FILE = "worldbook_v2.json";
var lastDiag = null;
function getLastDiag() {
    return lastDiag;
}
function v2ConfigPath() {
    return String(wb_data_js_1.NATIVE_DIR || "") + "/" + V2_CONFIG_FILE;
}
var DEFAULT_CFG = {
    enabled: true,
    tokenBudget: 0,
    minActivations: 0,
    maxRecursionDepth: 5,
    stickyEnabled: true,
    appendToExisting: true,
};
async function readV2Config() {
    try {
        var r = await Tools.Files.read(v2ConfigPath());
        var txt = String((r && r.content) || "").trim();
        if (!txt)
            return Object.assign({}, DEFAULT_CFG);
        var cfg = JSON.parse(txt);
        return {
            enabled: cfg.enabled !== false,
            tokenBudget: Math.max(0, parseInt(cfg.tokenBudget, 10) || 0),
            minActivations: Math.max(0, parseInt(cfg.minActivations, 10) || 0),
            maxRecursionDepth: Math.max(0, parseInt(cfg.maxRecursionDepth, 10) || 5),
            stickyEnabled: cfg.stickyEnabled !== false,
            appendToExisting: cfg.appendToExisting !== false,
        };
    }
    catch (_e) {
        return Object.assign({}, DEFAULT_CFG);
    }
}
/** 消息序号：用累计用户消息数作为时效计的时钟。 */
function userMessageIndex(history) {
    if (!Array.isArray(history))
        return 0;
    var n = 0;
    for (var i = 0; i < history.length; i += 1) {
        if (history[i] && history[i].kind === "USER")
            n += 1;
    }
    return n;
}
/** 当前角色卡 id（用于 character_filter）。 */
async function resolveCurrentCharacterCardId(event) {
    try {
        var direct = typeof getCallerCardId === "function" ? getCallerCardId() : undefined;
        if (direct && String(direct).trim())
            return String(direct).trim();
    }
    catch (_e) { }
    try {
        var chatId = event && event.eventPayload && event.eventPayload.chatId;
        if (!chatId)
            return "";
        var chatResult = await Tools.Chat.findChat({ query: String(chatId), match: "exact", index: 0 });
        var cardName = String((chatResult && chatResult.chat && chatResult.chat.characterCardName) || "").trim();
        if (!cardName)
            return "";
        var cardResult = await Tools.Chat.listCharacterCards();
        var cards = Array.isArray(cardResult && cardResult.cards) ? cardResult.cards : [];
        for (var i = 0; i < cards.length; i += 1) {
            if (String((cards[i] && cards[i].name) || "").trim() === cardName) {
                return String(cards[i].id || "").trim();
            }
        }
        return "";
    }
    catch (_e) {
        return "";
    }
}
/**
 * character_filter 判定。
 *
 * 兼容两套写法：
 *   v1: character_card_id = "xxx"（单值，空表示全局）
 *   v2: characterFilter = { type: "include"|"exclude", names: [], tags: [] }
 */
function matchesCharacterFilter(entry, callerCardId) {
    // v2 结构化过滤
    var f = entry.characterFilter;
    if (f && typeof f === "object") {
        var type = String(f.type || "include");
        var names = Array.isArray(f.names) ? f.names : [];
        var tags = Array.isArray(f.tags) ? f.tags : [];
        if (names.length === 0 && tags.length === 0)
            return true; // 未设置 = 不限制
        var hit = false;
        if (callerCardId) {
            for (var i = 0; i < names.length; i += 1) {
                if (String(names[i]).trim() === callerCardId) {
                    hit = true;
                    break;
                }
            }
        }
        if (type === "exclude")
            return !hit;
        return hit;
    }
    // v1 单值
    var target = String(entry.character_card_id || "").trim();
    if (!target)
        return true;
    return !!callerCardId && callerCardId === target;
}
/** 取候选条目：enabled / hidden / forced / character / 常驻标记。 */
async function readCandidates(chatId, callerCardId) {
    var parsed = [];
    try {
        parsed = await wb_data_js_1.readEntries();
    }
    catch (_e) {
        return [];
    }
    var hiddenSet = {};
    try {
        var hidden = await wb_data_js_1.readHiddenIds();
        if (Array.isArray(hidden)) {
            for (var h = 0; h < hidden.length; h += 1)
                hiddenSet[String(hidden[h])] = true;
        }
    }
    catch (_e) { }
    var forced = {};
    try {
        var fcfg = await wb_data_js_1.readForceConfig();
        var fset = wb_data_js_1.forcedIdsForChat(fcfg, chatId);
        fset.forEach(function (id) { forced[String(id)] = true; });
    }
    catch (_e) { }
    var out = [];
    for (var i = 0; i < parsed.length; i += 1) {
        var e = parsed[i];
        if (!e)
            continue;
        if (e.enabled === false)
            continue;
        var id = String(e.id || "");
        var isForced = forced[id] === true;
        // 隐藏条目：除非本对话强制激活
        if (hiddenSet[id] === true && !isForced)
            continue;
        // 角色绑定
        if (!matchesCharacterFilter(e, callerCardId))
            continue;
        // 标记强制激活（供引擎当作 always）
        if (isForced)
            e._forced = true;
        // 清理上轮的匹配标记，防状态残留
        delete e._matched;
        out.push(e);
    }
    return out;
}
/** 构造扫描文本：raw + processed + scan_depth 条历史用户消息。 */
function buildScanText(payload, history, maxScanDepth) {
    var parts = [];
    if (payload.rawInput)
        parts.push(String(payload.rawInput));
    if (payload.processedInput && payload.processedInput !== payload.rawInput) {
        parts.push(String(payload.processedInput));
    }
    if (maxScanDepth > 0 && Array.isArray(history)) {
        var userTurns = [];
        for (var i = 0; i < history.length; i += 1) {
            var t = history[i];
            if (t && t.kind === "USER" && t.content)
                userTurns.push(String(t.content));
        }
        var start = Math.max(0, userTurns.length - maxScanDepth);
        for (var j = start; j < userTurns.length; j += 1)
            parts.push(userTurns[j]);
    }
    return parts.join("\n");
}
/** 取所有条目里最大的 scan_depth（作为全局扫描深度）。 */
function maxScanDepthOf(entries) {
    var m = 0;
    for (var i = 0; i < entries.length; i += 1) {
        var d = Number(entries[i].scan_depth);
        if (isFinite(d) && d > m)
            m = d;
    }
    return m;
}
// ============ systemPromptHook：常驻 system 条目 ============
async function systemPromptHook(event) {
    var stage = (event && (event.eventName || event.event)) || "";
    if (stage !== "after_compose_system_prompt")
        return null;
    try {
        var cfg = await readV2Config();
        if (!cfg.enabled)
            return null;
        var payload = (event && event.eventPayload) || {};
        var chatId = payload.chatId;
        var callerCardId = await resolveCurrentCharacterCardId(event);
        var all = await readCandidates(chatId, callerCardId);
        // 只取 system 目标 + 非 at_depth（at_depth 走 finalize）
        var sysEntries = [];
        for (var i = 0; i < all.length; i += 1) {
            var e = all[i];
            var pos = wb_engine_js_1.normalizeInjectPosition(e);
            if (pos === "at_depth")
                continue;
            var target = wb_engine_js_1.toPromptTurnKind(e);
            if (target !== "SYSTEM")
                continue;
            sysEntries.push(e);
        }
        if (sysEntries.length === 0)
            return null;
        // 常驻条目直接注入（system hook 只负责常驻部分，关键词触发走 finalize）
        var always = [];
        for (var j = 0; j < sysEntries.length; j += 1) {
            var se = sysEntries[j];
            if (se.always_active === true || se._forced === true)
                always.push(se);
        }
        if (always.length === 0)
            return null;
        var currentPrompt = String(payload.systemPrompt || "");
        var split = wb_engine_js_1.splitByPosition(always);
        var parts = [];
        if (split.prependEntries.length > 0)
            parts.push(wb_engine_js_1.buildInjection(split.prependEntries));
        if (currentPrompt)
            parts.push(currentPrompt);
        if (split.appendEntries.length > 0)
            parts.push(wb_engine_js_1.buildInjection(split.appendEntries));
        lastDiag = {
            stage: "system",
            alwaysCount: always.length,
            injected: always.map(function (x) { return String(x.name || x.id || ""); }),
        };
        return { systemPrompt: parts.join("\n") };
    }
    catch (err) {
        console.log("[WBV2_SYS_ERR] " + String((err && err.message) || err));
        return null;
    }
}
// ============ finalizeHook：关键词 / 递归 / 分组 / 预算 ============
async function finalizeHook(event) {
    var stage = (event && (event.eventName || event.event)) || "";
    if (stage !== "before_finalize_prompt")
        return null;
    try {
        var cfg = await readV2Config();
        if (!cfg.enabled)
            return null;
        var payload = (event && event.eventPayload) || {};
        var chatId = payload.chatId;
        var history = payload.preparedHistory || payload.chatHistory || [];
        var callerCardId = await resolveCurrentCharacterCardId(event);
        var all = await readCandidates(chatId, callerCardId);
        if (all.length === 0)
            return null;
        // 只处理「非 system 常驻」的部分：user / assistant 目标 + at_depth
        // system 常驻已在 systemPromptHook 处理
        var candidates = [];
        for (var i = 0; i < all.length; i += 1) {
            var e = all[i];
            var pos = wb_engine_js_1.normalizeInjectPosition(e);
            var target = wb_engine_js_1.toPromptTurnKind(e);
            var isAlwaysSys = (e.always_active === true || e._forced === true) && target === "SYSTEM" && pos !== "at_depth";
            if (isAlwaysSys)
                continue; // 已由 system hook 注入
            candidates.push(e);
        }
        if (candidates.length === 0)
            return null;
        // 扫描文本
        var scanDepth = maxScanDepthOf(candidates);
        var scanText = buildScanText(payload, history, scanDepth);
        if (!scanText && candidates.every(function (x) { return x.always_active !== true; })) {
            return null;
        }
        // 消息时钟（时效用）
        var msgIndex = userMessageIndex(history);
        // 跑引擎
        var result = wb_engine_js_1.runPipeline(candidates, scanText, msgIndex, {
            tokenBudget: cfg.tokenBudget,
            minActivations: cfg.minActivations,
            maxRecursionDepth: cfg.maxRecursionDepth,
        });
        var hits = result.entries;
        lastDiag = {
            stage: "finalize",
            msgIndex: msgIndex,
            scanTextLen: scanText.length,
            candidates: candidates.length,
            diag: result.diag,
            injected: hits.map(function (x) { return String(x.name || x.id || ""); }),
        };
        if (hits.length === 0)
            return null;
        // 按目标分流
        var hitSystem = [];
        var hitUser = [];
        var hitChat = [];
        for (var k = 0; k < hits.length; k += 1) {
            var he = hits[k];
            var hpos = wb_engine_js_1.normalizeInjectPosition(he);
            var htarget = wb_engine_js_1.toPromptTurnKind(he);
            if (hpos === "at_depth" || htarget === "ASSISTANT")
                hitChat.push(he);
            else if (htarget === "USER")
                hitUser.push(he);
            else
                hitSystem.push(he);
        }
        // ---- 组装 ----
        var nextHistory = history.slice();
        var nextProcessedInput = String(payload.processedInput || payload.rawInput || "");
        // ① system 目标：注入到第一条 SYSTEM turn
        if (hitSystem.length > 0) {
            var sysSplit = wb_engine_js_1.splitByPosition(hitSystem);
            var injected = false;
            var sysNext = [];
            for (var s = 0; s < nextHistory.length; s += 1) {
                var turn = nextHistory[s];
                if (!injected && turn && turn.kind === "SYSTEM") {
                    var base = String(turn.content || "");
                    var ps = [];
                    if (sysSplit.prependEntries.length > 0)
                        ps.push(wb_engine_js_1.buildInjection(sysSplit.prependEntries));
                    if (base)
                        ps.push(base);
                    if (sysSplit.appendEntries.length > 0)
                        ps.push(wb_engine_js_1.buildInjection(sysSplit.appendEntries));
                    sysNext.push(Object.assign({}, turn, { content: ps.join("\n") }));
                    injected = true;
                    continue;
                }
                sysNext.push(turn);
            }
            if (!injected) {
                var ps2 = [];
                if (sysSplit.prependEntries.length > 0)
                    ps2.push(wb_engine_js_1.buildInjection(sysSplit.prependEntries));
                if (sysSplit.appendEntries.length > 0)
                    ps2.push(wb_engine_js_1.buildInjection(sysSplit.appendEntries));
                sysNext.unshift({ kind: "SYSTEM", content: ps2.join("\n") });
            }
            nextHistory = sysNext;
        }
        // ② user 目标：追加到当前输入
        if (hitUser.length > 0) {
            var userSplit = wb_engine_js_1.splitByPosition(hitUser);
            var ups = [];
            if (userSplit.prependEntries.length > 0)
                ups.push(wb_engine_js_1.buildInjection(userSplit.prependEntries));
            if (nextProcessedInput)
                ups.push(nextProcessedInput);
            if (userSplit.appendEntries.length > 0)
                ups.push(wb_engine_js_1.buildInjection(userSplit.appendEntries));
            nextProcessedInput = ups.join("\n");
        }
        // ③ at_depth / assistant 目标：按深度插入历史
        if (hitChat.length > 0) {
            nextHistory = wb_engine_js_1.insertAtDepth(nextHistory, hitChat);
        }
        return { preparedHistory: nextHistory, processedInput: nextProcessedInput };
    }
    catch (err) {
        console.log("[WBV2_FIN_ERR] " + String((err && err.message) || err));
        return null;
    }
}