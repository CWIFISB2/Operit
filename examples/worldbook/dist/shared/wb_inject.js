"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemPromptHook = systemPromptHook;
exports.finalizeHook = finalizeHook;
// 世界书注入内核：完整实现官方 com.operit.worldbook 的双 hook 注入逻辑
// systemPromptComposeHook：常驻 system 条目注入
// promptFinalizeHook：关键词/用户/对话中（at_depth）注入
const wb_data_js_1 = require("./wb_data.js");
function matchesEntry(entry, text) {
    if (!entry.keywords || entry.keywords.length === 0)
        return false;
    for (const keyword of entry.keywords) {
        if (!keyword)
            continue;
        try {
            if (entry.is_regex) {
                if (new RegExp(keyword, entry.case_sensitive ? "g" : "gi").test(text))
                    return true;
                continue;
            }
            if (entry.case_sensitive) {
                if (text.includes(keyword))
                    return true;
            }
            else {
                const lower = text.toLowerCase();
                const nk = keyword.toLowerCase();
                if (text.includes(keyword) || lower.includes(nk))
                    return true;
                // 短词兜底：1-2 字关键词在 trigram 下结构上无法命中，走输入侧短词集合
                if (nk.length < wb_data_js_1.TRIGRAM_MIN_LEN && (0, wb_data_js_1.shortTokens)(text).some((s) => lower.includes(s.toLowerCase())))
                    return true;
            }
        }
        catch (_e) { }
    }
    return false;
}
function buildInjection(entries) {
    const parts = ["<worldbook>"];
    for (const entry of entries) {
        parts.push(`<entry name="${entry.name}">`);
        parts.push(entry.content);
        parts.push("</entry>");
    }
    parts.push("</worldbook>");
    return parts.join("\n");
}
function normalizeInjectPosition(entry) {
    return entry.inject_position === "prepend" || entry.inject_position === "at_depth" ? entry.inject_position : "append";
}
function applyTextInjection(baseText, prependEntries, appendEntries) {
    const parts = [];
    if (prependEntries.length > 0)
        parts.push(buildInjection(prependEntries));
    if (baseText)
        parts.push(baseText);
    if (appendEntries.length > 0)
        parts.push(buildInjection(appendEntries));
    return parts.join("\n");
}
function splitEntriesByPosition(entries) {
    const prependEntries = [];
    const appendEntries = [];
    for (const entry of entries) {
        if (normalizeInjectPosition(entry) === "prepend")
            prependEntries.push(entry);
        else
            appendEntries.push(entry);
    }
    return { prependEntries, appendEntries };
}
function toPromptTurnKind(entry) {
    if (entry.inject_target === "assistant")
        return "ASSISTANT";
    if (entry.inject_target === "user")
        return "USER";
    return "SYSTEM";
}
function insertAtDepthEntries(history, entries) {
    if (entries.length === 0)
        return history;
    const grouped = new Map();
    for (const entry of entries) {
        const depth = Math.max(0, Number(entry.insertion_depth ?? 0) || 0);
        const kind = toPromptTurnKind(entry);
        const key = `${kind}:${depth}`;
        const g = grouped.get(key);
        if (g) {
            g.entries.push(entry);
            continue;
        }
        grouped.set(key, { depth, kind, entries: [entry] });
    }
    const nextHistory = [...history];
    const groups = [...grouped.values()].sort((a, b) => b.depth - a.depth);
    for (const group of groups) {
        const idx = Math.max(0, nextHistory.length - group.depth);
        nextHistory.splice(idx, 0, { kind: group.kind, content: buildInjection(group.entries) });
    }
    return nextHistory;
}
function matchesCharacterCard(entry, callerCardId) {
    const target = String(entry.character_card_id || "").trim();
    if (!target)
        return true;
    return !!callerCardId && callerCardId === target;
}
async function resolveCurrentCharacterCardId(event) {
    try {
        const direct = typeof getCallerCardId === "function" ? getCallerCardId() : undefined;
        if (direct && String(direct).trim())
            return String(direct).trim();
    }
    catch (_e) { }
    try {
        const chatId = event?.eventPayload?.chatId;
        if (!chatId)
            return "";
        const chatResult = await Tools.Chat.findChat({ query: String(chatId), match: "exact", index: 0 });
        const cardName = String(chatResult?.chat?.characterCardName || "").trim();
        if (!cardName)
            return "";
        const cardResult = await Tools.Chat.listCharacterCards();
        const cards = Array.isArray(cardResult?.cards) ? cardResult.cards : [];
        const matched = cards.find((c) => String(c?.name || "").trim() === cardName);
        return matched?.id ? String(matched.id).trim() : "";
    }
    catch (_e) {
        return "";
    }
}
async function readEnabledEntries(chatId) {
    try {
        const parsed = await (0, wb_data_js_1.readEntries)();
        // 隐藏条目：从注入中排除（除非被本对话强制激活）
        let hidden = [];
        try {
            hidden = await (0, wb_data_js_1.readHiddenIds)();
        }
        catch (_he) {
            hidden = [];
        }
        // 强制激活：default + 当前对话覆盖
        let forced = new Set();
        try {
            const fcfg = await (0, wb_data_js_1.readForceConfig)();
            forced = (0, wb_data_js_1.forcedIdsForChat)(fcfg, chatId);
        }
        catch (_fe) {
            forced = new Set();
        }
        const hiddenSet = new Set(Array.isArray(hidden) ? hidden : []);
        const enabled = parsed
            .filter((e) => e && e.enabled !== false)
            .filter((e) => forced.has(String(e.id)) || !hiddenSet.has(String(e.id)))
            .map((e) => forced.has(String(e.id)) ? { ...e, _forced: true } : e);
        enabled.sort((a, b) => (b.priority || 50) - (a.priority || 50));
        return enabled;
    }
    catch (_e) {
        return [];
    }
}
function recallConfigPath() {
    return String(wb_data_js_1.NATIVE_DIR || "") + "/recall_config.json";
}
async function readRecallConfig() {
    const dft = { enabled: false, mode: "keyword", batchSize: 20, timeoutMs: 8000, apiBase: "", apiKey: "", model: "" };
    try {
        const r = await Tools.Files.read(recallConfigPath());
        const txt = String((r && r.content) || "").trim();
        if (!txt)
            return dft;
        const cfg = JSON.parse(txt);
        return {
            enabled: cfg.enabled === true,
            mode: cfg.mode === "ai" ? "ai" : "keyword",
            batchSize: Math.max(1, parseInt(cfg.batchSize, 10) || 20),
            timeoutMs: Math.max(1000, parseInt(cfg.timeoutMs, 10) || 8000),
            apiBase: String(cfg.apiBase || ""),
            apiKey: String(cfg.apiKey || ""),
            model: String(cfg.model || "")
        };
    }
    catch (_e) {
        return dft;
    }
}
function recallDebugPath() {
    return String(wb_data_js_1.NATIVE_DIR || "") + "/recall_debug.log";
}
async function recallLog(line) {
    console.log("[WBPLUS_LOG] " + line);
    try {
        const p = recallDebugPath();
        let old = "";
        try {
            const r = await Tools.Files.read(p);
            old = String((r && r.content) || "");
        }
        catch (_e) { old = ""; }
        let next = old + "\n" + line;
        if (next.length > 12000)
            next = next.slice(next.length - 12000);
        await Tools.Files.write(p, next);
    }
    catch (_e) { }
}
async function selfApiCall(content, cfg) {
    const base = String(cfg.apiBase || "").replace(/\/+$/, "");
    const key = String(cfg.apiKey || "");
    if (!base || !key)
        return await Tools.Chat.call({ functionType: "CHAT", turns: [{ kind: "USER", content: content }], recordTokenUsage: false, enableThinking: false });
    const bodyObj = { model: String(cfg.model || "gpt-4o-mini"), messages: [{ role: "user", content: content }], temperature: 0 };
    const r = await Tools.Net.http({
        url: /\/chat\/completions$/.test(base) ? base : (base + "/chat/completions"),
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
        body: JSON.stringify(bodyObj),
        connect_timeout: Math.min(10, Math.ceil(cfg.timeoutMs / 1000)),
        read_timeout: Math.ceil(cfg.timeoutMs / 1000) + 5,
        validateStatus: false
    });
    const rawBody = String((r && r.content) || "");
    const sc = (r && r.statusCode) || 0;
    if (sc >= 400)
        throw new Error("HTTP " + sc + " | " + rawBody.slice(0, 200));
    let obj = null;
    try { obj = JSON.parse(rawBody); } catch (_pe) { obj = null; }
    if (obj && obj.choices && obj.choices[0]) {
        const ch0 = obj.choices[0];
        return { text: String((ch0.message && ch0.message.content) || ch0.text || "") };
    }
    return { text: rawBody };
}

