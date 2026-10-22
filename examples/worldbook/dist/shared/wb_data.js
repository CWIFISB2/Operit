"use strict";
// 世界书数据层：读写官方数据目录 + 分析算法 + FTS 检索 + 激活检测
// 参考来源：quillplus(_fts_util/activation/worldbook)、Sillytavern-auto-worldbook(core.js)
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTOMATION_ACTIVITY = exports.EVENT_FILE = exports.CONFIRMATION_VALUES = exports.RISK_LEVELS = exports.EVENT_STATUS = exports.ACTIVATION_FILE = exports.TRIGRAM_MIN_LEN = exports.BACKUP_FILE = exports.GROUPS_FILE = exports.ENTRIES_FILE = exports.NATIVE_DIR = void 0;
exports.validateName = validateName;
exports.readEntries = readEntries;
exports.safeWriteEntries = safeWriteEntries;
exports.readGroups = readGroups;
exports.writeGroups = writeGroups;
exports.estimateTokens = estimateTokens;
exports.entryTokens = entryTokens;
exports.normalizeText = normalizeText;
exports.contentHash = contentHash;
exports.findDuplicates = findDuplicates;
exports.findKeywordConflicts = findKeywordConflicts;
exports.healthCheck = healthCheck;
exports.splitTokens = splitTokens;
exports.escapeTrigram = escapeTrigram;
exports.shortTokens = shortTokens;
exports.detectActivation = detectActivation;
exports.readActivationConfig = readActivationConfig;
exports.writeActivationConfig = writeActivationConfig;
exports.activationWordCount = activationWordCount;
exports.matchEntriesScored = matchEntriesScored;
exports.budgetAdvice = budgetAdvice;
exports.toSillyTavernLorebook = toSillyTavernLorebook;
exports.normalizeImportedPayload = normalizeImportedPayload;
exports.scoreEntryDetailed = scoreEntryDetailed;
exports.dedupByCategory = dedupByCategory;
exports.buildReferenceText = buildReferenceText;
exports.createDefaultEventState = createDefaultEventState;
exports.normalizeEventState = normalizeEventState;
exports.startEvent = startEvent;
exports.resolveEvent = resolveEvent;
exports.advanceDays = advanceDays;
exports.readEventStateRaw = readEventStateRaw;
exports.writeEventStateRaw = writeEventStateRaw;
exports.finishEventState = finishEventState;
exports.normalizeAutomationMarker = normalizeAutomationMarker;
exports.applyAutomationMarker = applyAutomationMarker;
exports.buildEventSummary = buildEventSummary;
exports.chunkNovel = chunkNovel;
exports.validateWorldbook = validateWorldbook;
exports.buildWorldbookFromEntries = buildWorldbookFromEntries;
exports.renderEjsTemplate = renderEjsTemplate;
exports.convertStMacro = convertStMacro;
exports.buildAutoPrompt = buildAutoPrompt;
exports.HIDDEN_FILE = exports.FORCE_FILE = void 0;
exports.readHiddenIds = readHiddenIds;
exports.writeHiddenIds = writeHiddenIds;
exports.readForceConfig = readForceConfig;
exports.writeForceConfig = writeForceConfig;
exports.forcedIdsForChat = forcedIdsForChat;
exports.analyzeOrphans = analyzeOrphans;
exports.buildBindingOverview = buildBindingOverview;
exports.resolveBulkTargets = resolveBulkTargets;
// 直接读写官方包数据目录，实现完全替代
exports.NATIVE_DIR = "/sdcard/Download/Operit/plugins/com.operit.worldbook";
exports.ENTRIES_FILE = `${exports.NATIVE_DIR}/entries.json`;
exports.GROUPS_FILE = `${exports.NATIVE_DIR}/groups.json`;
exports.BACKUP_FILE = `${exports.NATIVE_DIR}/entries.backup.json`;
// 增强版自有配置（绝不碰官方 entries.json）——移植自 SillyTavern Lorebook-Manager 的“隐藏而非删除”理念
exports.HIDDEN_FILE = `${exports.NATIVE_DIR}/hidden.json`;
// 按对话强制激活配置——移植自 Laplace-Lapis/sillytavern-forced-world-info 的 chat-scoped 强制激活
exports.FORCE_FILE = `${exports.NATIVE_DIR}/force_config.json`;
// ---- 名称校验（防路径穿越）——源自 worldbook.py ----
const VALID_NAME_RE = /^[a-zA-Z0-9_\-\u4e00-\u9fff]+$/;
function validateName(name) {
    if (!name)
        return false;
    if (name.includes("..") || name.includes("/") || name.includes("\\"))
        return false;
    return VALID_NAME_RE.test(name);
}
// ---- 存储读写 ----
async function readEntries() {
    try {
        const r = await Tools.Files.read(exports.ENTRIES_FILE);
        const txt = String(r?.content || "").trim();
        if (!txt)
            return [];
        const parsed = JSON.parse(txt);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch (_e) {
        return [];
    }
}
// 安全写入：先备份旧文件，再写新内容
async function safeWriteEntries(entries) {
    await Tools.Files.mkdir(exports.NATIVE_DIR, true);
    try {
        const old = await Tools.Files.read(exports.ENTRIES_FILE);
        if (old?.content) {
            await Tools.Files.write(exports.BACKUP_FILE, String(old.content));
        }
    }
    catch (_e) { }
    await Tools.Files.write(exports.ENTRIES_FILE, JSON.stringify(entries, null, 2));
}
async function readGroups() {
    try {
        const r = await Tools.Files.read(exports.GROUPS_FILE);
        const txt = String(r?.content || "").trim();
        if (!txt)
            return [];
        const parsed = JSON.parse(txt);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch (_e) {
        return [];
    }
}
async function writeGroups(groups) {
    await Tools.Files.mkdir(exports.NATIVE_DIR, true);
    await Tools.Files.write(exports.GROUPS_FILE, JSON.stringify(groups, null, 2));
}
// ================= token 估算 =================
function estimateTokens(text) {
    if (!text)
        return 0;
    let cjk = 0;
    let other = 0;
    for (const ch of text) {
        const code = ch.codePointAt(0) || 0;
        if ((code >= 0x2e80 && code <= 0x9fff) || (code >= 0x3000 && code <= 0x303f) || (code >= 0xff00 && code <= 0xffef))
            cjk += 1;
        else
            other += 1;
    }
    return Math.ceil(cjk * 0.7 + other * 0.25);
}
function entryTokens(entry) {
    return estimateTokens(String(entry.name || "")) + estimateTokens(String(entry.content || ""));
}
// ================= 去重 =================
function normalizeText(s) {
    return String(s || "")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{2,}/g, "\n")
        .trim()
        .toLowerCase();
}
function contentHash(s) {
    const norm = normalizeText(s);
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let i = 0; i < norm.length; i += 1) {
        const c = norm.charCodeAt(i);
        h1 = (h1 ^ c) >>> 0;
        h1 = (h1 * 0x01000193) >>> 0;
        h2 = (h2 + c * (i + 1)) >>> 0;
        h2 = (h2 ^ (h2 << 13)) >>> 0;
    }
    return `${h1.toString(16)}-${h2.toString(16)}-${norm.length}`;
}
function findDuplicates(entries) {
    const clusters = [];
    const byContent = new Map();
    const byName = new Map();
    for (const e of entries) {
        const ch = contentHash(e.content || "");
        if (!byContent.has(ch))
            byContent.set(ch, []);
        byContent.get(ch).push(e);
        const nm = normalizeText(e.name || "");
        if (nm) {
            if (!byName.has(nm))
                byName.set(nm, []);
            byName.get(nm).push(e);
        }
    }
    for (const [key, list] of byContent.entries()) {
        if (list.length > 1)
            clusters.push({ reason: "identical_content", key, entry_ids: list.map((e) => e.id), names: list.map((e) => e.name) });
    }
    for (const [key, list] of byName.entries()) {
        if (list.length > 1) {
            const idset = new Set(list.map((e) => e.id));
            const already = clusters.some((c) => c.reason === "identical_content" && c.entry_ids.length === idset.size && c.entry_ids.every((id) => idset.has(id)));
            if (!already)
                clusters.push({ reason: "identical_name", key, entry_ids: list.map((e) => e.id), names: list.map((e) => e.name) });
        }
    }
    return clusters;
}
function findKeywordConflicts(entries) {
    const map = new Map();
    for (const e of entries) {
        if (e.always_active)
            continue;
        for (const k of (e.keywords || [])) {
            const nk = e.case_sensitive ? k : k.toLowerCase();
            if (!nk)
                continue;
            if (!map.has(nk))
                map.set(nk, []);
            map.get(nk).push(e);
        }
    }
    const out = [];
    for (const [kw, list] of map.entries()) {
        if (list.length > 1)
            out.push({ keyword: kw, entry_ids: list.map((e) => e.id), names: list.map((e) => e.name) });
    }
    return out.sort((a, b) => b.entry_ids.length - a.entry_ids.length);
}
function healthCheck(entries, oversizedThreshold = 1200) {
    const rep = {
        total: entries.length, enabled: 0, disabled: 0, always_active: 0, keyword_triggered: 0,
        by_target: {}, by_position: {}, total_tokens: 0, enabled_tokens: 0, always_active_tokens: 0,
        dead_entries: [], oversized: [], card_bound: 0, global: 0
    };
    for (const e of entries) {
        const tk = entryTokens(e);
        rep.total_tokens += tk;
        if (e.enabled !== false) {
            rep.enabled += 1;
            rep.enabled_tokens += tk;
        }
        else {
            rep.disabled += 1;
        }
        if (e.always_active) {
            rep.always_active += 1;
            if (e.enabled !== false)
                rep.always_active_tokens += tk;
        }
        else {
            rep.keyword_triggered += 1;
        }
        const tg = e.inject_target || "system";
        rep.by_target[tg] = (rep.by_target[tg] || 0) + 1;
        const ps = e.inject_position || "append";
        rep.by_position[ps] = (rep.by_position[ps] || 0) + 1;
        if (String(e.character_card_id || "").trim())
            rep.card_bound += 1;
        else
            rep.global += 1;
        if (!e.always_active && (!e.keywords || e.keywords.length === 0))
            rep.dead_entries.push({ id: e.id, name: e.name, reason: "no_keyword_not_constant" });
        if (tk >= oversizedThreshold)
            rep.oversized.push({ id: e.id, name: e.name, tokens: tk });
    }
    rep.oversized.sort((a, b) => b.tokens - a.tokens);
    return rep;
}
// ================= FTS 查询串构造 ——移植自 quillplus _fts_util.py =================
// 中文子串检索双腿：trigram 快路径（≥3字片段整体加引号）+ 短词兜底（1-2字走 LIKE）
// 约束：MATCH 裸词含 - : 会被当语法；trigram 下 <3 字恒不命中，故短词必须兜底。
const FTS_SPLIT_RE = /["'()*^~{}，。！？；：、—…·\s]+/;
exports.TRIGRAM_MIN_LEN = 3;
function splitTokens(text) {
    if (!text)
        return [];
    return text.split(FTS_SPLIT_RE).filter((t) => t.length > 0);
}
function escapeTrigram(text, join = " OR ") {
    const tokens = splitTokens(text).filter((t) => t.length >= exports.TRIGRAM_MIN_LEN);
    if (tokens.length === 0)
        return "";
    return tokens.map((t) => `"${t}"`).join(join);
}
function shortTokens(text, minLen = 1, maxLen = exports.TRIGRAM_MIN_LEN - 1) {
    const out = [];
    for (const t of splitTokens(text)) {
        if (t.length >= minLen && t.length <= maxLen && !out.includes(t))
            out.push(t);
    }
    return out;
}
exports.ACTIVATION_FILE = `${exports.NATIVE_DIR}/activation.json`;
const CJK_BRACKET_RE = /【[^】]*】/;
const RE_ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;
function detectActivation(message, cfg) {
    const text = String(message || "");
    if (!text)
        return { activated: false, reason: "none", matched: [] };
    const lower = text.toLowerCase();
    const subHits = [];
    for (const w of cfg.activation_words || []) {
        const needle = String(w || "").trim().toLowerCase();
        if (needle && lower.includes(needle))
            subHits.push(String(w));
    }
    if (subHits.length > 0)
        return { activated: true, reason: "substring", matched: subHits };
    const wordHits = [];
    for (const w of cfg.exact_match_words || []) {
        const needle = String(w || "").trim().toLowerCase();
        if (!needle)
            continue;
        const re = new RegExp(`\\b${needle.replace(RE_ESCAPE_RE, "\\$&")}\\b`, "i");
        if (re.test(text))
            wordHits.push(String(w));
    }
    if (wordHits.length > 0)
        return { activated: true, reason: "word_boundary", matched: wordHits };
    const bm = text.match(CJK_BRACKET_RE);
    if (bm)
        return { activated: true, reason: "cjk_bracket", matched: [bm[0]] };
    return { activated: false, reason: "none", matched: [] };
}
async function readActivationConfig() {
    try {
        const r = await Tools.Files.read(exports.ACTIVATION_FILE);
        const txt = String(r?.content || "").trim();
        if (!txt)
            return { activation_words: [], exact_match_words: [] };
        const j = JSON.parse(txt);
        return {
            activation_words: Array.isArray(j.activation_words) ? j.activation_words.map((x) => String(x)) : [],
            exact_match_words: Array.isArray(j.exact_match_words) ? j.exact_match_words.map((x) => String(x)) : []
        };
    }
    catch (_e) {
        return { activation_words: [], exact_match_words: [] };
    }
}
async function writeActivationConfig(cfg) {
    await Tools.Files.mkdir(exports.NATIVE_DIR, true);
    const clean = {
        activation_words: (cfg.activation_words || []).map((x) => String(x).trim()).filter((x) => x.length > 0),
        exact_match_words: (cfg.exact_match_words || []).map((x) => String(x).trim()).filter((x) => x.length > 0)
    };
    await Tools.Files.write(exports.ACTIVATION_FILE, JSON.stringify(clean, null, 2));
}
function activationWordCount(cfg) {
    return (cfg.activation_words || []).length + (cfg.exact_match_words || []).length;
}
function matchEntriesScored(entries, text, sensitivity = 0.7, topK = 0) {
    const raw = String(text || "");
    const msg = raw.toLowerCase();
    const minRequired = sensitivity < 0.3 ? 2 : 1;
    // 双腿分工：≥3 字走 trigram 快路径，1-2 字走兜底
    const hasLong = splitTokens(raw).some((t) => t.length >= exports.TRIGRAM_MIN_LEN);
    const shorts = shortTokens(raw);
    const out = [];
    for (const e of entries) {
        if (e.enabled === false)
            continue;
        if (e.always_active)
            continue;
        if (!e.keywords || e.keywords.length === 0)
            continue;
        let matched = 0;
        const hitKeys = [];
        for (const k of e.keywords) {
            if (typeof k !== "string" || !k)
                continue;
            try {
                if (e.is_regex) {
                    if (new RegExp(k, e.case_sensitive ? "g" : "gi").test(text)) {
                        matched += 1;
                        hitKeys.push(k);
                    }
                    continue;
                }
            }
            catch (_e) {
                continue;
            }
            const needle = e.case_sensitive ? k : k.toLowerCase();
            const hay = e.case_sensitive ? raw : msg;
            let hit = false;
            if (needle.length >= exports.TRIGRAM_MIN_LEN) {
                // 快路径：长关键词整体子串命中
                hit = hay.includes(needle);
            }
            else {
                // 兜底：短词优先用输入侧短词集合匹配，回退原文子串
                hit = hay.includes(needle) ||
                    shorts.some((s) => hay.includes(e.case_sensitive ? s : s.toLowerCase()));
            }
            if (hit) {
                matched += 1;
                hitKeys.push(k);
            }
        }
        if (matched >= minRequired) {
            out.push({ ...e, _match_score: matched, _matched_keys: hitKeys });
        }
    }
    out.sort((a, b) => b._match_score - a._match_score || (b.priority || 50) - (a.priority || 50));
    return topK > 0 ? out.slice(0, topK) : out;
}
function budgetAdvice(entries, budget) {
    const live = entries.filter((e) => e.enabled !== false);
    const current = live.reduce((sum, e) => sum + entryTokens(e), 0);
    const overflow = Math.max(0, current - budget);
    const cands = live
        .map((e) => ({ id: e.id, name: e.name, tokens: entryTokens(e), priority: e.priority ?? 50, reason: e.always_active ? "always_active" : (e.keywords.length === 0 ? "dead" : "keyword") }))
        .filter((c) => c.reason !== "dead")
        .sort((a, b) => {
        if (a.reason !== b.reason)
            return a.reason === "always_active" ? -1 : 1;
        return a.priority - b.priority;
    });
    const cut = [];
    let acc = 0;
    for (const c of cands) {
        if (acc >= overflow)
            break;
        cut.push(c);
        acc += c.tokens;
    }
    return { current_tokens: current, budget, overflow, cut_candidates: cut };
}
// ================= 导出格式转换 =================
function toSillyTavernLorebook(entries, name = "worldbook_plus_export") {
    const out = {};
    entries.forEach((e, i) => {
        out[String(i)] = {
            uid: i, key: e.keywords || [], keysecondary: [], comment: e.name, content: e.content,
            constant: !!e.always_active, selective: false, order: e.priority ?? 50,
            position: e.inject_position === "prepend" ? 0 : 1, disable: e.enabled === false,
            useRegex: !!e.is_regex, caseSensitive: !!e.case_sensitive, depth: e.scan_depth ?? 0
        };
    });
    return { name, entries: out };
}
function normalizeImportedPayload(raw) {
    const warnings = [];
    const entries = [];
    const toKeys = (v) => {
        if (Array.isArray(v))
            return v.map((x) => String(x || "").trim()).filter((x) => x.length > 0);
        if (typeof v === "string")
            return v.split(/[,，]/).map((x) => x.trim()).filter((x) => x.length > 0);
        return [];
    };
    const pushST = (e) => {
        const name = String(e.comment || e.name || e.id || "").trim();
        const content = String(e.content || "").trim();
        if (!name || !content)
            return;
        const keys = toKeys(e.key || e.keys);
        keys.push(...toKeys(e.keysecondary || e.secondary_keys));
        entries.push({
            name, content, keywords: keys,
            is_regex: e.use_regex === true || e.useRegex === true,
            case_sensitive: e.caseSensitive === true || e.case_sensitive === true,
            always_active: e.constant === true,
            enabled: e.disable !== true && e.enabled !== false,
            priority: Number(e.order ?? e.display_index ?? e.insertion_order ?? 50) || 50,
            scan_depth: Number(e.depth ?? e.scanDepth ?? 0) || 0,
            inject_target: "system",
            inject_position: (e.position === 0 || e.position === "before_char") ? "prepend" : "append",
            insertion_depth: 0
        });
    };
    if (Array.isArray(raw)) {
        for (const e of raw) {
            if (!e || typeof e !== "object")
                continue;
            const r = e;
            const name = String(r.name || "").trim();
            const content = String(r.content || "").trim();
            if (!name || !content)
                continue;
            entries.push({
                name, content,
                keywords: toKeys(r.keywords || r.keys),
                is_regex: r.is_regex === true,
                case_sensitive: r.case_sensitive === true,
                always_active: r.always_active === true || r.constant === true,
                enabled: r.enabled !== false,
                priority: Number(r.priority ?? r.order ?? 50) || 50,
                scan_depth: Number(r.scan_depth ?? r.depth ?? 0) || 0,
                inject_target: (r.inject_target === "user" || r.inject_target === "assistant") ? r.inject_target : "system",
                inject_position: (r.inject_position === "prepend" || r.inject_position === "at_depth") ? r.inject_position : "append",
                insertion_depth: Number(r.insertion_depth ?? 0) || 0
            });
        }
        return { source: "operit_array", entries, warnings };
    }
    if (raw && typeof raw === "object") {
        const obj = raw;
        const raws = obj.entries;
        if (raws && typeof raws === "object" && !Array.isArray(raws)) {
            for (const v of Object.values(raws)) {
                if (v && typeof v === "object")
                    pushST(v);
            }
            return { source: "sillytavern_lorebook", entries, warnings };
        }
        if (Array.isArray(raws)) {
            const first = (raws[0] || {});
            const isOperit = "content" in first && ("keywords" in first || "always_active" in first);
            if (isOperit) {
                for (const e of raws) {
                    if (!e || typeof e !== "object")
                        continue;
                    const r = e;
                    const name = String(r.name || "").trim();
                    const content = String(r.content || "").trim();
                    if (!name || !content)
                        continue;
                    entries.push({
                        name, content, keywords: toKeys(r.keywords),
                        is_regex: r.is_regex === true, case_sensitive: r.case_sensitive === true,
                        always_active: r.always_active === true, enabled: r.enabled !== false,
                        priority: Number(r.priority ?? 50) || 50, scan_depth: Number(r.scan_depth ?? 0) || 0,
                        inject_target: (r.inject_target === "user" || r.inject_target === "assistant") ? r.inject_target : "system",
                        inject_position: (r.inject_position === "prepend" || r.inject_position === "at_depth") ? r.inject_position : "append",
                        insertion_depth: Number(r.insertion_depth ?? 0) || 0
                    });
                }
                return { source: "operit_entries", entries, warnings };
            }
            for (const e of raws) {
                if (e && typeof e === "object")
                    pushST(e);
            }
            return { source: "sillytavern_entries", entries, warnings };
        }
        const cb = obj.character_book;
        if (cb && typeof cb === "object") {
            const cbe = cb.entries;
            if (Array.isArray(cbe)) {
                for (const e of cbe)
                    if (e && typeof e === "object")
                        pushST(e);
                return { source: "character_book", entries, warnings };
            }
        }
    }
    throw new Error("不支持的导入格式：需为 Operit 数组、SillyTavern lorebook 或角色卡 character_book");
}
// ================= 加权评分 + 参考文本 ——移植自 quillplus kb.py =================
// 与 matchEntriesScored 的区别：kb 版引入副关键词门控（主命中但副未命中则整体降权）
// 与名称命中加成，用于素材库式召回。
function ensureList(v) {
    if (Array.isArray(v))
        return v.map((x) => String(x));
    if (typeof v === "string") {
        try {
            const p = JSON.parse(v);
            return Array.isArray(p) ? p.map((x) => String(x)) : [v];
        }
        catch (_e) {
            return v ? v.split(",") : [];
        }
    }
    return [];
}
function scoreEntryDetailed(entry, inputLower) {
    const keywords = ensureList(entry.keywords || []);
    const aliases = ensureList(entry.aliases || []);
    const secondary = ensureList(entry.secondary_keywords || []);
    let score = 0;
    const matched = [];
    for (const kw of keywords) {
        if (kw && inputLower.includes(kw.toLowerCase())) {
            score += 3;
            matched.push(kw);
        }
    }
    if (secondary.length > 0 && score > 0) {
        const secHit = secondary.some((s) => s && inputLower.includes(s.toLowerCase()));
        if (!secHit)
            score *= 0.3;
    }
    for (const alias of aliases) {
        if (alias && inputLower.includes(alias.toLowerCase())) {
            score += 2;
            matched.push(`(${alias})`);
        }
    }
    const nameLower = String(entry.name || "").toLowerCase();
    if (nameLower.length >= 2 && inputLower.includes(nameLower) && !matched.some((m) => m.toLowerCase() === nameLower)) {
        score += 1;
    }
    return { score, matched };
}
function dedupByCategory(entries, limit) {
    if (limit <= 0)
        return entries;
    const counts = {};
    const out = [];
    for (const e of entries) {
        const cat = String(e.category || "");
        const n = counts[cat] || 0;
        if (n < limit) {
            out.push(e);
            counts[cat] = n + 1;
        }
    }
    return out;
}
function buildReferenceText(matched, header = "【写作素材库参考】") {
    if (!matched || matched.length === 0)
        return "";
    const parts = [header, "=".repeat(40), ""];
    for (const e of matched) {
        parts.push(String(e.name || e.id || ""));
        parts.push(String(e.content || ""));
        parts.push("");
        parts.push("-".repeat(40));
        parts.push("");
    }
    parts.push("=".repeat(40));
    parts.push("请结合以上参考，自行生成增强描写。");
    return parts.join("\n");
}
// ================= 事件状态机 ——源自 auto-worldbook core.js =================
exports.EVENT_STATUS = { PENDING: "pending", RESOLVED_HIDDEN: "resolved_hidden", REVEALABLE: "revealable", REVEALED: "revealed" };
exports.RISK_LEVELS = ["none", "low", "medium", "high", "very_high"];
exports.CONFIRMATION_VALUES = ["none", "positive", "negative"];
function createDefaultEventState() {
    return { version: 2, day: 1, cycle: 0, activeEvent: null, history: [] };
}
function normalizeEventState(input) {
    const src = (input && typeof input === "object") ? input : {};
    const st = {
        version: 2,
        day: Math.max(1, Number(src.day ?? 1) || 1),
        cycle: Math.max(0, Number(src.cycle ?? 0) || 0),
        activeEvent: src.activeEvent && typeof src.activeEvent === "object" ? { ...src.activeEvent } : null,
        history: Array.isArray(src.history) ? src.history : []
    };
    if (st.activeEvent) {
        const ev = st.activeEvent;
        ev.chance = Math.min(100, Math.max(0, Number(ev.chance ?? 0) || 0));
        ev.resolveDay = Math.max(ev.startedDay ?? 1, Number(ev.resolveDay ?? st.day) || st.day);
        ev.revealDay = Math.max(ev.resolveDay, Number(ev.revealDay ?? ev.resolveDay) || ev.resolveDay);
        if (!Object.values(exports.EVENT_STATUS).includes(ev.status))
            ev.status = exports.EVENT_STATUS.PENDING;
        if (ev.roll == null)
            ev.roll = null;
        else
            ev.roll = Math.min(100, Math.max(1, Number(ev.roll) || 1));
        if (ev.result !== "yes" && ev.result !== "no")
            ev.result = null;
    }
    return st;
}
function startEvent(state, opts = {}) {
    const st = normalizeEventState(state);
    if (st.activeEvent)
        throw new Error("当前已存在进行中的事件");
    const chance = Math.min(100, Math.max(0, Number(opts.chance ?? 0) || 0));
    const rd = Math.max(0, Number(opts.resolutionDelay ?? 0) || 0);
    const vd = Math.max(0, Number(opts.revealDelay ?? 0) || 0);
    st.cycle += 1;
    st.activeEvent = {
        id: `event-${Date.now()}-${st.cycle}`,
        name: String(opts.name || "延迟事件").trim() || "延迟事件",
        cycle: st.cycle, startedDay: st.day, chance,
        resolveDay: st.day + rd, revealDay: st.day + rd + vd,
        status: exports.EVENT_STATUS.PENDING, roll: null, result: null,
        createdAt: new Date().toISOString()
    };
    return st;
}
function resolveEvent(state, roll) {
    const st = normalizeEventState(state);
    const ev = st.activeEvent;
    if (!ev)
        throw new Error("当前没有进行中的事件");
    if (ev.status !== exports.EVENT_STATUS.PENDING)
        return st;
    const r = Math.min(100, Math.max(1, Number(roll) || 1));
    ev.roll = r;
    ev.result = r <= ev.chance ? "yes" : "no";
    ev.status = st.day >= ev.revealDay ? exports.EVENT_STATUS.REVEALABLE : exports.EVENT_STATUS.RESOLVED_HIDDEN;
    ev.resolvedDay = st.day;
    return st;
}
function advanceDays(state, amount) {
    const st = normalizeEventState(state);
    st.day += Math.max(0, Number(amount) || 0);
    const ev = st.activeEvent;
    if (!ev)
        return st;
    if (ev.status === exports.EVENT_STATUS.PENDING && st.day >= ev.resolveDay) {
        const roll = Math.floor(Math.random() * 100) + 1;
        resolveEvent(st, roll);
    }
    if (st.activeEvent?.status === exports.EVENT_STATUS.RESOLVED_HIDDEN && st.day >= st.activeEvent.revealDay) {
        st.activeEvent.status = exports.EVENT_STATUS.REVEALABLE;
    }
    return st;
}
// 事件状态读写包装（wbplus_event / wbplus_event_marker 共用）
exports.EVENT_FILE = `${exports.NATIVE_DIR}/event_state.json`;
async function readEventStateRaw() {
    try {
        const r = await Tools.Files.read(exports.EVENT_FILE);
        const txt = String(r?.content || "").trim();
        if (!txt)
            return createDefaultEventState();
        return normalizeEventState(JSON.parse(txt));
    }
    catch (_e) {
        return createDefaultEventState();
    }
}
async function writeEventStateRaw(state) {
    await Tools.Files.mkdir(exports.NATIVE_DIR, true);
    await Tools.Files.write(exports.EVENT_FILE, JSON.stringify(normalizeEventState(state), null, 2));
}
function finishEventState(stateInput) {
    const st = normalizeEventState(stateInput);
    const ev = st.activeEvent;
    if (!ev)
        return st;
    st.history.unshift({ ...ev, finishedDay: st.day, finishedAt: new Date().toISOString() });
    st.history = st.history.slice(0, 30);
    st.activeEvent = null;
    return st;
}
// 自动化标记应用器 ——移植自 auto-worldbook core.js applyPregnancyMarker
exports.AUTOMATION_ACTIVITY = ["none", "ongoing", "completed", "cancelled"];
function normalizeAutomationMarker(input) {
    const m = (input && typeof input === "object") ? input : {};
    const risk = exports.RISK_LEVELS.includes(String(m.risk)) ? String(m.risk) : "none";
    const confirm = exports.CONFIRMATION_VALUES.includes(String(m.confirm)) ? String(m.confirm) : "none";
    const activity = exports.AUTOMATION_ACTIVITY.includes(String(m.activity)) ? String(m.activity) : "none";
    return { v: 2, days: Math.min(365, Math.max(0, Number(m.days ?? 0) || 0)), activity, risk, confirm, close: m.close === true };
}
function applyAutomationMarker(stateInput, markerInput, options = {}) {
    let state = normalizeEventState(stateInput);
    const marker = normalizeAutomationMarker(markerInput);
    const notices = [];
    const riskValues = { none: 0, low: 5, medium: 15, high: 30, very_high: 45 };
    if (marker.days > 0) {
        state = advanceDays(state, marker.days);
        notices.push(`故事时间自动推进 ${marker.days} 天。`);
    }
    const riskAllowed = marker.activity === "completed";
    const riskDelta = riskAllowed ? (riskValues[marker.risk] || 0) : 0;
    if (!riskAllowed && marker.risk !== "none")
        notices.push(`已拦截 ${marker.activity} 阶段的过早风险标记。`);
    if (riskDelta > 0) {
        if (state.activeEvent?.status === exports.EVENT_STATUS.REVEALED && state.activeEvent.result === "no") {
            state = finishEventState(state);
            notices.push("已自动归档上一周期的阴性结果。");
        }
        if (!state.activeEvent) {
            state = startEvent(state, { name: "延迟事件", chance: riskDelta, resolutionDelay: 10, revealDelay: 8 });
            notices.push(`自动建立事件，初始概率 ${riskDelta}%。`);
        }
        else if (state.activeEvent.status === exports.EVENT_STATUS.PENDING) {
            state.activeEvent.chance = Math.min(100, state.activeEvent.chance + riskDelta);
            notices.push(`风险累计，概率增加 ${riskDelta} 个百分点。`);
        }
        else {
            notices.push("当前周期已完成判定，未修改既有结果。");
        }
    }
    if (marker.confirm !== "none") {
        const confirmed = marker.confirm === "positive" ? "yes" : "no";
        if (!state.activeEvent && confirmed === "yes") {
            state = startEvent(state, { name: "延迟事件", chance: 100, resolutionDelay: 0, revealDelay: 0 });
            if (state.activeEvent) {
                state.activeEvent.status = exports.EVENT_STATUS.REVEALABLE;
                state.activeEvent.result = "yes";
            }
        }
        if (state.activeEvent) {
            const allowed = [exports.EVENT_STATUS.REVEALABLE, exports.EVENT_STATUS.REVEALED].includes(state.activeEvent.status);
            if (!allowed)
                notices.push("过早的确认标记，已忽略。");
            else if (state.activeEvent.result && state.activeEvent.result !== confirmed)
                notices.push("标记与已保存结果冲突，保留原判定。");
            else {
                state.activeEvent.result = confirmed;
                state.activeEvent.status = exports.EVENT_STATUS.REVEALED;
                state.activeEvent.revealedDay = state.day;
                notices.push(marker.confirm === "positive" ? "识别到阳性确认。" : "识别到阴性确认。");
            }
        }
    }
    if (marker.close && state.activeEvent) {
        if (state.activeEvent.status === exports.EVENT_STATUS.REVEALED) {
            state = finishEventState(state);
            notices.push("事件已结束并归档。");
        }
        else
            notices.push("收到归档标记，但事件尚未正式揭晓，未结束。");
    }
    return { state, marker, notices };
}
function buildEventSummary(state) {
    const st = normalizeEventState(state);
    const ev = st.activeEvent;
    if (!ev)
        return "";
    const resultLine = ev.result ? `内部隐藏结果：${ev.result === "yes" ? "发生" : "未发生"}` : "内部隐藏结果：尚未判定";
    const phaseRule = {
        [exports.EVENT_STATUS.PENDING]: "尚未判定。不得宣称结果已经发生。",
        [exports.EVENT_STATUS.RESOLVED_HIDDEN]: "结果已固定，尚未到揭晓日。不得泄露结果。",
        [exports.EVENT_STATUS.REVEALABLE]: "已到可揭晓阶段。可在合适场景揭晓。",
        [exports.EVENT_STATUS.REVEALED]: "结果已正式揭晓。后续必须遵循。"
    };
    return [
        "[延迟概率事件管理器：内部状态]",
        "这是程序保存的权威状态。不要修改数值、重新随机或向正文解释概率机制。",
        `当前故事日：第 ${st.day} 天`,
        `事件：${ev.name}`,
        `周期：${ev.cycle}`,
        `累计概率：${ev.chance}%`,
        `隐藏判定日：第 ${ev.resolveDay} 天`,
        `最早揭晓日：第 ${ev.revealDay} 天`,
        `状态：${ev.status}`,
        resultLine,
        `当前阶段规则：${phaseRule[ev.status] || ""}`
    ].join("\n");
}
function chunkNovel(text, maxChars = 12000, opts = {}) {
    const s = String(text || "");
    if (!s)
        return [];
    const mx = Math.max(1000, Number(maxChars) || 12000);
    const STRONG = ["\n\n", "\n", "\u3002", "\uff01", "\uff1f"];
    const WEAK = ["\uff1b", "\u2026", "\u300d", "\u300f", "\u201d", "\u2019"];
    const SOFT = ["\uff0c", "\u3001", ",", ";"];
    const chunks = [];
    let i = 0;
    let idx = 0;
    function lastBoundary(from, to, list) {
        const win = s.slice(from, to);
        let best = -1;
        for (const p of list) {
            const k = win.lastIndexOf(p);
            if (k > best)
                best = k;
        }
        return best >= 0 ? from + best + 1 : -1;
    }
    function semanticBoundary(from, to) {
        // 轻量语义辅助：在 [from+mx*0.6, to] 内找左右 2-gram 重叠最小的位置
        const lo = Math.floor(from + (to - from) * 0.6);
        const hi = to - 40;
        if (hi <= lo)
            return -1;
        const step = Math.max(40, Math.floor((hi - lo) / 12));
        let bestPos = -1;
        let bestScore = Infinity;
        for (let p = lo; p <= hi; p += step) {
            const L = s.slice(Math.max(from, p - 80), p);
            const R = s.slice(p, Math.min(to, p + 80));
            const g = (t) => {
                const out = new Set();
                for (let k = 0; k + 1 < t.length; k++)
                    out.add(t.slice(k, k + 2));
                return out;
            };
            const a = g(L);
            const b = g(R);
            if (a.size === 0 || b.size === 0)
                continue;
            let inter = 0;
            for (const x of a)
                if (b.has(x))
                    inter += 1;
            const score = inter / (a.size + b.size - inter);
            if (score < bestScore) {
                bestScore = score;
                bestPos = p;
            }
        }
        return bestPos > from ? bestPos : -1;
    }
    while (i < s.length) {
        let end = Math.min(s.length, i + mx);
        if (end < s.length) {
            // 1) 标点分级特判：强 -> 弱 -> soft
            let cut = lastBoundary(i, end, STRONG);
            if (cut < 0 || cut < i + mx * 0.6)
                cut = lastBoundary(i, end, WEAK);
            if (cut < 0 || cut < i + mx * 0.5)
                cut = lastBoundary(i, end, SOFT);
            // 2) 语义辅助切（可注入外部 embedding；默认轻量 2-gram）
            if (cut < 0 || cut < i + mx * 0.4) {
                let sem = -1;
                if (typeof opts.embedBoundary === "function") {
                    try {
                        sem = opts.embedBoundary(s, i, end, mx);
                    }
                    catch (_e) {
                        sem = -1;
                    }
                }
                if (!(sem > i + mx * 0.3 && sem <= end))
                    sem = semanticBoundary(i, end);
                if (sem > i + mx * 0.3 && sem <= end)
                    cut = sem;
            }
            // 3) 兜底降级：硬切
            if (cut < 0 || cut <= i)
                cut = end;
            end = cut;
        }
        chunks.push({ index: idx, chars: end - i, text: s.slice(i, end) });
        i = end;
        idx += 1;
    }
    return chunks;
}
function validateWorldbook(entries) {
    let total = 0;
    const empty = [];
    const oversized = [];
    for (const e of entries) {
        const tk = entryTokens(e);
        total += tk;
        const nm = String(e.name || e.id || "");
        if (!String(e.content || "").trim())
            empty.push(nm);
        if (tk > 500)
            oversized.push(nm + "(" + tk + "tok)");
    }
    let conflicts = [];
    try {
        conflicts = findKeywordConflicts(entries);
    }
    catch (_e) {
        conflicts = [];
    }
    return { totalTokens: total, conflicts, empty, oversized };
}
function buildWorldbookFromEntries(entries, name = "世界书") {
    const list = Array.isArray(entries) ? entries : [];
    const lore = toSillyTavernLorebook(list, name);
    const json = JSON.stringify(lore, null, 2);
    const md = ["# " + name, ""];
    for (const e of list) {
        md.push("## " + (e.name || "(未命名)"));
        if (e.keywords && e.keywords.length)
            md.push("- 触发词：" + e.keywords.join("、"));
        if (e.always_active)
            md.push("- 常驻");
        if (e.character_card_id)
            md.push("- 绑定角色卡：" + e.character_card_id);
        md.push("");
        md.push(String(e.content || ""));
        md.push("");
    }
    const markdown = md.join("\n");
    const val = validateWorldbook(list);
    const rp = [
        "# 校验报告",
        "",
        "- 条目数：" + list.length,
        "- token 估算：" + val.totalTokens,
        "- 触发词冲突：" + val.conflicts.length,
        "- 空条目：" + val.empty.length,
        "- 超长条目(>500tok)：" + val.oversized.length,
        ""
    ];
    for (const c of val.conflicts.slice(0, 20))
        rp.push("- 冲突「" + c.keyword + "」×" + (c.entry_ids ? c.entry_ids.length : 0));
    for (const nm of val.empty.slice(0, 20))
        rp.push("- 空条目：" + nm);
    for (const nm of val.oversized.slice(0, 20))
        rp.push("- 超长：" + nm);
    const report = rp.join("\n");
    return {
        json, markdown, report,
        stats: {
            entries: list.length,
            tokens: val.totalTokens,
            conflicts: val.conflicts.length,
            empty: val.empty.length,
            oversized: val.oversized.length
        }
    };
}
function escapeHtml(s) {
    return String(s == null ? "" : s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
// EJS 子集：<% %> 控制流 / <%= %> 转义输出 / <%- %> 原始输出 / <%# %> 注释
function renderEjsTemplate(tpl, ctxIn = {}) {
    const src = String(tpl || "");
    const ctx = ctxIn || {};
    const keys = Object.keys(ctx).filter((k) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k));
    const parts = [];
    let i = 0;
    while (i < src.length) {
        const open = src.indexOf("<%", i);
        if (open < 0) {
            parts.push("__out.push(" + JSON.stringify(src.slice(i)) + ");");
            break;
        }
        if (open > i)
            parts.push("__out.push(" + JSON.stringify(src.slice(i, open)) + ");");
        let close = src.indexOf("%>", open + 2);
        if (close < 0) {
            parts.push("__out.push(" + JSON.stringify(src.slice(open)) + ");");
            break;
        }
        let body = src.slice(open + 2, close);
        if (body.endsWith("-"))
            body = body.slice(0, -1);
        const trimmed = body.replace(/^[-_=]/, "").trim();
        if (/^[=]/.test(body.trim().charAt(0) === "=" ? "=" : "")) {
            // noop
        }
        const tag = body.trim().charAt(0);
        if (tag === "#") {
            // 注释
        }
        else if (tag === "=") {
            parts.push("__out.push(__esc(" + body.trim().slice(1).trim() + "));");
        }
        else if (tag === "-") {
            parts.push("__out.push(String(" + body.trim().slice(1).trim() + " == null ? '' : " + body.trim().slice(1).trim() + "));");
        }
        else if (tag === "_") {
            parts.push(body.trim().slice(1).trim() + ";");
        }
        else {
            parts.push(trimmed + ";");
        }
        i = close + 2;
    }
    const fnBody = "var __out=[];var __esc=arguments[arguments.length-1];" + parts.join("\n") + "return __out.join('');";
    try {
        const fn = new Function(...keys, "__esc", fnBody);
        const args = keys.map((k) => ctx[k]);
        return String(fn.apply(ctx, args.concat([escapeHtml])));
    }
    catch (e) {
        return "[模板错误] " + (e && e.message ? e.message : String(e));
    }
}
// ST-Prompt-Template 风格宏 → EJS 语法
function convertStMacro(tpl) {
    let s = String(tpl || "");
    s = s.replace(/\{\{getvar::([^}]+)\}\}/g, "<%= vars.$1 %>");
    s = s.replace(/\{\{setvar::([^:}]+)::([^}]*)\}\}/g, "<% vars.$1 = \"$2\" %>");
    s = s.replace(/\{\{getglobalvar::([^}]+)\}\}/g, "<%= global.$1 %>");
    s = s.replace(/\{\{get_message_variable::([^}]+)\}\}/g, "<%= msg.$1 %>");
    s = s.replace(/\{\{format_message_variable::([^}]+)\}\}/g, "<%= JSON.stringify(msg.$1) %>");
    s = s.replace(/\{\{user\}\}/g, "<%= user %>");
    s = s.replace(/\{\{char\}\}/g, "<%= char %>");
    s = s.replace(/\{\{time\}\}/g, "<%= now %>");
    s = s.replace(/\{\{date\}\}/g, "<%= today %>");
    s = s.replace(/\{\{newline\}\}/g, "\n");
    return s;
}
function buildAutoPrompt(text, mode, tplOverride) {
    const t = String(text || "").trim();
    const preset = {
        worldbook: "你是世界书条目生成器。从下面文本提炼设定条目，输出 JSON 数组，每项含 name/keywords/content/always_active。\n\n文本：\n<%= text %>",
        entry: "基于下列素材写一条世界书条目，含名称、触发词（≤8个）、正文。\n\n素材：\n<%= text %>",
        summarize: "把下列文本压缩为 300 字以内的设定摘要，保留人名、地点、物品、术语。\n\n文本：\n<%= text %>"
    };
    const tpl = tplOverride && tplOverride.trim() ? tplOverride : (preset[mode] || preset.entry);
    return renderEjsTemplate(tpl, { text: t, mode: mode, vars: {}, global: {}, msg: {}, user: "用户", char: "角色", now: "", today: "" });
}
// ================= 隐藏（隐藏而非删除）——移植自 Lorebook-Manager-Silly-Tavern =================
async function readHiddenIds() {
    try {
        const r = await Tools.Files.read(exports.HIDDEN_FILE);
        const txt = String((r && r.content) || "").trim();
        if (!txt)
            return [];
        const parsed = JSON.parse(txt);
        return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
    }
    catch (_e) {
        return [];
    }
}
async function writeHiddenIds(ids) {
    await Tools.Files.mkdir(exports.NATIVE_DIR, true);
    const clean = Array.from(new Set((Array.isArray(ids) ? ids : []).filter((x) => typeof x === "string" && x.trim())));
    await Tools.Files.write(exports.HIDDEN_FILE, JSON.stringify(clean, null, 2));
    return clean;
}
// ================= 按对话强制激活 —— 移植自 sillytavern-forced-world-info =================
async function readForceConfig() {
    try {
        const r = await Tools.Files.read(exports.FORCE_FILE);
        const txt = String((r && r.content) || "").trim();
        if (!txt)
            return { default: [], chats: {} };
        const cfg = JSON.parse(txt) || {};
        return {
            default: Array.isArray(cfg.default) ? cfg.default.filter((x) => typeof x === "string") : [],
            chats: cfg.chats && typeof cfg.chats === "object" ? cfg.chats : {}
        };
    }
    catch (_e) {
        return { default: [], chats: {} };
    }
}
async function writeForceConfig(cfg) {
    await Tools.Files.mkdir(exports.NATIVE_DIR, true);
    const clean = {
        default: Array.isArray(cfg && cfg.default) ? cfg.default.filter((x) => typeof x === "string") : [],
        chats: {}
    };
    const src = cfg && cfg.chats && typeof cfg.chats === "object" ? cfg.chats : {};
    for (const k of Object.keys(src)) {
        const arr = Array.isArray(src[k]) ? src[k].filter((x) => typeof x === "string") : [];
        if (arr.length)
            clean.chats[k] = arr;
    }
    await Tools.Files.write(exports.FORCE_FILE, JSON.stringify(clean, null, 2));
    return clean;
}
// 取某对话的强制激活 id 集合：default + 该对话覆盖
function forcedIdsForChat(cfg, chatId) {
    const set = new Set(Array.isArray(cfg && cfg.default) ? cfg.default : []);
    const cid = String(chatId || "").trim();
    if (cid && cfg && cfg.chats && Array.isArray(cfg.chats[cid])) {
        for (const id of cfg.chats[cid])
            set.add(id);
    }
    return set;
}
// ================= 孤儿条目（未归入任何分组） =================
function analyzeOrphans(entries, groups) {
    const list = Array.isArray(entries) ? entries : [];
    const valid = new Set(list.map((e) => String(e.id)));
    const inGroup = new Set();
    let staleRefs = 0;
    for (const g of (Array.isArray(groups) ? groups : [])) {
        for (const id of (Array.isArray(g.entry_ids) ? g.entry_ids : [])) {
            if (valid.has(String(id)))
                inGroup.add(String(id));
            else
                staleRefs += 1;
        }
    }
    const orphans = list.filter((e) => !inGroup.has(String(e.id)));
    return {
        total_entries: list.length,
        grouped_count: inGroup.size,
        stale_refs: staleRefs,
        orphan_count: orphans.length,
        orphans: orphans.map((e) => ({ id: e.id, name: e.name, enabled: e.enabled !== false, always_active: !!e.always_active }))
    };
}
// ================= 绑定总览（全局 / 角色卡 / 分组） =================
function buildBindingOverview(entries, groups) {
    const list = Array.isArray(entries) ? entries : [];
    const global = [];
    const byCard = {};
    for (const e of list) {
        const cid = String(e.character_card_id || "").trim();
        if (cid) {
            if (!byCard[cid])
                byCard[cid] = [];
            byCard[cid].push({ id: e.id, name: e.name });
        }
        else {
            global.push({ id: e.id, name: e.name });
        }
    }
    const groupList = (Array.isArray(groups) ? groups : []).map((g) => ({
        id: g.id, name: g.name, count: Array.isArray(g.entry_ids) ? g.entry_ids.length : 0
    }));
    return {
        total: list.length,
        global_count: global.length,
        card_bound_count: list.length - global.length,
        card_count: Object.keys(byCard).length,
        group_count: groupList.length,
        global, by_card: byCard, groups: groupList
    };
}
// ================= 批量操作解析（按 id 清单或过滤器） =================
function resolveBulkTargets(entries, opts) {
    const list = Array.isArray(entries) ? entries : [];
    const o = opts || {};
    const ids = Array.isArray(o.ids) ? o.ids.filter((x) => typeof x === "string") : [];
    if (ids.length) {
        const idSet = new Set(ids);
        return list.filter((e) => idSet.has(e.id));
    }
    let filtered = list.slice();
    if (o.filter_enabled === true)
        filtered = filtered.filter((e) => e.enabled !== false);
    else if (o.filter_disabled === true)
        filtered = filtered.filter((e) => e.enabled === false);
    if (o.filter_always_active === true)
        filtered = filtered.filter((e) => !!e.always_active);
    if (o.keyword) {
        const kw = String(o.keyword).toLowerCase();
        filtered = filtered.filter((e) => (Array.isArray(e.keywords) ? e.keywords : []).some((k) => String(k).toLowerCase().includes(kw)));
    }
    if (o.name_contains) {
        const nm = String(o.name_contains).toLowerCase();
        filtered = filtered.filter((e) => String(e.name || "").toLowerCase().includes(nm));
    }
    return filtered;
}