async function aiJudgeBatch(batch, userText, cfg) {
    const lines = [];
    lines.push("你是世界书召回判定器。根据当前输入判断下列条目是否需要注入上下文。");
    lines.push("每条条目附有关键词，关键词是该条目最核心的触发线索，请重点参考；但不受关键词字面限制——语义相关、场景吻合也应判定召回。");
    lines.push("只输出 JSON 数组，元素形如 {\"i\": 序号, \"r\": true 或 false}，不要解释。");
    lines.push("");
    lines.push("【当前输入】");
    lines.push(userText || "（空）");
    lines.push("");
    lines.push("【候选条目】");
    for (let i = 0; i < batch.length; i += 1) {
        const e = batch[i];
        const nm = String(e.name || e.id || "");
        const kw = Array.isArray(e.keywords) ? e.keywords.join("/") : "";
        const body = String(e.content || "").replace(/\s+/g, " ").slice(0, 200);
        lines.push((i + 1) + ". " + nm + (kw ? (" ｜ 关键词:" + kw) : "") + " ｜ " + body);
    }
    let text = "";
    try {
        const res = await Promise.race([
            selfApiCall(lines.join("\n"), cfg),
            new Promise(function (_ok, bad) {
                setTimeout(function () { bad(new Error("ai_recall_timeout")); }, cfg.timeoutMs);
            })
        ]);
        text = String((res && res.text) || "");
    }
    catch (_e) {
        await recallLog("[AI_CALL_FAIL] " + String((_e && _e.message) || _e));
        return null;
    }
    await recallLog("[AI_RAW] " + text.slice(0, 400));
    try {
        let tt = text;
        tt = tt.replace(/<think[\s\S]*?<\/think>/gi, "");
        tt = tt.replace(/<thinking[\s\S]*?<\/thinking>/gi, "");
        tt = tt.replace(/<details[\s\S]*?<\/details>/gi, "");
        const lc = Math.max(tt.lastIndexOf("</think>"), tt.lastIndexOf("</thinking>"), tt.lastIndexOf("</details>"));
        if (lc >= 0) tt = tt.slice(lc + 1);
        const m = tt.match(/\[[\s\S]*\]/);
        const arr = JSON.parse(m ? m[0] : tt);
        if (!Array.isArray(arr))
            return null;
        const approved = new Set();
        for (const it of arr) {
            if (!it || it.r !== true)
                continue;
            const idx = parseInt(it.i, 10);
            if (idx >= 1 && idx <= batch.length)
                approved.add(String(batch[idx - 1].id || ""));
        }
        return approved;
    }
    catch (_e) {
        return null;
    }
}
async function aiJudgeEntries(entries, payload, cfg) {
    const userText = String(payload.rawInput || payload.processedInput || "").slice(0, 4000);
    const approved = new Set();
    const size = cfg.batchSize;
    await recallLog("[JUDGE_START] n=" + entries.length + " | input=" + userText.slice(0, 200));
    for (let s = 0; s < entries.length; s += size) {
        const got = await aiJudgeBatch(entries.slice(s, s + size), userText, cfg);
        if (!got) {
            await recallLog("[JUDGE_BATCH_FAIL] idx=" + s);
            return null;
        }
        await recallLog("[JUDGE_BATCH_OK] idx=" + s + " | approved=" + Array.from(got).join(","));
        got.forEach(function (id) { approved.add(id); });
    }
    await recallLog("[JUDGE_DONE] approved=" + Array.from(approved).join(","));
    return approved;
}
async function systemPromptHook(event) {
    const stage = event.eventName || event.event;
    console.log("[WBPLUS_SYS_ENTER] stage=" + String(stage));
    await recallLog("[SYS_ENTER] stage=" + String(stage));
    if (stage !== "after_compose_system_prompt")
        return null;
    const enabledEntries = await readEnabledEntries(event?.eventPayload?.chatId);
    const callerCardId = await resolveCurrentCharacterCardId(event);
    const hit = enabledEntries.filter((e) => (e.always_active || e._forced) && e.inject_target === "system" &&
        normalizeInjectPosition(e) !== "at_depth" &&
        matchesCharacterCard(e, callerCardId));
    if (hit.length === 0)
        return null;
    const currentPrompt = event.eventPayload?.systemPrompt || "";
    const { prependEntries, appendEntries } = splitEntriesByPosition(hit);
    return { systemPrompt: applyTextInjection(currentPrompt, prependEntries, appendEntries) };
}
async function finalizeHook(event) {
    const stage = event.eventName || event.event;
    console.log("[WBPLUS_FIN_ENTER] stage=" + String(stage));
    await recallLog("[FIN_ENTER] stage=" + String(stage));
    if (stage !== "before_finalize_prompt")
        return null;
    const enabledEntries = await readEnabledEntries(event?.eventPayload?.chatId);
    const promptEntries = enabledEntries.filter((e) => e.inject_target === "user" || normalizeInjectPosition(e) === "at_depth");
    let keywordEntries = enabledEntries.filter((e) => !e.always_active);
    const payload = event.eventPayload || {};
    let aiRecallSet = null;
    // 激活门控（移植自 quillplus activation.py 三路检测）：
    // 仅当配置了激活词、且当前消息命中（子串/词边界/CJK方括号）时，才放行关键词注入；常驻条目不收门控。
    try {
        const actCfg = await (0, wb_data_js_1.readActivationConfig)();
        if ((0, wb_data_js_1.activationWordCount)(actCfg) > 0) {
            const gateText = String(payload.rawInput || payload.processedInput || "");
            const act = (0, wb_data_js_1.detectActivation)(gateText, actCfg);
            if (!act.activated)
                keywordEntries = keywordEntries.filter((e) => e.recall_mode === "ai");
        }
    }
    catch (_e) { }
    const aiModeEntries = keywordEntries.filter((e) => e.recall_mode === "ai");
    await recallLog("[AI_ENTRIES] ai=" + aiModeEntries.length + " keyword=" + keywordEntries.length + " | ids=" + aiModeEntries.map(function (e) { return String(e.id || ""); }).join(","));
    if (aiModeEntries.length > 0) {
        try {
            const rc1 = await readRecallConfig();
            aiRecallSet = await aiJudgeEntries(aiModeEntries, payload, rc1);
        }
        catch (_e) {
            await recallLog("[JUDGE_THROW] " + String((_e && _e.message) || _e));
            aiRecallSet = null;
        }
    }
    const history = (payload.preparedHistory || payload.chatHistory || []);
    const callerCardId = await resolveCurrentCharacterCardId(event);
    const hitSystem = [];
    const hitUser = [];
    const hitChat = [];
    for (const entry of promptEntries) {
        if (!matchesCharacterCard(entry, callerCardId))
            continue;
        if (entry.always_active) {
            if (normalizeInjectPosition(entry) === "at_depth" || entry.inject_target === "assistant")
                hitChat.push(entry);
            else
                hitUser.push(entry);
        }
    }
    for (const entry of keywordEntries) {
        if (!matchesCharacterCard(entry, callerCardId))
            continue;
        const texts = [];
        if (payload.rawInput)
            texts.push(payload.rawInput);
        if (payload.processedInput && payload.processedInput !== payload.rawInput)
            texts.push(payload.processedInput);
        const depth = entry.scan_depth != null ? entry.scan_depth : 0;
        if (depth > 0) {
            const userTurns = history.filter((t) => t && t.kind === "USER" && t.content);
            const start = Math.max(0, userTurns.length - depth);
            for (let i = start; i < userTurns.length; i += 1) {
                if (userTurns[i]?.content)
                    texts.push(userTurns[i].content);
            }
        }
        const scanText = texts.join("\n");
        const isAiEntry = entry.recall_mode === "ai";
        const recallOk = entry._forced === true
            ? true
            : (isAiEntry
                ? !!(aiRecallSet && aiRecallSet.has(String(entry.id)))
                : !!(scanText && matchesEntry(entry, scanText)));
        if (recallOk) {
            if (normalizeInjectPosition(entry) === "at_depth" || entry.inject_target === "assistant")
                hitChat.push(entry);
            else if (entry.inject_target === "user")
                hitUser.push(entry);
            else
                hitSystem.push(entry);
        }
    }
    await recallLog("[HITS] sys=" + hitSystem.length + " user=" + hitUser.length + " chat=" + hitChat.length + " | aiSet=" + (aiRecallSet ? Array.from(aiRecallSet).join(",") : ""));
    if (hitSystem.length === 0 && hitUser.length === 0 && hitChat.length === 0)
        return null;
    let nextHistory = [...history];
    let nextProcessedInput = String(payload.processedInput || payload.rawInput || "");
    if (hitSystem.length > 0) {
        const { prependEntries, appendEntries } = splitEntriesByPosition(hitSystem);
        let injected = false;
        const sysNext = [];
        for (const turn of nextHistory) {
            if (!injected && turn.kind === "SYSTEM") {
                sysNext.push({ ...turn, content: applyTextInjection(turn.content || "", prependEntries, appendEntries) });
                injected = true;
                continue;
            }
            sysNext.push(turn);
        }
        if (!injected)
            sysNext.unshift({ kind: "SYSTEM", content: applyTextInjection("", prependEntries, appendEntries) });
        nextHistory = sysNext;
    }
    if (hitUser.length > 0) {
        const { prependEntries, appendEntries } = splitEntriesByPosition(hitUser);
        nextProcessedInput = applyTextInjection(nextProcessedInput, prependEntries, appendEntries);
    }
    if (hitChat.length > 0) {
        nextHistory = insertAtDepthEntries(nextHistory, hitChat);
    }
    return { preparedHistory: nextHistory, processedInput: nextProcessedInput };
}