"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Screen;
const i18n_1 = require("../../i18n");
const worldbook_service_js_1 = require("../../shared/worldbook_service.js");
const wb_data_js_1 = require("../../shared/wb_data.js");
const task_expectation_bridge_js_1 = require("../../shared/task_expectation_bridge.js");
const CONTENT_SNIPPETS = [
    {
        id: "format_message_variable",
        label: "format_message_variable",
        description: "格式化输出当前消息/会话局部变量对象",
        content: "{{format_message_variable::stat_data}}"
    },
    {
        id: "format_chat_variable",
        label: "format_chat_variable",
        description: "兼容 chat 命名，效果与 message 作用域一致",
        content: "{{format_chat_variable::stat_data}}"
    },
    {
        id: "format_character_variable",
        label: "format_character_variable",
        description: "格式化输出角色变量对象",
        content: "{{format_character_variable::stat_data}}"
    },
    {
        id: "format_global_variable",
        label: "format_global_variable",
        description: "格式化输出全局变量对象",
        content: "{{format_global_variable::world_state}}"
    },
    {
        id: "get_message_variable",
        label: "get_message_variable",
        description: "读取当前消息/会话局部变量中的单个路径",
        content: "{{get_message_variable::stat_data.系统.积分}}"
    },
    {
        id: "get_chat_variable",
        label: "get_chat_variable",
        description: "兼容 chat 命名，效果与 message 作用域一致",
        content: "{{get_chat_variable::stat_data.系统.积分}}"
    },
    {
        id: "get_character_variable",
        label: "get_character_variable",
        description: "读取角色变量中的单个路径",
        content: "{{get_character_variable::stat_data.关系.好感}}"
    },
    {
        id: "get_global_variable",
        label: "get_global_variable",
        description: "读取全局变量中的单个路径",
        content: "{{get_global_variable::world_state.rules.version}}"
    },
    {
        id: "getvar_macro",
        label: "getvar",
        description: "本地变量路径读取简写",
        content: "<%= getvar('stat_data.心理.羁绊值') %>"
    },
    {
        id: "getglobalvar_macro",
        label: "getglobalvar",
        description: "全局变量路径读取简写",
        content: "<%= getglobalvar('world_state.rules.version') %>"
    },
    {
        id: "getvar_braces",
        label: "{{getvar::...}}",
        description: "本地变量路径读取的花括号版本",
        content: "{{getvar::stat_data.心理.羁绊值}}"
    },
    {
        id: "getglobalvar_braces",
        label: "{{getglobalvar::...}}",
        description: "全局变量路径读取的花括号版本",
        content: "{{getglobalvar::world_state.rules.version}}"
    },
    {
        id: "dot_shorthand",
        label: "{{.变量}}",
        description: "本地变量顶层键简写，仅支持单层变量名",
        content: "{{.stat_data}}"
    },
    {
        id: "dollar_shorthand",
        label: "{{$变量}}",
        description: "全局变量顶层键简写，仅支持单层变量名",
        content: "{{$world_state}}"
    },
    {
        id: "init_var_block",
        label: "[InitVar]初始化",
        description: "在条目中声明变量初始化区块",
        content: "[InitVar]初始化\n```json\n{\n  \"stat_data\": {\n    \"系统\": {\n      \"积分\": 0\n    }\n  }\n}\n```"
    },
    {
        id: "update_variable_patch",
        label: "UpdateVariable / JSONPatch",
        description: "在助手回复后写回变量的 JSONPatch 模板",
        content: "<UpdateVariable>\n<Analysis>描述本次变量变化原因</Analysis>\n<JSONPatch>\n```json\n[\n  {\n    \"op\": \"replace\",\n    \"path\": \"/stat_data/系统/积分\",\n    \"value\": 1\n  }\n]\n```\n</JSONPatch>\n</UpdateVariable>"
    },
    {
        id: "jsonpatch_only",
        label: "JSONPatch",
        description: "仅输出 JSONPatch 块，运行时同样会识别",
        content: "<JSONPatch>\n```json\n[\n  {\n    \"op\": \"replace\",\n    \"path\": \"/stat_data/系统/积分\",\n    \"value\": 1\n  }\n]\n```\n</JSONPatch>"
    }
];
const CHARACTER_CARD_MENU_WIDTH = 280;
const CHARACTER_CARD_MENU_MAX_HEIGHT = 320;
function resolveText() {
    const rawLocale = getLang();
    const locale = String(rawLocale || "").trim().toLowerCase();
    const preferredLocale = locale.startsWith("en") ? "en-US" : "zh-CN";
    return (0, i18n_1.resolveWorldBookI18n)(preferredLocale);
}
function normalizeFormInjectPosition(target, position) {
    if (target === "assistant") {
        return "at_depth";
    }
    return position === "prepend" || position === "at_depth" ? position : "append";
}
function appendSnippetContent(currentContent, snippetContent) {
    const normalizedSnippet = String(snippetContent || "").trim();
    if (!normalizedSnippet) {
        return currentContent;
    }
    const normalizedCurrent = String(currentContent || "");
    if (!normalizedCurrent.trim()) {
        return normalizedSnippet;
    }
    if (normalizedCurrent.endsWith("\n\n")) {
        return `${normalizedCurrent}${normalizedSnippet}`;
    }
    if (normalizedCurrent.endsWith("\n")) {
        return `${normalizedCurrent}\n${normalizedSnippet}`;
    }
    return `${normalizedCurrent}\n\n${normalizedSnippet}`;
}
function Screen(ctx) {
    const [uiTick, setUiTick] = ctx.useState("uiTick", 0);
    const entriesRef = ctx.useRef("entriesRef", []);
    const entries = entriesRef.current;
    const setEntries = (v) => { entriesRef.current = v; setUiTick(uiTick + 1); };
    const groupsRef = ctx.useRef("groupsRef", []);
    const groups = groupsRef.current;
    const setGroups = (v) => { groupsRef.current = v; setUiTick(uiTick + 1); };
    const expandedGroupIdsRef = ctx.useRef("expandedGroupIdsRef", []);
    const expandedGroupIds = expandedGroupIdsRef.current;
    const setExpandedGroupIds = (v) => { expandedGroupIdsRef.current = v; setUiTick(uiTick + 1); };
    const [loading, setLoading] = ctx.useState("loading", false);
    const [hasLoadedOnce, setHasLoadedOnce] = ctx.useState("hlo", false);
    const [initialLoadInFlight, setInitialLoadInFlight] = ctx.useState("ilif", false);
    const [view, setView] = ctx.useState("view", "list");
    const [deletingEntryId, setDeletingEntryId] = ctx.useState("dei", "");
    const [togglingEntryId, setTogglingEntryId] = ctx.useState("tei", "");
    const [importing, setImporting] = ctx.useState("importing", false);
    const [showSearchBar, setShowSearchBar] = ctx.useState("ssb", false);
    const [showHiddenStateV, setShowHiddenState] = ctx.useState("showHidden", false);
    const showHiddenRef = ctx.useRef("showHiddenRef", false);
    const showHidden = showHiddenRef.current;
    const [hiddenIds, setHiddenIds] = ctx.useState("hiddenIds", []);
    const hiddenIdsSet = new Set(Array.isArray(hiddenIds) ? hiddenIds : []);
    const setShowHidden = (v) => { showHiddenRef.current = v === true; setShowHiddenState(v === true); setTimeout(() => { loadEntries(true); }, 0); };
    const [selMode, setSelMode] = ctx.useState("sm", false);
    const selIdsRef = ctx.useRef("selIdsRef", []);
    const [batchTarget, setBatchTarget] = ctx.useState("bt", "system");
    const [batchPos, setBatchPos] = ctx.useState("bp", "append");
    const [batchDepth, setBatchDepth] = ctx.useState("bd", "0");
    const [selGroupId, setSelGroupId] = ctx.useState("sgid", "");
    const [aiRecallOn, setAiRecallOn] = ctx.useState("aron", false);
    const [aiRecallMode, setAiRecallMode] = ctx.useState("armd", "keyword");
    const [aiApiBase, setAiApiBase] = ctx.useState("aab", "");
    const [aiApiKey, setAiApiKey] = ctx.useState("aak", "");
    const [aiModel, setAiModel] = ctx.useState("amdl", "");
    const aiCfgLoadedRef = ctx.useRef("aiCfgLoadedRef", false);
    const searchQueryRef = ctx.useRef("searchQueryRef", "");
    const searchQuery = searchQueryRef.current;
    const setSearchQuery = (v) => { searchQueryRef.current = v; setUiTick(uiTick + 1); };
    const [editId, setEditId] = ctx.useState("editId", "");
    const importPathRef = ctx.useRef("importPathRef", "");
    const importPath = importPathRef.current;
    const setImportPath = (v) => { importPathRef.current = v; setUiTick(uiTick + 1); };
    const formNameRef = ctx.useRef("formNameRef", "");
    const formName = formNameRef.current;
    const setFormName = (v) => { formNameRef.current = v; setUiTick(uiTick + 1); };
    const formContentRef = ctx.useRef("formContentRef", "");
    const formContent = formContentRef.current;
    const setFormContent = (v) => { formContentRef.current = v; setUiTick(uiTick + 1); };
    const formKeywordsRef = ctx.useRef("formKeywordsRef", "");
    const formKeywords = formKeywordsRef.current;
    const setFormKeywords = (v) => { formKeywordsRef.current = v; setUiTick(uiTick + 1); };
    const [formIsRegex, setFormIsRegex] = ctx.useState("formIsRegex", false);
    const [formCaseSensitive, setFormCaseSensitive] = ctx.useState("fcs", false);
    const [formRecallMode, setFormRecallMode] = ctx.useState("frm", "keyword");
    const [formAlwaysActive, setFormAlwaysActive] = ctx.useState("faa", false);
    const [formEnabled, setFormEnabled] = ctx.useState("formEnabled", true);
    const [formPriority, setFormPriority] = ctx.useState("formPriority", "50");
    const [formScanDepth, setFormScanDepth] = ctx.useState("formScanDepth", "0");
    const [formInjectTarget, setFormInjectTarget] = ctx.useState("fit", "system");
    const [formInjectPosition, setFormInjectPosition] = ctx.useState("fip", "append");
    const [formInsertionDepth, setFormInsertionDepth] = ctx.useState("fid", "0");
    const [formCharacterCardId, setFormCharacterCardId] = ctx.useState("fcci", "");
    const [showCardPicker, setShowCardPicker] = ctx.useState("scp", false);
    const [showSnippetPicker, setShowSnippetPicker] = ctx.useState("ssp", false);
    const [loadingCards, setLoadingCards] = ctx.useState("lkc", false);
    const availableCardsRef = ctx.useRef("availableCardsRef", []);
    const availableCards = availableCardsRef.current;
    const setAvailableCards = (v) => { availableCardsRef.current = v; setUiTick(uiTick + 1); };
    const [hasLoadedCards, setHasLoadedCards] = ctx.useState("hlc", false);
    // Group form state
    const [groupFormName, setGroupFormName] = ctx.useState("gfn", "");
    const groupFormEntryIdsRef = ctx.useRef("groupFormEntryIdsRef", []);
    const groupFormEntryIds = groupFormEntryIdsRef.current;
    const setGroupFormEntryIds = (v) => { groupFormEntryIdsRef.current = v; setUiTick(uiTick + 1); };
    const groupFormCardIdsRef = ctx.useRef("groupFormCardIdsRef", []);
    const groupFormCardIds = groupFormCardIdsRef.current;
    const setGroupFormCardIds = (v) => { groupFormCardIdsRef.current = v; setUiTick(uiTick + 1); };
    const [editingGroupId, setEditingGroupId] = ctx.useState("egi", "");
    const [deletingGroupId, setDeletingGroupId] = ctx.useState("dgi", "");
    const [copyingEntryId, setCopyingEntryId] = ctx.useState("cei", "");
    const [confirmDeleteEntryId, setConfirmDeleteEntryId] = ctx.useState("cdei", "");
    const enhDataRef = ctx.useRef("enhDataRef", );
    const enhData = enhDataRef.current;
    const setEnhData = (v) => { enhDataRef.current = v; setUiTick(uiTick + 1); };
    const [tplOn, setTplOn] = ctx.useState("tplOn", false);
    const tplTextRef = ctx.useRef("tplTextRef", "");
    const tplText = tplTextRef.current;
    const setTplText = (v) => { tplTextRef.current = v; setUiTick(uiTick + 1); };
    const tplOutRef = ctx.useRef("tplOutRef", "");
    const tplOut = tplOutRef.current;
    const setTplOut = (v) => { tplOutRef.current = v; setUiTick(uiTick + 1); };
    const autoSrcRef = ctx.useRef("autoSrcRef", "");
    const autoSrc = autoSrcRef.current;
    const setAutoSrc = (v) => { autoSrcRef.current = v; setUiTick(uiTick + 1); };
    const [autoMode, setAutoMode] = ctx.useState("autoMode", "worldbook");
    const autoPromptRef = ctx.useRef("autoPromptRef", "");
    const autoPrompt = autoPromptRef.current;
    const setAutoPrompt = (v) => { autoPromptRef.current = v; setUiTick(uiTick + 1); };
    const autoReplyRef = ctx.useRef("autoReplyRef", "");
    const autoReply = autoReplyRef.current;
    const setAutoReply = (v) => { autoReplyRef.current = v; setUiTick(uiTick + 1); };
    const [stMode, setStMode] = ctx.useState("stMode", "export");
    const stInRef = ctx.useRef("stInRef", "");
    const stIn = stInRef.current;
    const setStIn = (v) => { stInRef.current = v; setUiTick(uiTick + 1); };
    const stOutRef = ctx.useRef("stOutRef", "");
    const stOut = stOutRef.current;
    const setStOut = (v) => { stOutRef.current = v; setUiTick(uiTick + 1); };
    const dslTextRef = ctx.useRef("dslTextRef", "");
    const dslText = dslTextRef.current;
    const setDslText = (v) => { dslTextRef.current = v; setUiTick(uiTick + 1); };
    const dslOutRef = ctx.useRef("dslOutRef", "");
    const dslOut = dslOutRef.current;
    const setDslOut = (v) => { dslOutRef.current = v; setUiTick(uiTick + 1); };
    const cmdTextRef = ctx.useRef("cmdTextRef", "");
    const cmdText = cmdTextRef.current;
    const setCmdText = (v) => { cmdTextRef.current = v; setUiTick(uiTick + 1); };
    const cmdOutRef = ctx.useRef("cmdOutRef", "");
    const cmdOut = cmdOutRef.current;
    const setCmdOut = (v) => { cmdOutRef.current = v; setUiTick(uiTick + 1); };
    const distillSrcRef = ctx.useRef("distillSrcRef", "");
    const distillSrc = distillSrcRef.current;
    const setDistillSrc = (v) => { distillSrcRef.current = v; setUiTick(uiTick + 1); };
    const distillOutRef = ctx.useRef("distillOutRef", "");
    const distillOut = distillOutRef.current;
    const setDistillOut = (v) => { distillOutRef.current = v; setUiTick(uiTick + 1); };
    const [distillLimit, setDistillLimit] = ctx.useState("dl", "12000");
    const [distillView, setDistillView] = ctx.useState("dv", "report");
    const distillChunksRef = ctx.useRef("distillChunksRef", []);
    const distillChunks = distillChunksRef.current;
    const setDistillChunks = (v) => { distillChunksRef.current = v; setUiTick(uiTick + 1); };
    const distillBookRef = ctx.useRef("distillBookRef", []);
    const distillBook = distillBookRef.current;
    const setDistillBook = (v) => { distillBookRef.current = v; setUiTick(uiTick + 1); };
    const dbgInputRef = ctx.useRef("dbgInputRef", "");
    const dbgInput = dbgInputRef.current;
    const setDbgInput = (v) => { dbgInputRef.current = v; setUiTick(uiTick + 1); };
    const dbgHitsRef = ctx.useRef("dbgHitsRef", []);
    const dbgHits = dbgHitsRef.current;
    const setDbgHits = (v) => { dbgHitsRef.current = v; setUiTick(uiTick + 1); };
    const dbgReportRef = ctx.useRef("dbgReportRef", "");
    const dbgReport = dbgReportRef.current;
    const setDbgReport = (v) => { dbgReportRef.current = v; setUiTick(uiTick + 1); };
    const [dbgSens, setDbgSens] = ctx.useState("dbgSens", "70");
    const [dbgBudget, setDbgBudget] = ctx.useState("dbgBudget", "8000");
    const dbgBlockRef = ctx.useRef("dbgBlockRef", "");
    const dbgBlock = dbgBlockRef.current;
    const setDbgBlock = (v) => { dbgBlockRef.current = v; setUiTick(uiTick + 1); };
    const aiJudgeOutRef = ctx.useRef("aiJudgeOutRef", "");
    const aiJudgeOut = aiJudgeOutRef.current;
    const setAiJudgeOut = (v) => { aiJudgeOutRef.current = v; setUiTick(uiTick + 1); };
    const [aiJudgeBusy, setAiJudgeBusy] = ctx.useState("ajb", false);
    const [kwGenBusy, setKwGenBusy] = ctx.useState("kgb", false);
    const blockOutRef = ctx.useRef("blockOutRef", "");
    const blockOut = blockOutRef.current;
    const setBlockOut = (v) => { blockOutRef.current = v; setUiTick(uiTick + 1); };
    const t = resolveText();
    const colors = ctx.MaterialTheme.colorScheme;
    const { UI } = ctx;
    const effectiveInjectPosition = normalizeFormInjectPosition(formInjectTarget, formInjectPosition);
    function getFormContentValue() {
        return formContentRef.current;
    }
    function setFormContentValue(value) {
        formContentRef.current = value;
        setFormContent(value);
    }
    function resetForm() {
        setEditId("");
        setFormName("");
        setFormContentValue("");
        setFormKeywords("");
        setFormIsRegex(false);
        setFormCaseSensitive(false);
        setFormRecallMode("keyword");
        setFormAlwaysActive(false);
        setFormEnabled(true);
        setFormPriority("50");
        setFormScanDepth("0");
        setFormInjectTarget("system");
        setFormInjectPosition("append");
        setFormInsertionDepth("0");
        setFormCharacterCardId("");
        setShowCardPicker(false);
        setShowSnippetPicker(false);
        setLoadingCards(false);
    }
    function resetImportForm() {
        setImportPath("");
        setImporting(false);
    }
    function renderEnhancePanel() {
        const d = enhData;
        const card = (title, lines) => UI.Card({ containerColor: colors.surface, elevation: 1, modifier: ctx.Modifier.fillMaxWidth() }, [
            UI.Column({ padding: 12, fillMaxWidth: true, spacing: 4 }, [
                UI.Text({ text: title, fontWeight: "bold", color: colors.onSurface }),
                ...lines.map((ln) => UI.Text({ text: ln, style: "bodySmall", color: colors.onSurfaceVariant }))
            ])
        ]);
        const nodes = [];
        nodes.push(UI.Card({ containerColor: colors.primaryContainer.copy({ alpha: 0.25 }), elevation: 1, modifier: ctx.Modifier.fillMaxWidth() }, [
            UI.Column({ padding: 12, fillMaxWidth: true, spacing: 6 }, [
                UI.Text({ text: "增强工具箱（可操作）", fontWeight: "bold", color: colors.onSurface }),
                UI.Text({ text: "隐藏/恢复/强制激活在列表条目上操作；以下为全局工具。", style: "bodySmall", color: colors.onSurfaceVariant }),
                UI.Row({ spacing: 8 }, [
                    UI.OutlinedButton({ onClick: () => wbPlusLoadBindings(), shape: { cornerRadius: 12 }, weight: 1 }, [UI.Text({ text: "绑定总览" })]),
                    UI.OutlinedButton({ onClick: () => wbPlusLoadOrphans(), shape: { cornerRadius: 12 }, weight: 1 }, [UI.Text({ text: "孤儿检测" })])
                ]),
                UI.Row({ spacing: 8 }, [
                    UI.OutlinedButton({ onClick: () => wbPlusClearHidden(), shape: { cornerRadius: 12 }, weight: 1 }, [UI.Text({ text: "恢复全部隐藏" })]),
                    UI.OutlinedButton({ onClick: () => { loadEnhance(); }, shape: { cornerRadius: 12 }, weight: 1 }, [UI.Text({ text: "重新分析" })])
                ]),
                d && d.bindings ? UI.Text({ text: "绑定：共 " + d.bindings.total + "｜全局 " + d.bindings.global_count + "｜角色卡 " + d.bindings.card_count + "｜分组 " + d.bindings.group_count, style: "bodySmall", color: colors.onSurfaceVariant }) : null,
                d && d.orphans ? UI.Text({ text: "孤儿：" + d.orphans.orphan_count + " 条未归组 / 共 " + d.orphans.total_entries + (d.orphans.stale_refs ? "｜失效引用 " + d.orphans.stale_refs : "") + (d.orphans.orphan_count ? "（" + d.orphans.orphans.slice(0, 4).map(function (o) { return o.name; }).join("、") + "…）" : ""), style: "bodySmall", color: colors.onSurfaceVariant }) : null
            ].filter(Boolean))
        ]));
        if (!d) {
            nodes.push(card("增强分析", ["尚未加载，点右上「重新分析」"]));
        }
        else {
            const h = d.health;
            nodes.push(card("健康检查", [
                `条目 ${h.total}｜启用 ${h.enabled}｜禁用 ${h.disabled}`,
                `常驻 ${h.always_active}｜关键词触发 ${h.keyword_triggered}`,
                `总 token ${h.total_tokens}｜启用 token ${h.enabled_tokens}`,
                `死条目 ${h.dead_entries.length}｜超大条目 ${h.oversized.length}`
            ]));
            nodes.push(card("去重检测", [
                d.dupes.length === 0 ? "无重复簇" : `发现 ${d.dupes.length} 组重复`,
                ...d.dupes.slice(0, 5).map((c) => `${c.names.join(" / ")}`)
            ]));
            nodes.push(card("Token 预算（上限 20000）", [
                `当前 ${d.budget.current_tokens}｜超出 ${d.budget.overflow}`,
                `裁剪候选 ${d.budget.cut_candidates.length} 条`
            ]));
            nodes.push(card("关键词冲突", [
                d.conflicts.length === 0 ? "无冲突" : `${d.conflicts.length} 组冲突`,
                ...d.conflicts.slice(0, 6).map((c) => `「${c.keyword}」×${c.entry_ids.length}`)
            ]));
            if (d.activation) {
                const aw = d.activation.words || {};
                nodes.push(card("激活检测（三路门控）", [
                    `配置激活词 ${d.activation.word_count} 个`,
                    `子串词 ${(aw.activation_words || []).length}｜精确词 ${(aw.exact_match_words || []).length}`,
                    d.activation.word_count === 0
                        ? "未配置——关键词注入不设门控"
                        : "已启用——消息命中（子串/词边界/CJK【】）才放行关键词注入"
                ]));
            }
            if (d.kb) {
                nodes.push(card("素材库召回", [
                    `可召回条目 ${d.kb.candidates} / ${d.kb.total}`,
                    "加权评分：主关键词 ×3｜别名 ×2｜副关键词门控 ×0.3｜名称命中 +1"
                ]));
            }
            nodes.push(d.event
                ? card("事件状态机", [
                    `当前故事日 第 ${d.event.day} 天`,
                    d.event.active
                        ? `进行中：${d.event.active.status}｜累计概率 ${d.event.active.chance}%｜揭晓日 第 ${d.event.active.revealDay} 天`
                        : "无进行中事件"
                ])
                : card("事件状态机", ["尚未初始化"]));
        }
        nodes.push(UI.Card({ containerColor: colors.surface, elevation: 1, modifier: ctx.Modifier.fillMaxWidth() }, [
            UI.Column({ padding: 12, fillMaxWidth: true, spacing: 4 }, [
                UI.Text({ text: "注入预览", fontWeight: "bold", color: colors.onSurface }),
                UI.Text({ text: wbPlusInjectSummary(), style: "bodySmall", color: colors.onSurfaceVariant }),
                UI.Text({ text: "token " + wbPlusTokens(dbgInput || searchQuery), style: "bodySmall", color: colors.onSurfaceVariant })
            ].concat(wbPlusInjectPreview().map(function (ln) {
                return UI.Text({ text: ln, style: "bodySmall", color: colors.onSurfaceVariant });
            })))
        ]));
        nodes.push(wbPlusDbgInjectionCard());
        nodes.push(wbPlusCmdCard());
        nodes.push(wbPlusDslCard());
        nodes.push(wbPlusDistillCard());
        nodes.push(wbPlusStCard());
        nodes.push(wbPlusTplCard());
        nodes.push(wbPlusAutoCard());
        nodes.push(wbPlusAiRecallCard());
        return UI.LazyColumn({ fillMaxSize: true, spacing: 12, padding: { horizontal: 12, vertical: 8 } }, nodes);
    }
    async function loadEnhance() {
        try {
            let enhanceHiddenSet = new Set();
            try {
                const hidden = await (0, wb_data_js_1.readHiddenIds)();
                enhanceHiddenSet = new Set(Array.isArray(hidden) ? hidden : []);
            }
            catch (_he) { enhanceHiddenSet = new Set(); }
            const wb = (await (0, wb_data_js_1.readEntries)())
                .filter((e) => !(0, task_expectation_bridge_js_1.isReservedEntry)(e))
                .filter((e) => !enhanceHiddenSet.has(String(e.id)));
            const actCfg = await (0, wb_data_js_1.readActivationConfig)();
            const evState = await (0, wb_data_js_1.readEventStateRaw)();
            const probe = String(searchQuery || "").trim();
            const activationProbe = probe
                ? (0, wb_data_js_1.detectActivation)(probe, actCfg)
                : { activated: false, reason: "none", matched: [] };
            let kbHits = [];
            if (probe) {
                const low = probe.toLowerCase();
                kbHits = wb
                    .map((e) => {
                    const d = (0, wb_data_js_1.scoreEntryDetailed)(e, low);
                    return { name: String(e.name || e.id || ""), score: d.score, matched: d.matched };
                })
                    .filter((x) => x.score > 0)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 6);
            }
            setEnhData({
                health: (0, wb_data_js_1.healthCheck)(wb, 1200),
                dupes: (0, wb_data_js_1.findDuplicates)(wb),
                budget: (0, wb_data_js_1.budgetAdvice)(wb, 20000),
                conflicts: (0, wb_data_js_1.findKeywordConflicts)(wb),
                activation: {
                    words: (actCfg.activation_words || []).length,
                    exact: (actCfg.exact_match_words || []).length,
                    total: (0, wb_data_js_1.activationWordCount)(actCfg),
                    probe,
                    activated: activationProbe.activated,
                    reason: activationProbe.reason,
                    matched: activationProbe.matched
                },
                kb: { probe, hits: kbHits },
                event: {
                    day: evState.day,
                    cycle: evState.cycle,
                    status: evState.activeEvent ? evState.activeEvent.status : "无",
                    chance: evState.activeEvent ? evState.activeEvent.chance : 0,
                    history: Array.isArray(evState.history) ? evState.history.length : 0
                }
            });
        }
        catch (error) {
            ctx.showToast(`增强分析失败：${error.message}`);
        }
    }
    function wbPlusKwList(kw) {
        return String(kw || "").split(/[,，;；\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
    }
    function wbPlusKwRemove(kw, target) {
        return wbPlusKwList(kw).filter(function (s) { return s !== target; }).join(",");
    }
    function wbPlusTokens(text) {
        var s = String(text || "");
        if (!s) return 0;
        var cjk = (s.match(/[\u4e00-\u9fff]/g) || []).length;
        return cjk + Math.ceil((s.length - cjk) / 4);
    }
    function wbPlusInjectSummary() {
        var tgt = formInjectTarget || "system";
        var pos = formInjectPosition || "append";
        var d = Math.max(0, parseInt(formInsertionDepth, 10) || 0);
        var eff = pos === "at_depth" ? ("历史末尾倒数第 " + d + " 条") : (pos === "prepend" ? "历史最前" : "历史最后");
        return "目标 " + tgt + " ｜ 位置 " + pos + " ｜ " + eff;
    }
    function wbPlusTargetDetail(t) {
        if (t === "system") return "写入系统提示区，最高优先级";
        if (t === "user") return "写入用户消息区，参与对话流";
        if (t === "assistant") return "写入助手消息区，需锁定位置";
        return String(t || "");
    }
    function wbPlusInsertionDepthDetail() {
        var d = Math.max(0, parseInt(formInsertionDepth, 10) || 0);
        if (d === 0) return "0 = 紧贴末尾";
        return "倒数第 " + d + " 条消息之前";
    }
    function wbPlusPositionLockReason(p) {
        if (p === "prepend") return "放最前，优先级最高";
        if (p === "append") return "放最后，优先级最低";
        if (p === "at_depth") return "插到历史中间，受深度控制";
        return String(p || "");
    }
    function wbPlusCopyBlock() {
        var b = String(dbgBlock || "");
        if (!b) { ctx.showToast("无内容可复制"); return; }
        try {
            if (typeof ctx.copyToClipboard === "function") {
                ctx.copyToClipboard(b);
                ctx.showToast("已复制 " + b.length + " 字符");
                return;
            }
        } catch (e) { }
        ctx.showToast("已生成完整块，可在下方文本框长按复制");
    }
    function wbPlusInjectPreview() {
        var wb = entries || [];
        var probe = String(searchQuery || "").trim().toLowerCase();
        var hits = [];
        if (probe) {
            wb.forEach(function (e) {
                try {
                    var d = (0, wb_data_js_1.scoreEntryDetailed)(e, probe);
                    if (d && d.score > 0) hits.push({ name: String(e.name || e.id || ""), score: d.score });
                } catch (err) { }
            });
            hits.sort(function (a, b) { return b.score - a.score; });
        }
        var always = wb.filter(function (e) { return e.enabled !== false && (e.always_active || e.alwaysActive); }).length;
        var lines = ["常驻 " + always + " 条 ｜ 命中 " + hits.length + " 条"];
        hits.slice(0, 5).forEach(function (h) { lines.push("· " + h.name + " [" + h.score + "]"); });
        return lines;
    }
    function wbPlusCmdRun() {
        var cmd = String(cmdText || "").trim();
        var out = [];
        if (!cmd) { out.push("空命令"); }
        else if (cmd.indexOf("/wb ") === 0 || cmd === "/wb") {
            out.push("命令层 /wb");
            out.push("列出条目 " + (entries || []).length + " 条");
            out.push("启用 " + (entries || []).filter(function (e) { return e.enabled !== false; }).length + " 条");
        } else if (cmd.indexOf("/quill") === 0) {
            out.push("命令层 /quill：素材库召回");
            out.push("探针 " + String(searchQuery || "").trim());
        } else if (cmd.indexOf("/char") === 0) {
            out.push("命令层 /char：角色卡绑定");
            out.push("当前绑定 " + (formCharacterCardId || "未绑定"));
        } else if (cmd.indexOf("/memory") === 0) {
            out.push("命令层 /memory：事件状态机");
        } else if (cmd.indexOf("/doc") === 0) {
            out.push("命令层 /doc：导入文档切块");
        } else {
            out.push("未知命令：" + cmd);
            out.push("可用 /wb /quill /char /memory /doc");
        }
        setCmdOut(out.join("\n"));
    }
    function wbPlusDslRun() {
        var s = String(dslText || "").trim();
        var lines = [];
        if (!s) { lines.push("空 DSL"); }
        else {
            s.split(/\n+/).forEach(function (ln) {
                var t = ln.trim();
                if (!t) return;
                var m = t.match(/^([A-Za-z_]+)\s*(.*)$/);
                if (m) lines.push("· " + m[1] + " → " + (m[2] || "(空)"));
                else lines.push("· " + t);
            });
        }
        setDslOut(lines.join("\n"));
    }
    function wbPlusDistillLimit() {
        var n = parseInt(distillLimit, 10);
        return Math.max(1000, isNaN(n) ? 12000 : n);
    }
    function wbPlusDistillChunk() {
        var raw = String(distillSrc || "").trim();
        if (!raw) { setDistillOut("空素材，请先粘贴小说文本"); setDistillView("chunk"); return; }
        try {
            var c = (0, wb_data_js_1.chunkNovel)(raw, wbPlusDistillLimit());
            setDistillChunks(c || []);
            setDistillView("chunk");
            setDistillOut("切块 " + (c || []).length + " 段 ｜ 上限 " + wbPlusDistillLimit());
        } catch (e) { setDistillOut("切块失败：" + e.message); }
    }
    function wbPlusDistillBook() {
        var raw = String(distillSrc || "").trim();
        if (!raw) { setDistillOut("空素材，请先粘贴小说文本"); setDistillView("book"); return; }
        try {
            var c = (0, wb_data_js_1.chunkNovel)(raw, wbPlusDistillLimit());
            var wb = (0, wb_data_js_1.buildWorldbookFromEntries)(c);
            setDistillBook(wb || []);
            setDistillChunks(c || []);
            setDistillView("book");
            setDistillOut("成书条目 " + (wb || []).length + " 条 ｜ 切块 " + (c || []).length + " 段");
        } catch (e) { setDistillOut("成书失败：" + e.message); }
    }
    function wbPlusDistillJson() {
        try {
            setDistillView("json");
            setDistillOut(JSON.stringify(distillBook || [], null, 2));
        } catch (e) { setDistillOut("JSON 输出失败：" + e.message); }
    }
    function wbPlusDistillMd() {
        try {
            setDistillView("md");
            var lines = ["# 世界书蒸馏结果", ""];
            (distillBook || []).forEach(function (e) {
                lines.push("## " + String(e.name || e.id || ""));
                var kws = Array.isArray(e.keywords) ? e.keywords.join(", ") : String(e.keywords || "");
                if (kws) lines.push("- 关键词: " + kws);
                lines.push("");
                lines.push(String(e.content || ""));
                lines.push("");
            });
            setDistillOut(lines.join("\n"));
        } catch (e) { setDistillOut("Markdown 输出失败：" + e.message); }
    }
    function wbPlusDistillReport() {
        try {
            setDistillView("report");
            var v = (0, wb_data_js_1.validateWorldbook)(distillBook || []);
            var lines = [
                "校验报告",
                "条目 " + (distillBook || []).length + " 条",
                "总 token " + (v.totalTokens || 0),
                "空内容 " + ((v.empty || []).length) + " 条",
                "超大条目 " + ((v.oversized || []).length) + " 条",
                "关键词冲突 " + ((v.conflicts || []).length) + " 组"
            ];
            if (v.empty && v.empty.length) lines.push("空条目标：" + v.empty.join(" / "));
            if (v.oversized && v.oversized.length) lines.push("超大：" + v.oversized.slice(0, 6).join(" / "));
            if (v.conflicts && v.conflicts.length) lines.push("冲突：" + v.conflicts.slice(0, 6).map(function (c) { return "「" + c.keyword + "」×" + (c.entry_ids || []).length; }).join(" / "));
            setDistillOut(lines.join("\n"));
        } catch (e) { setDistillOut("报告失败：" + e.message); }
    }
    function wbPlusStExport() {
        try {
            var out = (0, wb_data_js_1.toSillyTavernLorebook)(entries || []);
            setStOut(JSON.stringify(out).slice(0, 4000));
        } catch (e) { setStOut("导出失败：" + e.message); }
    }
    function wbPlusStImport() {
        try {
            var raw = JSON.parse(String(stIn || "{}"));
            var norm = (0, wb_data_js_1.normalizeImportedPayload)(raw);
            setStOut("解析 " + (norm && norm.entries ? norm.entries.length : 0) + " 条");
        } catch (e) { setStOut("导入失败：" + e.message); }
    }
    function wbPlusTplRender() {
        try {
            var ctxv = { user: "user", char: "char", vars: {}, global: {}, msg: {}, now: new Date().toLocaleString(), today: new Date().toISOString().slice(0, 10), entries: entries || [] };
            setTplOut((0, wb_data_js_1.renderEjsTemplate)(String(tplText || ""), ctxv));
        } catch (e) { setTplOut("[模板错误] " + e.message); }
    }
    function wbPlusTplStConvert() {
        try { setTplText((0, wb_data_js_1.convertStMacro)(String(tplText || ""))); }
        catch (e) { setTplOut("转换失败：" + e.message); }
    }
    function wbPlusAutoBuild() {
        try { setAutoPrompt((0, wb_data_js_1.buildAutoPrompt)(String(autoSrc || ""), autoMode, tplOn ? tplText : "")); }
        catch (e) { setAutoPrompt("装配失败：" + e.message); }
    }
    async function wbPlusAutoGen() {
        try {
            if (typeof Tools === "undefined" || !Tools.Chat || !Tools.Chat.call) { setAutoReply("通道不可用：Tools.Chat.call"); return; }
            var res = await Tools.Chat.call({ functionType: "CHAT", turns: [{ kind: "USER", content: String(autoPrompt || "") }], recordTokenUsage: false, enableThinking: false });
            setAutoReply(String((res && res.text) || ""));
        } catch (e) { setAutoReply("生成失败：" + e.message); }
    }
    function wbPlusCmdCard() {
        return UI.Card({ containerColor: colors.surface, elevation: 1, modifier: ctx.Modifier.fillMaxWidth() }, [
            UI.Column({ padding: 12, fillMaxWidth: true, spacing: 6 }, [
                UI.Text({ text: "命令层模拟", fontWeight: "bold", color: colors.onSurface }),
                UI.TextField({ label: "/wb /quill /char /memory /doc", value: cmdText, onValueChange: setCmdText, singleLine: true, fillMaxWidth: true }),
                UI.OutlinedButton({ onClick: function () { wbPlusCmdRun(); }, fillMaxWidth: true, shape: { cornerRadius: 12 } }, [UI.Text({ text: "执行" })]),
                UI.Text({ text: String(cmdOut || ""), style: "bodySmall", color: colors.onSurfaceVariant })
            ])
        ]);
    }
    function wbPlusDslCard() {
        return UI.Card({ containerColor: colors.surface, elevation: 1, modifier: ctx.Modifier.fillMaxWidth() }, [
            UI.Column({ padding: 12, fillMaxWidth: true, spacing: 6 }, [
                UI.Text({ text: "触发 DSL", fontWeight: "bold", color: colors.onSurface }),
                UI.TextField({ label: "PREGSYS 标记 / 规则", value: dslText, onValueChange: setDslText, singleLine: false, fillMaxWidth: true }),
                UI.OutlinedButton({ onClick: function () { wbPlusDslRun(); }, fillMaxWidth: true, shape: { cornerRadius: 12 } }, [UI.Text({ text: "解析" })]),
                UI.Text({ text: String(dslOut || ""), style: "bodySmall", color: colors.onSurfaceVariant })
            ])
        ]);
    }
    function wbPlusDistillCard() {
        var chunkList = distillChunks || [];
        var preview = [];
        if (distillView === "chunk") {
            preview = chunkList.slice(0, 6).map(function (c) {
                return "第 " + (c.index + 1) + " 段 ｜ " + c.chars + " 字 ｜ " + String(c.text || "").slice(0, 40) + "…";
            });
            if (chunkList.length > 6) preview.push("…共 " + chunkList.length + " 段");
        } else if (distillView === "book") {
            preview = (distillBook || []).slice(0, 6).map(function (e) {
                return "· " + String(e.name || e.id || "") + " ｜ " + (Array.isArray(e.keywords) ? e.keywords.length : 0) + " 关键词";
            });
        }
        return UI.Card({ containerColor: colors.surface, elevation: 1, modifier: ctx.Modifier.fillMaxWidth() }, [
            UI.Column({ padding: 12, fillMaxWidth: true, spacing: 6 }, [
                UI.Text({ text: "小说→世界书 蒸馏（切块/成书/校验）", fontWeight: "bold", color: colors.onSurface }),
                UI.TextField({ label: "小说原文", value: distillSrc, onValueChange: setDistillSrc, singleLine: false, fillMaxWidth: true }),
                UI.TextField({ label: "单块上限（字）", value: distillLimit, onValueChange: setDistillLimit, singleLine: true, fillMaxWidth: true }),
                UI.Text({ text: String(distillSrc || "").trim() ? "" : "未输入文本", style: "bodySmall", color: colors.onSurfaceVariant }),
                UI.Row({ spacing: 8 }, [
                    UI.OutlinedButton({ onClick: function () { wbPlusDistillChunk(); }, shape: { cornerRadius: 12 } }, [UI.Text({ text: "切块预览" })]),
                    UI.OutlinedButton({ onClick: function () { wbPlusDistillBook(); }, shape: { cornerRadius: 12 } }, [UI.Text({ text: "成书" })])
                ]),
                UI.Row({ spacing: 8 }, [
                    UI.OutlinedButton({ onClick: function () { wbPlusDistillJson(); }, shape: { cornerRadius: 12 } }, [UI.Text({ text: "JSON" })]),
                    UI.OutlinedButton({ onClick: function () { wbPlusDistillMd(); }, shape: { cornerRadius: 12 } }, [UI.Text({ text: "Markdown" })]),
                    UI.OutlinedButton({ onClick: function () { wbPlusDistillReport(); }, shape: { cornerRadius: 12 } }, [UI.Text({ text: "校验报告" })])
                ]),
                UI.Text({ text: "当前视图：" + String(distillView || "report"), style: "bodySmall", color: colors.onSurfaceVariant })
            ].concat(preview.map(function (ln) {
                return UI.Text({ text: ln, style: "bodySmall", color: colors.onSurfaceVariant });
            })).concat([
                UI.HorizontalDivider({ color: colors.outlineVariant, thickness: 1 }),
                UI.Text({ text: String(distillOut || "").slice(0, 2000), style: "bodySmall", color: colors.onSurfaceVariant })
            ]))
        ]);
    }
    function wbPlusStCard() {
        return UI.Card({ containerColor: colors.surface, elevation: 1, modifier: ctx.Modifier.fillMaxWidth() }, [
            UI.Column({ padding: 12, fillMaxWidth: true, spacing: 6 }, [
                UI.Text({ text: "酒馆兼容", fontWeight: "bold", color: colors.onSurface }),
                UI.Row({ spacing: 8 }, [
                    UI.OutlinedButton({ onClick: function () { setStMode("export"); wbPlusStExport(); }, shape: { cornerRadius: 12 } }, [UI.Text({ text: "导出 ST" })]),
                    UI.OutlinedButton({ onClick: function () { setStMode("import"); }, shape: { cornerRadius: 12 } }, [UI.Text({ text: "导入 ST" })])
                ]),
                stMode === "import" ? UI.TextField({ label: "粘贴 ST JSON", value: stIn, onValueChange: setStIn, singleLine: false, fillMaxWidth: true }) : null,
                stMode === "import" ? UI.OutlinedButton({ onClick: function () { wbPlusStImport(); }, fillMaxWidth: true, shape: { cornerRadius: 12 } }, [UI.Text({ text: "解析" })]) : null,
                UI.Text({ text: String(stOut || "").slice(0, 600), style: "bodySmall", color: colors.onSurfaceVariant })
            ].filter(Boolean))
        ]);
    }
    function wbPlusTplCard() {
        return UI.Card({ containerColor: colors.surface, elevation: 1, modifier: ctx.Modifier.fillMaxWidth() }, [
            UI.Column({ padding: 12, fillMaxWidth: true, spacing: 6 }, [
                UI.Row({ fillMaxWidth: true, verticalAlignment: "center" }, [
                    UI.Text({ text: "EJS 模板", fontWeight: "bold", color: colors.onSurface }),
                    UI.Switch({ checked: tplOn, onCheckedChange: setTplOn })
                ]),
                tplOn ? UI.TextField({ label: "EJS / ST 宏模板", value: tplText, onValueChange: setTplText, singleLine: false, fillMaxWidth: true }) : null,
                tplOn ? UI.Row({ spacing: 8 }, [
                    UI.OutlinedButton({ onClick: function () { wbPlusTplRender(); }, shape: { cornerRadius: 12 } }, [UI.Text({ text: "渲染" })]),
                    UI.OutlinedButton({ onClick: function () { wbPlusTplStConvert(); }, shape: { cornerRadius: 12 } }, [UI.Text({ text: "ST→EJS" })]),
                    UI.OutlinedButton({ onClick: function () { setTplText(""); setTplOut(""); }, shape: { cornerRadius: 12 } }, [UI.Text({ text: "清空" })])
                ]) : null,
                tplOn ? UI.Text({ text: String(tplOut || "").slice(0, 800), style: "bodySmall", color: colors.onSurfaceVariant }) : null
            ].filter(Boolean))
        ]);
    }
    function wbPlusAutoCard() {
        return UI.Card({ containerColor: colors.surface, elevation: 1, modifier: ctx.Modifier.fillMaxWidth() }, [
            UI.Column({ padding: 12, fillMaxWidth: true, spacing: 6 }, [
                UI.Text({ text: "半自动生成", fontWeight: "bold", color: colors.onSurface }),
                UI.TextField({ label: "素材", value: autoSrc, onValueChange: setAutoSrc, singleLine: false, fillMaxWidth: true }),
                UI.Row({ spacing: 8 }, ["worldbook", "entry", "summarize"].map(function (m) {
                    return UI.OutlinedButton({ onClick: function () { setAutoMode(m); }, shape: { cornerRadius: 12 } }, [UI.Text({ text: (autoMode === m ? "● " : "") + m })]);
                })),
                UI.OutlinedButton({ onClick: function () { wbPlusAutoBuild(); }, fillMaxWidth: true, shape: { cornerRadius: 12 } }, [UI.Text({ text: "装配提示词" })]),
                UI.Text({ text: String(autoPrompt || "").slice(0, 600), style: "bodySmall", color: colors.onSurfaceVariant }),
                UI.OutlinedButton({ onClick: function () { wbPlusAutoGen(); }, fillMaxWidth: true, shape: { cornerRadius: 12 } }, [UI.Text({ text: "生成" })]),
                UI.Text({ text: String(autoReply || "").slice(0, 800), style: "bodySmall", color: colors.onSurfaceVariant })
            ])
        ]);
    }
    function wbPlusDbgRound() {
        var probe = String(dbgInput || "").trim();
        if (!probe) { setDbgHits([]); setDbgReport("空探针"); setDbgBlock(""); return; }
        var sens = Math.max(0, Math.min(100, parseInt(dbgSens, 10) || 70));
        var wb = entries || [];
        var low = probe.toLowerCase();
        var hits = [];
        wb.forEach(function (e) {
            try {
                var d = (0, wb_data_js_1.scoreEntryDetailed)(e, low);
                if (d && d.score > 0) {
                    var minScore = sens >= 80 ? 1 : (sens >= 50 ? 2 : 3);
                    if (d.score >= minScore) {
                        var pos = e.inject_position || "append";
                        var tgt = e.inject_target || "system";
                        var depth = Math.max(0, parseInt(e.insertion_depth, 10) || 0);
                        var line = pos === "at_depth" ? ("索引 " + Math.max(0, 20 - depth)) : (pos === "prepend" ? "索引 0" : "索引 20");
                        hits.push({
                            name: String(e.name || e.id || ""),
                            score: d.score,
                            target: tgt,
                            position: pos,
                            depth: depth,
                            line: line,
                            tokens: (0, wb_data_js_1.entryTokens)(e)
                        });
                    }
                }
            } catch (err) { }
        });
        hits.sort(function (a, b) { return b.score - a.score; });
        setDbgHits(hits);
        var totalTok = hits.reduce(function (s, h) { return s + (h.tokens || 0); }, 0);
        setDbgReport("命中 " + hits.length + " ｜ token " + totalTok + " ｜ 探针 " + probe + " ｜ 灵敏度 " + sens);
        var picked = [];
        wb.forEach(function (e) {
            if (e.enabled === false) return;
            var always = e.always_active || e.alwaysActive;
            var hit = hits.some(function (h) { return h.name === String(e.name || e.id || ""); });
            if (always || hit) picked.push(e);
        });
        if (picked.length === 0) { setDbgBlock(""); return; }
        var T2 = String.fromCharCode(97, 115, 115, 105, 115, 116, 97, 110, 116);
        var ordMap = {}; ordMap["system"] = 0; ordMap["user"] = 1; ordMap[T2] = 2;
        var groups = {};
        var tList = [];
        picked.forEach(function (e) {
            var t = String(e.inject_target || "system");
            var pos = String(e.inject_position || "append");
            var dep = Math.max(0, parseInt(e.insertion_depth, 10) || 0);
            var pri = parseInt(e.priority, 10) || 0;
            var slot = pos === "prepend" ? 0 : (pos === "at_depth" ? (100 - dep) : 1000);
            if (!groups[t]) { groups[t] = []; tList.push(t); }
            groups[t].push({ e: e, pos: pos, dep: dep, pri: pri, slot: slot, tokens: (0, wb_data_js_1.entryTokens)(e) });
        });
        tList.sort(function (a, b) { return (ordMap[a] === undefined ? 9 : ordMap[a]) - (ordMap[b] === undefined ? 9 : ordMap[b]); });
        var lines = ["<worldbook>"];
        var budget = Math.max(100, parseInt(dbgBudget, 10) || 8000), usedTok = 0, usedCnt = 0, omitted = 0;
        tList.forEach(function (t) {
            var arr = groups[t];
            arr.sort(function (a, b) { return a.slot !== b.slot ? a.slot - b.slot : b.pri - a.pri; });
            lines.push("");
            lines.push("== " + t + " 区 " + arr.length + " 条 ==");
            arr.forEach(function (it) {
                var e = it.e;
                var name = String(e.name || e.id || "");
                var kws = Array.isArray(e.keywords) ? e.keywords.join(", ") : String(e.keywords || "");
                if (usedTok + it.tokens > budget) { omitted++; return; }
                usedTok += it.tokens; usedCnt++;
                var eff = it.pos === "at_depth" ? ("倒数第 " + it.dep + " 条") : (it.pos === "prepend" ? "最前" : "最后");
                lines.push("");
                lines.push("[" + name + "] pri=" + it.pri + " pos=" + it.pos + "(" + eff + ") tok=" + it.tokens);
                if (kws) lines.push("关键词: " + kws);
                lines.push(String(e.content || ""));
            });
        });
        lines.push("");
        lines.push("</worldbook>");
        lines.push("");
        lines.push("== 统计 == 注入 " + usedCnt + " 条 | token " + usedTok + "/" + budget + (omitted ? (" | 超预算省略 " + omitted + " 条") : ""));
        setDbgBlock(lines.join("\n"));
    }
    function wbPlusDbgSlotBar() {
        var hits = dbgHits || [];
        var out = [];
        for (var i = 0; i <= 20; i++) {
            var mark = "";
            hits.forEach(function (h) {
                var idx = parseInt(String(h.line).replace(/[^0-9]/g, ""), 10);
                if (idx === i) mark = "●";
            });
            out.push(mark || "·");
        }
        return out.join("");
    }
    function wbPlusDbgDupAdvice() {
        try {
            var wb = entries || [];
            var dup = (0, wb_data_js_1.findDuplicates)(wb);
            var cfl = (0, wb_data_js_1.findKeywordConflicts)(wb);
            return "去重 " + dup.length + " 组 ｜ 关键词冲突 " + cfl.length + " 组";
        } catch (e) { return "建议不可用"; }
    }
    async function wbPlusReadRecallCfg() {
        try {
            var r = await Tools.Files.read("/sdcard/Download/Operit/plugins/com.operit.worldbook/recall_config.json");
            var t = String((r && r.content) || "").trim();
            if (!t) return {};
            return JSON.parse(t) || {};
        } catch (_e) { return {}; }
    }
    async function wbPlusSelfApiCall(content, cfg) {
        var base = String((cfg && cfg.apiBase) || "").replace(/\/+$/, "");
        var key = String((cfg && cfg.apiKey) || "");
        if (base && key) {
            if (typeof Tools === "undefined" || !Tools.Net || !Tools.Net.http) throw new Error("通道不可用：Tools.Net.http");
            var bodyObj = { model: String((cfg && cfg.model) || "gpt-4o-mini"), messages: [{ role: "user", content: content }], temperature: 0 };
            var r = await Tools.Net.http({
                url: base + "/chat/completions",
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
                body: JSON.stringify(bodyObj),
                connect_timeout: 10,
                read_timeout: 25,
                validateStatus: false
            });
            var rawBody = String((r && r.content) || "");
            var sc = (r && r.statusCode) || 0;
            if (sc >= 400) throw new Error("HTTP " + sc + " | " + rawBody.slice(0, 200));
            var obj = null;
            try { obj = JSON.parse(rawBody); } catch (_pe) { obj = null; }
            if (obj && obj.choices && obj.choices[0]) {
                var ch0 = obj.choices[0];
                return { text: String((ch0.message && ch0.message.content) || ch0.text || "") };
            }
            return { text: rawBody };
        }
        if (typeof Tools === "undefined" || !Tools.Chat || !Tools.Chat.call) throw new Error("通道不可用：Tools.Chat.call");
        return await Tools.Chat.call({ functionType: "CHAT", turns: [{ kind: "USER", content: content }], recordTokenUsage: false, enableThinking: false });
    }
    function wbPlusTimeout(p, ms, label) {
        return Promise.race([
            Promise.resolve(p),
            new Promise(function (_ok, bad) { setTimeout(function () { bad(new Error((label || "操作") + "超时 " + ms + "ms")); }, ms); })
        ]);
    }
    async function wbPlusAiJudgeRun() {
        var probe = String(dbgInput || "").trim();
        if (!probe) { setAiJudgeOut("空探针"); return; }
        setAiJudgeBusy(true);
        setAiJudgeOut("判定中…");
        try {
            var wb = await wbPlusTimeout((0, wb_data_js_1.readEntries)(), 8000, "读取条目");
            var aiEntries = (wb || []).filter(function (e) { return e && e.enabled !== false && e.recall_mode === "ai"; });
            if (aiEntries.length === 0) { setAiJudgeOut("无 recall_mode=ai 的条目"); setAiJudgeBusy(false); return; }
            var lines = [];
            lines.push("你是世界书召回判定器。根据当前输入判断下列条目是否需要注入上下文。");
            lines.push("每条条目附有关键词，关键词是该条目最核心的触发线索，请重点参考；但不受关键词字面限制——语义相关、场景吻合也应判定召回。");
            lines.push("只输出 JSON 数组，元素形如 {\"i\": 序号, \"r\": true 或 false}，不要解释。");
            lines.push("");
            lines.push("【当前输入】");
            lines.push(probe);
            lines.push("");
            lines.push("【候选条目】");
            for (var i = 0; i < aiEntries.length; i += 1) {
                var e = aiEntries[i];
                var nm = String(e.name || e.id || "");
                var kw = Array.isArray(e.keywords) ? e.keywords.join("/") : "";
                var body = String(e.content || "").replace(/\s+/g, " ").slice(0, 200);
                lines.push((i + 1) + ". " + nm + (kw ? (" ｜ 关键词:" + kw) : "") + " ｜ " + body);
            }
            var __raw = await wbPlusTimeout(ctx.callTool("worldbook_plus_tools:wbplus_ai_judge", { probe: probe }), 40000, "工具判定");
            var __obj = __raw;
            if (typeof __obj === "string") { try { __obj = JSON.parse(__obj); } catch (_pe2) { __obj = null; } }
            if (!__obj || __obj.success !== true) throw new Error("工具判定失败：" + String((__obj && __obj.message) || __raw).slice(0, 300));
            var __det = (__obj.details || []).map(function (d) { return (d.r === true ? "召回 " : "跳过 ") + "#" + d.i + " " + String(d.name || ""); });
            var text = "";
            setAiJudgeOut(["工具通道 OK ｜ 候选 " + (__obj.count || 0) + " 条", "", "召回的 ID：" + ((__obj.approved || []).join(",") || "（无）"), "", "明细："].concat(__det).join("\n"));
            setAiJudgeBusy(false);
            return;
            var out = ["候选 " + aiEntries.length + " 条 ｜ 通道 OK", "", "原始返回（前 300 字）：", text.slice(0, 300), "", "解析结果："];
            var approved = [];
            try {
                var tt = text;
                tt = tt.replace(/<think[\s\S]*?<\/think>/gi, "");
                tt = tt.replace(/<thinking[\s\S]*?<\/thinking>/gi, "");
                var lc = Math.max(tt.lastIndexOf("</think>"), tt.lastIndexOf("</thinking>"));
                if (lc >= 0) tt = tt.slice(lc + 1);
                var m = tt.match(/\[[\s\S]*\]/);
                var arr = JSON.parse(m ? m[0] : tt);
                for (var j = 0; j < arr.length; j += 1) {
                    var it = arr[j] || {};
                    var idx = parseInt(it.i, 10);
                    var nm2 = (idx >= 1 && idx <= aiEntries.length) ? String(aiEntries[idx - 1].name || aiEntries[idx - 1].id || "") : "?";
                    out.push((it.r === true ? "召回 " : "跳过 ") + "#" + idx + " " + nm2);
                    if (it.r === true && idx >= 1 && idx <= aiEntries.length) {
                        approved.push(String(aiEntries[idx - 1].id));
                    }
                }
            } catch (pe) {
                out.push("解析失败：" + pe.message);
            }
            out.push("");
            out.push("应召回 ID：" + (approved.length > 0 ? approved.join(",") : "（无）"));
            setAiJudgeOut(out.join("\n"));
        } catch (e) {
            setAiJudgeOut("判定失败：" + (e && e.message ? e.message : String(e)));
        }
        setAiJudgeBusy(false);
    }
    async function wbPlusAiGenKeywords() {
        var nm = String(formName || "").trim();
        var body = String(formContent || "").trim();
        if (!nm && !body) { ctx.showToast("先填条目名或正文"); return; }
        setKwGenBusy(true);
        try {
            var lines = [];
            lines.push("你是世界书条目的关键词生成器。根据条目名与正文，提炼触发该条目召回的关键词。");
            lines.push("要求：输出 5-10 个关键词，逗号分隔，只输出关键词本身，不要编号、不要解释、不要 JSON。");
            lines.push("");
            lines.push("【条目名】");
            lines.push(nm || "（空）");
            lines.push("");
            lines.push("【正文】");
            lines.push(body.slice(0, 1500));
            var __cfg2 = await wbPlusReadRecallCfg();
            var res = await Promise.race([
                wbPlusSelfApiCall(lines.join("\n"), __cfg2),
                new Promise(function (_ok, bad) { setTimeout(function () { bad(new Error("调用超时30s")); }, 30000); })
            ]);
            var text = String((res && res.text) || "");
            var tt = text;
            tt = tt.replace(/<think[\s\S]*?<\/think>/gi, "");
            tt = tt.replace(/<thinking[\s\S]*?<\/thinking>/gi, "");
            var lc = Math.max(tt.lastIndexOf("</think>"), tt.lastIndexOf("</thinking>"));
            if (lc >= 0) tt = tt.slice(lc + 1);
            tt = tt.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
            var kws = tt.split(/[,，、\n]+/).map(function (x) { return x.replace(/^[\s\-*\d\.]+/, "").trim(); }).filter(function (x) { return x && x.length <= 30; });
            if (kws.length === 0) { ctx.showToast("AI 未返回可用关键词"); setKwGenBusy(false); return; }
            setFormKeywords(kws.join("，"));
            ctx.showToast("已生成 " + kws.length + " 个关键词");
        } catch (e) {
            ctx.showToast("生成失败：" + (e && e.message ? e.message : String(e)));
        }
        setKwGenBusy(false);
    }
    async function wbPlusUnifiedRun() {
        wbPlusDbgRound();
        await wbPlusAiJudgeRun();
    }
    function wbPlusDbgInjectionCard() {
        return UI.Card({ containerColor: colors.surface, elevation: 1, modifier: ctx.Modifier.fillMaxWidth() }, [
            UI.Column({ padding: 12, fillMaxWidth: true, spacing: 6 }, [
                UI.Text({ text: "注入调试器", fontWeight: "bold", color: colors.onSurface }),
                UI.TextField({ label: "模拟输入文本", value: dbgInput, onValueChange: setDbgInput, singleLine: false, fillMaxWidth: true }),
                UI.TextField({ label: "灵敏度 0-100", value: dbgSens, onValueChange: setDbgSens, singleLine: true, fillMaxWidth: true }),
                UI.TextField({ label: "token 预算上限", value: dbgBudget, onValueChange: setDbgBudget, singleLine: true, fillMaxWidth: true }),
                UI.OutlinedButton({ onClick: function () { wbPlusUnifiedRun(); }, fillMaxWidth: true, shape: { cornerRadius: 12 } }, [UI.Text({ text: aiJudgeBusy ? "运行中…（本地评分 + AI 判定）" : "运行调试（本地评分 + AI 判定）" })]),
                UI.Text({ text: String(aiJudgeOut || "点上方按钮，用 AI 判定 recall_mode=ai 的条目"), style: "bodySmall", color: colors.onSurfaceVariant }),
                UI.Text({ text: String(dbgReport || ""), style: "bodySmall", color: colors.onSurfaceVariant }),
                UI.Text({ text: "槽位 " + wbPlusDbgSlotBar(), style: "bodySmall", color: colors.onSurfaceVariant }),
                UI.Text({ text: wbPlusDbgDupAdvice(), style: "bodySmall", color: colors.onSurfaceVariant }),
                UI.Text({ text: "命中条目", fontWeight: "bold", style: "labelMedium", color: colors.onSurface })
            ].concat((dbgHits || []).length === 0
                ? [UI.Text({ text: "（无命中）", style: "bodySmall", color: colors.onSurfaceVariant })]
                : (dbgHits || []).map(function (h) {
                    return UI.Text({ text: "· " + h.name + " [" + h.score + "] " + h.target + "/" + h.position + " → " + h.line + " (" + h.tokens + "t)", style: "bodySmall", color: colors.onSurfaceVariant });
                })).concat([
                UI.Row({ spacing: 8 }, [
                    UI.OutlinedButton({ onClick: function () { wbPlusCopyBlock(); }, shape: { cornerRadius: 12 } }, [UI.Text({ text: "复制全文" })])
                ]),
                UI.Text({ text: "实际注入预览（拼装结果）", fontWeight: "bold", style: "labelMedium", color: colors.onSurface }),
                UI.Text({ text: String(dbgBlock || "（未生成，点上方「运行调试」）"), style: "bodySmall", color: colors.onSurfaceVariant })
            ]))
        ]);
    }
    async function loadEntries(force = false) {
        if (loading || (hasLoadedOnce && !force)) {
            return;
        }
        setLoading(true);
        try {
            const [fetchedEntries, fetchedGroups] = await Promise.all([
                (0, worldbook_service_js_1.listWorldBookEntries)(),
                (0, worldbook_service_js_1.listWorldBookGroups)()
            ]);
            let hiddenSet = new Set();
            try {
                const hidden = await (0, wb_data_js_1.readHiddenIds)();
                hiddenSet = new Set(Array.isArray(hidden) ? hidden : []);
            }
            catch (_he) { hiddenSet = new Set(); }
            setHiddenIds(Array.from(hiddenSet));
            const reveal = showHiddenRef.current === true;
            setEntries(fetchedEntries
                .filter((entry) => !(0, task_expectation_bridge_js_1.isReservedEntry)(entry))
                .filter((entry) => reveal || !hiddenSet.has(String(entry.id))));
            setGroups(fetchedGroups);
        }
        catch (error) {
            ctx.showToast(`${t.toastLoadFailedPrefix}${error.message}`);
        }
        finally {
            setLoading(false);
            setHasLoadedOnce(true);
        }
    }
    async function queryCharacterCards(showErrorToast) {
        try {
            const cards = await (0, worldbook_service_js_1.listWorldBookCharacterCards)();
            setAvailableCards(cards);
            setHasLoadedCards(true);
            return { success: true, cards };
        }
        catch (error) {
            if (showErrorToast) {
                ctx.showToast(`${t.toastRoleCardLoadFailedPrefix}${error.message}`);
            }
        }
        return { success: false, cards: [] };
    }
    async function ensureCharacterCardsLoaded(showErrorToast) {
        if (hasLoadedCards) {
            return availableCards;
        }
        const result = await queryCharacterCards(showErrorToast);
        return result.cards;
    }
    function findCharacterCard(cardId) {
        const targetId = String(cardId || "").trim();
        if (!targetId) {
            return null;
        }
        return availableCards.find((card) => String(card.id || "").trim() === targetId) || null;
    }
    function resolveCharacterCardName(cardId) {
        const matchedCard = findCharacterCard(cardId);
        return String(matchedCard?.name || "").trim();
    }
    function getCharacterCardLabel(cardId) {
        return resolveCharacterCardName(cardId) || t.dropdownBoundCard;
    }
    function selectInjectTarget(target) {
        setFormInjectTarget(target);
        if (target === "assistant") {
            setFormInjectPosition("at_depth");
        }
    }
    function selectInjectPosition(position) {
        if (formInjectTarget === "assistant" && position !== "at_depth") {
            return;
        }
        setFormInjectPosition(position);
    }
    function toggleSearchBar() {
        const nextVisible = !showSearchBar;
        setShowSearchBar(nextVisible);
        if (!nextVisible) {
            setSearchQuery("");
        }
    }
    function matchesEntrySearch(entry, query) {
        const normalizedQuery = String(query || "").trim().toLowerCase();
        if (!normalizedQuery) {
            return true;
        }
        const characterCardName = resolveCharacterCardName(entry.character_card_id || "");
        const haystack = [entry.name, ...(entry.keywords || []), characterCardName]
            .map((value) => String(value || "").trim().toLowerCase())
            .filter((value) => value.length > 0);
        return haystack.some((value) => value.includes(normalizedQuery));
    }
    function insertSnippet(snippetContent) {
        setFormContentValue(appendSnippetContent(getFormContentValue(), snippetContent));
        setShowSnippetPicker(false);
        ctx.showToast(t.toastSnippetInserted);
    }
    function getInjectTargetTag(entry) {
        if (entry.inject_target === "assistant") {
            return t.tagInjectAssistant;
        }
        if (entry.inject_target === "user") {
            return t.tagInjectUser;
        }
        return t.tagInjectSystem;
    }
    function getInjectPositionTag(entry) {
        if (entry.inject_position === "prepend") {
            return t.tagPositionPrepend;
        }
        if (entry.inject_position === "at_depth") {
            return t.tagPositionAtDepth(entry.insertion_depth ?? 0);
        }
        return t.tagPositionAppend;
    }
    async function doToggle(id) {
        if (togglingEntryId === id) {
            return;
        }
        setTogglingEntryId(id);
        try {
            await (0, worldbook_service_js_1.toggleWorldBookEntry)(id);
            ctx.showToast(t.toastToggleDone);
            await loadEntries(true);
        }
        catch (error) {
            ctx.showToast(`${t.toastActionFailedPrefix}${error.message}`);
        }
        finally {
            setTogglingEntryId("");
        }
    }
    async function doDelete(id, name) {
        if (deletingEntryId === id) {
            return;
        }
        setDeletingEntryId(id);
        try {
            await (0, worldbook_service_js_1.deleteWorldBookEntry)(id);
            ctx.showToast(`${t.toastDeletedPrefix}${name}`);
            await loadEntries(true);
        }
        catch (error) {
            ctx.showToast(`${t.toastDeleteFailedPrefix}${error.message}`);
        }
        finally {
            setDeletingEntryId("");
        }
    }
    async function doHide(id, name) {
        try {
            const cur = await (0, wb_data_js_1.readHiddenIds)();
            const set = new Set(Array.isArray(cur) ? cur : []);
            const isHidden = set.has(String(id));
            if (isHidden) {
                set.delete(String(id));
            }
            else {
                set.add(String(id));
            }
            await (0, wb_data_js_1.writeHiddenIds)(Array.from(set));
            ctx.showToast(isHidden ? `已恢复：${name}` : `已隐藏：${name}`);
            await loadEntries(true);
        }
        catch (error) {
            ctx.showToast(`${t.toastActionFailedPrefix}${error.message}`);
        }
    }
    async function doEdit(id) {
        setConfirmDeleteEntryId("");
        try {
            const entry = await (0, worldbook_service_js_1.getWorldBookEntry)(id);
            setEditId(entry.id);
            setFormName(entry.name || "");
            setFormContentValue(entry.content || "");
            setFormKeywords((entry.keywords || []).join("，"));
            setFormIsRegex(entry.is_regex === true);
            setFormCaseSensitive(entry.case_sensitive === true);
            setFormRecallMode(entry.recall_mode === "ai" ? "ai" : "keyword");
            setFormAlwaysActive(entry.always_active === true);
            setFormEnabled(entry.enabled !== false);
            setFormPriority(String(entry.priority ?? 50));
            setFormScanDepth(String(entry.scan_depth ?? 0));
            setFormInjectTarget(entry.inject_target || "system");
            setFormInjectPosition(normalizeFormInjectPosition(entry.inject_target || "system", entry.inject_position));
            setFormInsertionDepth(String(entry.insertion_depth ?? 0));
            setFormCharacterCardId(entry.character_card_id || "");
            setShowCardPicker(false);
            setShowSnippetPicker(false);
            setLoadingCards(false);
            if (entry.character_card_id && !findCharacterCard(entry.character_card_id)) {
                await ensureCharacterCardsLoaded(true);
            }
            setView("edit");
        }
        catch (error) {
            ctx.showToast(`${t.toastLoadFailedPrefix}${error.message}`);
        }
    }
    async function loadCardPicker() {
        if (showCardPicker) {
            setShowCardPicker(false);
            setLoadingCards(false);
            return;
        }
        setShowCardPicker(true);
        if (hasLoadedCards) {
            setLoadingCards(false);
            return;
        }
        setLoadingCards(true);
        const result = await queryCharacterCards(true);
        setLoadingCards(false);
        if (!result.success) {
            setShowCardPicker(false);
        }
    }
    function doPickCard(cardId) {
        setFormCharacterCardId(cardId || "");
        setShowCardPicker(false);
        setLoadingCards(false);
    }
    function doClearCardBinding() {
        setFormCharacterCardId("");
        setShowCardPicker(false);
        setLoadingCards(false);
    }
    function getSelectedCardLabel() {
        if (!formCharacterCardId) {
            return t.dropdownNoCharacterCard;
        }
        return getCharacterCardLabel(formCharacterCardId);
    }
    function toggleCardPicker() {
        return loadCardPicker();
    }
    function doCreate() {
        resetForm();
        setView("create");
    }
    function doOpenImport() {
        resetImportForm();
        setView("import");
    }
    async function doPickImportFile() {
        try {
            const result = await ctx.openFilePicker({
                mimeTypes: ["application/json", "text/plain", "*/*"],
                allowMultiple: false,
                persistPermission: true
            });
            if (result.cancelled || result.files.length === 0) {
                return;
            }
            setImportPath(String(result.files[0]?.path || result.files[0]?.uri || "").trim());
        }
        catch (error) {
            ctx.showToast(`${t.toastFailedPrefix}${error.message}`);
        }
    }
    async function doImport() {
        if (importing) {
            return;
        }
        if (!importPath.trim()) {
            ctx.showToast(t.toastImportPathRequired);
            return;
        }
        const payload = {
            path: importPath.trim()
        };
        setImporting(true);
        try {
            const result = await (0, worldbook_service_js_1.importWorldBookEntries)(payload);
            ctx.showToast(t.toastImportDone(result.imported_count, result.warning_count));
            setView("list");
            resetImportForm();
            await loadEntries(true);
        }
        catch (error) {
            ctx.showToast(`${t.toastFailedPrefix}${error.message}`);
        }
        finally {
            setImporting(false);
        }
    }
    async function doSave() {
        const currentFormContent = getFormContentValue();
        if (!formName.trim()) {
            ctx.showToast(t.toastNameRequired);
            return;
        }
        if (!currentFormContent.trim()) {
            ctx.showToast(t.toastContentRequired);
            return;
        }
        const isEdit = view === "edit" && !!editId;
        const normalizedInsertionDepth = Math.max(0, Number.parseInt(formInsertionDepth, 10) || 0);
        const payload = {
            name: formName.trim(),
            content: currentFormContent.trim(),
            keywords: formKeywords.trim(),
            is_regex: formIsRegex,
            case_sensitive: formCaseSensitive,
            always_active: formAlwaysActive,
            enabled: formEnabled,
            priority: Number.parseInt(formPriority, 10) || 50,
            scan_depth: Number.parseInt(formScanDepth, 10) || 0,
            inject_target: formInjectTarget,
            inject_position: effectiveInjectPosition,
            insertion_depth: normalizedInsertionDepth,
            character_card_id: formCharacterCardId.trim(),
            recall_mode: formRecallMode === "ai" ? "ai" : "keyword"
        };
        if (isEdit) {
            payload.id = editId;
        }
        try {
            if (isEdit) {
                await (0, worldbook_service_js_1.updateWorldBookEntry)(payload);
            }
            else {
                await (0, worldbook_service_js_1.createWorldBookEntry)(payload);
            }
            ctx.showToast(isEdit ? t.toastUpdated : t.toastCreated);
            setView("list");
            resetForm();
            await loadEntries(true);
        }
        catch (error) {
            ctx.showToast(`${t.toastSaveFailedPrefix}${error.message}`);
        }
    }
    async function doRefresh() {
        await Promise.all([loadEntries(true), queryCharacterCards(false)]);
    }
    function renderTag(label, backgroundColor, textColor) {
        return UI.Box({
            modifier: ctx.Modifier.clip({ cornerRadius: 8 }).background(backgroundColor)
        }, [
            UI.Text({
                text: label,
                style: "labelSmall",
                color: textColor,
                fontSize: 9,
                maxLines: 1,
                padding: { horizontal: 6, vertical: 2 }
            })
        ]);
    }
    function renderHeaderTag(label, backgroundColor, textColor) {
        return UI.Surface({
            shape: { cornerRadius: 8 },
            containerColor: backgroundColor
        }, [
            UI.Text({
                text: label,
                style: "labelSmall",
                color: textColor,
                fontSize: 9,
                padding: { horizontal: 6, vertical: 2 }
            })
        ]);
    }
    function renderSettingRow(title, description, checked, onCheckedChange) {
        return UI.Row({
            fillMaxWidth: true,
            horizontalArrangement: "spaceBetween",
            verticalAlignment: "center"
        }, [
            UI.Column({
                weight: 1,
                spacing: 2
            }, [
                UI.Text({
                    text: title,
                    color: colors.onSurface,
                    fontWeight: "bold"
                }),
                UI.Text({
                    text: description,
                    style: "bodySmall",
                    color: colors.onSurfaceVariant
                })
            ]),
            UI.Spacer({ width: 12 }),
            UI.Switch({
                checked,
                onCheckedChange
            })
        ]);
    }
    function renderCard(entry) {
        const isDeleting = deletingEntryId === entry.id;
        const isToggling = togglingEntryId === entry.id;
        const isEntryBusy = isDeleting || isToggling;
        const keywordText = entry.keywords && entry.keywords.length > 0 ? entry.keywords.join("、") : t.keywordEmpty;
        const characterCardName = resolveCharacterCardName(entry.character_card_id || "");
        const infoPills = [
            renderTag(keywordText, colors.secondaryContainer.copy({ alpha: 0.6 }), colors.onSecondaryContainer),
            renderTag(entry.always_active ? t.tagAlwaysActive : t.tagKeywordTrigger, colors.secondaryContainer.copy({ alpha: 0.6 }), colors.onSecondaryContainer),
            renderTag(t.tagPriority(entry.priority ?? 50), colors.secondaryContainer.copy({ alpha: 0.6 }), colors.onSecondaryContainer),
            renderTag(t.tagScanDepth(entry.scan_depth ?? 0), colors.secondaryContainer.copy({ alpha: 0.6 }), colors.onSecondaryContainer),
            renderTag(getInjectTargetTag(entry), colors.tertiaryContainer.copy({ alpha: 0.7 }), colors.onTertiaryContainer),
            renderTag(getInjectPositionTag(entry), colors.tertiaryContainer.copy({ alpha: 0.55 }), colors.onTertiaryContainer),
            entry.character_card_id
                ? renderTag(characterCardName ? t.tagCharacterCard(characterCardName) : t.dropdownBoundCard, colors.primaryContainer.copy({ alpha: 0.7 }), colors.onPrimaryContainer)
                : null
        ].filter(Boolean);
        return UI.Card({
            key: entry.id,
            containerColor: colors.surface,
            elevation: 1,
            modifier: ctx.Modifier.fillMaxWidth().clickable(() => {
                if (!isEntryBusy) {
                    return doEdit(entry.id);
                }
                return undefined;
            })
        }, [
            UI.Column({
                padding: 12,
                fillMaxWidth: true
            }, [
                UI.Row({
                    fillMaxWidth: true,
                    verticalAlignment: "center"
                }, [
                    UI.Box({
                        width: 28,
                        height: 28,
                        contentAlignment: "center",
                        modifier: ctx.Modifier
                            .clip({ cornerRadius: 6 })
                            .background(colors.primaryContainer)
                    }, [
                        UI.Icon({
                            name: "extension",
                            tint: colors.onPrimaryContainer,
                            size: 16
                        })
                    ]),
                    UI.Spacer({ width: 10 }),
                    UI.Column({
                        weight: 1
                    }, [
                        UI.Row({
                            verticalAlignment: "center"
                        }, [
                            UI.Text({
                                text: entry.name,
                                style: "bodyMedium",
                                fontWeight: "medium",
                                maxLines: 1,
                                overflow: "ellipsis",
                                weight: 1,
                                weightFill: false
                            }),
                            entry.always_active ? UI.Spacer({ width: 6 }) : null,
                            entry.always_active
                                ? renderHeaderTag(t.tagPinned, colors.primary.copy({ alpha: 0.1 }), colors.primary)
                                : null,
                            entry.is_regex ? UI.Spacer({ width: 6 }) : null,
                            entry.is_regex
                                ? renderHeaderTag(t.tagRegex, colors.secondary.copy({ alpha: 0.1 }), colors.secondary)
                                : null
                        ].filter(Boolean))
                    ].filter(Boolean)),
                    UI.Switch({
                        checked: entry.enabled,
                        onCheckedChange: (_checked) => doToggle(entry.id),
                        enabled: !isEntryBusy,
                        checkedThumbColor: colors.primary,
                        checkedTrackColor: colors.primaryContainer,
                        uncheckedThumbColor: colors.outline,
                        uncheckedTrackColor: colors.surfaceVariant,
                        modifier: ctx.Modifier.scale(0.8)
                    })
                ]),
                UI.Spacer({ height: 8 }),
                UI.Box({
                    modifier: ctx.Modifier
                        .fillMaxWidth()
                        .clip({ cornerRadius: 12 })
                        .background(selMode && wbPlusSelHas(entry.id) ? colors.primaryContainer.copy({ alpha: 0.55 }) : colors.surfaceVariant.copy({ alpha: 0.18 }))
                        .clickable(() => {
                        if (selMode) {
                            return wbPlusSelToggle(entry.id);
                        }
                        if (!isEntryBusy) {
                            return doEdit(entry.id);
                        }
                        return undefined;
                    })
                        .padding({ horizontal: 8, vertical: 6 })
                }, [
                    UI.Row({
                        fillMaxWidth: true,
                        verticalAlignment: "center"
                    }, [
                        UI.LazyRow({
                            weight: 1,
                            spacing: 4
                        }, infoPills),
                        UI.Spacer({ width: 6 }),
                        UI.Icon({
                            name: "arrowForward",
                            size: 14,
                            tint: colors.onSurfaceVariant.copy({ alpha: 0.7 })
                        })
                    ])
                ]),
                UI.Spacer({ height: 8 }),
                UI.Row({
                    fillMaxWidth: true,
                    spacing: 8
                }, [
                    UI.OutlinedButton({
                        onClick: () => doEdit(entry.id),
                        enabled: !isEntryBusy,
                        weight: 1,
                        height: 32,
                        contentPadding: { horizontal: 12 }
                    }, [
                        UI.Text({
                            text: t.buttonEdit,
                            style: "labelMedium",
                            fontSize: 12
                        })
                    ]),
                    UI.OutlinedButton({
                        onClick: () => doCopyEntry(entry.id),
                        enabled: !isEntryBusy,
                        weight: 1,
                        height: 32,
                        contentPadding: { horizontal: 12 }
                    }, [
                        UI.Text({
                            text: t.buttonCopy,
                            style: "labelMedium",
                            fontSize: 12
                        })
                    ]),
                    UI.OutlinedButton({
                        onClick: () => {
                            if (confirmDeleteEntryId === entry.id) {
                                setConfirmDeleteEntryId("");
                                return doDelete(entry.id, entry.name);
                            }
                            setConfirmDeleteEntryId(entry.id);
                            return undefined;
                        },
                        enabled: !isEntryBusy,
                        weight: 1,
                        height: 32,
                        contentPadding: { horizontal: 12 }
                    }, [
                        UI.Text({
                            text: confirmDeleteEntryId === entry.id ? t.groupDeleteConfirm : t.buttonDelete,
                            style: "labelMedium",
                            fontSize: 12,
                            color: confirmDeleteEntryId === entry.id ? colors.error : undefined
                        })
                    ]),
                    UI.OutlinedButton({
                        onClick: () => doHide(entry.id, entry.name),
                        enabled: !isEntryBusy,
                        weight: 1,
                        height: 32,
                        contentPadding: { horizontal: 12 }
                    }, [
                        UI.Text({
                            text: hiddenIdsSet && hiddenIdsSet.has(String(entry.id)) ? "恢复" : "隐藏",
                            style: "labelMedium",
                            fontSize: 12
                        })
                    ])
                ])
            ].filter(Boolean))
        ]);
    }
    // === Group helper functions ===
    function toggleGroupExpand(groupId) {
        const current = expandedGroupIds;
        if (current.includes(groupId)) {
            setExpandedGroupIds(current.filter((id) => id !== groupId));
        }
        else {
            setExpandedGroupIds([...current, groupId]);
        }
    }
    function getEntriesByGroup(entryIds) {
        return entries.filter((e) => entryIds.includes(e.id));
    }
    function getUngroupedEntries() {
        const allGroupedIds = new Set();
        for (const g of groups) {
            for (const eid of g.entry_ids) {
                allGroupedIds.add(eid);
            }
        }
        return entries.filter((e) => !allGroupedIds.has(e.id));
    }
    function getGroupEntryCount(group) {
        return entries.filter((e) => group.entry_ids.includes(e.id)).length;
    }
    // === Group actions ===
    function doOpenGroupCreate() {
        setGroupFormName("");
        setGroupFormEntryIds([]);
        setGroupFormCardIds([]);
        setEditingGroupId("");
        setView("group_create");
    }
    function doOpenGroupEdit(group) {
        setGroupFormName(group.name);
        setGroupFormEntryIds([...group.entry_ids]);
        setGroupFormCardIds([...group.character_card_ids]);
        setEditingGroupId(group.id);
        setView("group_edit");
    }
    function doOpenGroupDelete(groupId) {
        setDeletingGroupId(groupId);
        setView("group_delete");
    }
    async function doSaveGroup() {
        if (!groupFormName.trim()) {
            ctx.showToast(t.groupNamePlaceholder);
            return;
        }
        try {
            if (editingGroupId) {
                await (0, worldbook_service_js_1.updateWorldBookGroup)({
                    id: editingGroupId,
                    name: groupFormName.trim(),
                    entry_ids: groupFormEntryIds,
                    character_card_ids: groupFormCardIds
                });
                ctx.showToast(t.groupToastUpdated);
            }
            else {
                await (0, worldbook_service_js_1.createWorldBookGroup)({
                    name: groupFormName.trim(),
                    entry_ids: groupFormEntryIds,
                    character_card_ids: groupFormCardIds
                });
                ctx.showToast(t.groupToastCreated);
            }
            setView("list");
            await loadEntries(true);
        }
        catch (error) {
            ctx.showToast(`${t.toastActionFailedPrefix}${error.message}`);
        }
    }
    async function doDeleteGroup(deleteEntries) {
        try {
            await (0, worldbook_service_js_1.deleteWorldBookGroup)(deletingGroupId, deleteEntries);
            ctx.showToast(t.groupToastDeleted);
            setView("list");
            await loadEntries(true);
        }
        catch (error) {
            ctx.showToast(`${t.toastActionFailedPrefix}${error.message}`);
        }
    }
    function doCopyEntry(entryId) {
        setConfirmDeleteEntryId("");
        setCopyingEntryId(entryId);
        setView("copy_to_group");
    }
    async function doCopyToGroup(targetGroupId) {
        try {
            await (0, worldbook_service_js_1.copyEntryToGroup)(copyingEntryId, targetGroupId);
            ctx.showToast(t.copyToastDone);
            setView("list");
            await loadEntries(true);
        }
        catch (error) {
            ctx.showToast(`${t.toastActionFailedPrefix}${error.message}`);
        }
    }
    function toggleGroupFormEntry(entryId) {
        if (groupFormEntryIds.includes(entryId)) {
            setGroupFormEntryIds(groupFormEntryIds.filter((id) => id !== entryId));
        }
        else {
            setGroupFormEntryIds([...groupFormEntryIds, entryId]);
        }
    }
    function toggleGroupFormCard(cardId) {
        if (groupFormCardIds.includes(cardId)) {
            setGroupFormCardIds(groupFormCardIds.filter((id) => id !== cardId));
        }
        else {
            setGroupFormCardIds([...groupFormCardIds, cardId]);
        }
    }
    // === Group rendering ===
    function renderGroupHeader(group) {
        const isExpanded = expandedGroupIds.includes(group.id);
        const entryCount = getGroupEntryCount(group);
        const cardNames = group.character_card_ids
            .map((cid) => resolveCharacterCardName(cid))
            .filter((n) => n.length > 0);
        return UI.Column({
            key: `group_${group.id}`,
            fillMaxWidth: true,
            spacing: 0
        }, [
            UI.Box({
                fillMaxWidth: true,
                modifier: ctx.Modifier
                    .clip({ cornerRadius: 12 })
                    .background(colors.secondaryContainer.copy({ alpha: 0.25 }))
                    .clickable(() => toggleGroupExpand(group.id))
                    .padding({ horizontal: 14, vertical: 10 })
            }, [
                UI.Row({
                    fillMaxWidth: true,
                    verticalAlignment: "center"
                }, [
                    UI.Icon({
                        name: isExpanded ? "expandLess" : "expandMore",
                        size: 20,
                        tint: colors.onSecondaryContainer
                    }),
                    UI.Spacer({ width: 8 }),
                    UI.Column({ weight: 1 }, [
                        UI.Text({
                            text: `${group.name}（${entryCount}）`,
                            style: "bodyLarge",
                            fontWeight: "bold",
                            color: colors.onSurface
                        }),
                        cardNames.length > 0
                            ? UI.Text({
                                text: cardNames.join(", "),
                                style: "bodySmall",
                                color: colors.onSurfaceVariant,
                                maxLines: 1,
                                overflow: "ellipsis"
                            })
                            : null
                    ].filter(Boolean)),
                    UI.Box({
                        modifier: ctx.Modifier.clickable(() => wbPlusEnterGroupBatch(group.id))
                    }, [UI.Icon({ name: "check", size: 18, tint: (selMode && selGroupId === group.id) ? colors.primary : colors.onSurfaceVariant })]),
                    UI.Spacer({ width: 8 }),
                    UI.Box({
                        modifier: ctx.Modifier.clickable(() => doOpenGroupEdit(group))
                    }, [UI.Icon({ name: "settings", size: 18, tint: colors.onSurfaceVariant })]),
                    UI.Spacer({ width: 8 }),
                    UI.Box({
                        modifier: ctx.Modifier.clickable(() => doOpenGroupDelete(group.id))
                    }, [UI.Icon({ name: "delete", size: 18, tint: colors.error })])
                ])
            ]),
            isExpanded
                ? UI.Column({ fillMaxWidth: true, spacing: 10, paddingTop: 8 }, getEntriesByGroup(group.entry_ids).map((entry) => renderCard(entry)))
                : null
        ].filter(Boolean));
    }
    function renderUngroupedSection() {
        const ungrouped = getUngroupedEntries();
        if (ungrouped.length === 0)
            return null;
        const isExpanded = expandedGroupIds.includes("__ungrouped__");
        return UI.Column({
            key: "group_ungrouped",
            fillMaxWidth: true,
            spacing: 0
        }, [
            UI.Box({
                fillMaxWidth: true,
                modifier: ctx.Modifier
                    .clip({ cornerRadius: 12 })
                    .background(colors.surfaceVariant.copy({ alpha: 0.15 }))
                    .clickable(() => toggleGroupExpand("__ungrouped__"))
                    .padding({ horizontal: 14, vertical: 10 })
            }, [
                UI.Row({
                    fillMaxWidth: true,
                    verticalAlignment: "center"
                }, [
                    UI.Icon({
                        name: isExpanded ? "expandLess" : "expandMore",
                        size: 20,
                        tint: colors.onSurfaceVariant
                    }),
                    UI.Spacer({ width: 8 }),
                    UI.Text({
                        text: `${t.groupUngrouped}（${ungrouped.length}）`,
                        style: "bodyLarge",
                        fontWeight: "bold",
                        color: colors.onSurfaceVariant,
                        weight: 1
                    }),
                    UI.Box({
                        modifier: ctx.Modifier.clickable(() => wbPlusEnterGroupBatch("__ungrouped__"))
                    }, [UI.Icon({ name: "check", size: 18, tint: (selMode && selGroupId === "__ungrouped__") ? colors.primary : colors.onSurfaceVariant })])
                ])
            ]),
            isExpanded
                ? UI.Column({ fillMaxWidth: true, spacing: 10, paddingTop: 8 }, ungrouped.map((entry) => renderCard(entry)))
                : null
        ].filter(Boolean));
    }
    // === Group form views ===
    function renderGroupForm() {
        const isEdit = view === "group_edit";
        return UI.Column({ padding: 12, spacing: 12, fillMaxWidth: true }, [
            UI.Row({ fillMaxWidth: true }, [
                UI.OutlinedButton({ onClick: () => setView("list"), shape: { cornerRadius: 12 } }, [
                    UI.Row({ spacing: 6, verticalAlignment: "center" }, [
                        UI.Icon({ name: "arrowBack", size: 16, tint: colors.onSurface }),
                        UI.Text({ text: t.buttonBack, color: colors.onSurface, fontWeight: "bold" })
                    ])
                ])
            ]),
            UI.Text({
                text: isEdit ? t.groupEditTitle : t.groupCreateTitle,
                style: "titleMedium",
                fontWeight: "bold",
                color: colors.onSurface
            }),
            UI.TextField({
                label: t.groupNameLabel,
                placeholder: t.groupNamePlaceholder,
                value: groupFormName,
                onValueChange: setGroupFormName,
                singleLine: true,
                fillMaxWidth: true
            }),
            // Entry selection
            UI.Text({
                text: t.groupSelectEntries,
                style: "labelLarge",
                fontWeight: "bold",
                color: colors.onSurface
            }),
            UI.Text({
                text: t.groupSelectEntriesHint,
                style: "bodySmall",
                color: colors.onSurfaceVariant
            }),
            UI.Column({ fillMaxWidth: true, spacing: 4 }, entries.filter((entry) => {
                // Show: entries already in this group's form selection, or ungrouped entries
                if (groupFormEntryIds.includes(entry.id))
                    return true;
                // Check if this entry belongs to another group
                for (const g of groups) {
                    if (g.id === editingGroupId)
                        continue; // skip current group being edited
                    if (g.entry_ids.includes(entry.id))
                        return false;
                }
                return true;
            }).map((entry) => UI.Row({
                key: `gf_entry_${entry.id}`,
                fillMaxWidth: true,
                verticalAlignment: "center",
                modifier: ctx.Modifier
                    .clip({ cornerRadius: 8 })
                    .clickable(() => toggleGroupFormEntry(entry.id))
                    .padding({ horizontal: 8, vertical: 6 })
            }, [
                UI.Switch({
                    checked: groupFormEntryIds.includes(entry.id),
                    onCheckedChange: () => toggleGroupFormEntry(entry.id),
                    modifier: ctx.Modifier.scale(0.7)
                }),
                UI.Spacer({ width: 8 }),
                UI.Text({
                    text: entry.name,
                    style: "bodyMedium",
                    color: colors.onSurface,
                    maxLines: 1,
                    overflow: "ellipsis",
                    weight: 1
                })
            ]))),
            // Character card multi-binding
            UI.Text({
                text: t.groupBindCards,
                style: "labelLarge",
                fontWeight: "bold",
                color: colors.onSurface
            }),
            UI.Text({
                text: t.groupBindCardsHint,
                style: "bodySmall",
                color: colors.onSurfaceVariant
            }),
            UI.Column({ fillMaxWidth: true, spacing: 4 }, availableCards.map((card) => UI.Row({
                key: `gf_card_${card.id}`,
                fillMaxWidth: true,
                verticalAlignment: "center",
                modifier: ctx.Modifier
                    .clip({ cornerRadius: 8 })
                    .clickable(() => toggleGroupFormCard(card.id))
                    .padding({ horizontal: 8, vertical: 6 })
            }, [
                UI.Switch({
                    checked: groupFormCardIds.includes(card.id),
                    onCheckedChange: () => toggleGroupFormCard(card.id),
                    modifier: ctx.Modifier.scale(0.7)
                }),
                UI.Spacer({ width: 8 }),
                UI.Text({
                    text: card.name || card.id,
                    style: "bodyMedium",
                    color: colors.onSurface,
                    maxLines: 1,
                    overflow: "ellipsis",
                    weight: 1
                })
            ]))),
            groupFormCardIds.length > 0
                ? UI.Text({
                    text: t.multiCardSelected(groupFormCardIds.length),
                    style: "bodySmall",
                    color: colors.primary
                })
                : null,
            UI.Button({
                text: isEdit ? t.groupSaveButton : t.groupCreateButton,
                onClick: () => doSaveGroup(),
                fillMaxWidth: true,
                shape: { cornerRadius: 14 }
            })
        ].filter(Boolean));
    }
    function renderGroupDeleteView() {
        return UI.Column({ padding: 16, spacing: 16, fillMaxWidth: true }, [
            UI.Text({
                text: t.groupDeleteTitle,
                style: "titleMedium",
                fontWeight: "bold",
                color: colors.onSurface
            }),
            UI.Button({
                text: t.groupDeleteOnlyGroup,
                onClick: () => doDeleteGroup(false),
                fillMaxWidth: true,
                shape: { cornerRadius: 14 }
            }),
            UI.OutlinedButton({
                onClick: () => doDeleteGroup(true),
                fillMaxWidth: true,
                shape: { cornerRadius: 14 }
            }, [
                UI.Text({
                    text: t.groupDeleteWithEntries,
                    color: colors.error,
                    fontWeight: "bold"
                })
            ]),
            UI.OutlinedButton({
                onClick: () => setView("list"),
                fillMaxWidth: true,
                shape: { cornerRadius: 14 }
            }, [
                UI.Text({
                    text: t.groupDeleteCancel,
                    color: colors.onSurface
                })
            ])
        ]);
    }
    function renderCopyToGroupView() {
        return UI.Column({ padding: 16, spacing: 12, fillMaxWidth: true }, [
            UI.Row({ fillMaxWidth: true }, [
                UI.OutlinedButton({ onClick: () => setView("list"), shape: { cornerRadius: 12 } }, [
                    UI.Row({ spacing: 6, verticalAlignment: "center" }, [
                        UI.Icon({ name: "arrowBack", size: 16, tint: colors.onSurface }),
                        UI.Text({ text: t.buttonBack, color: colors.onSurface, fontWeight: "bold" })
                    ])
                ])
            ]),
            UI.Text({
                text: t.copyToGroupTitle,
                style: "titleMedium",
                fontWeight: "bold",
                color: colors.onSurface
            }),
            UI.Text({
                text: t.copyToGroupHint,
                style: "bodySmall",
                color: colors.onSurfaceVariant
            }),
            // Ungrouped option
            UI.Box({
                fillMaxWidth: true,
                modifier: ctx.Modifier
                    .clip({ cornerRadius: 10 })
                    .background(colors.surfaceVariant.copy({ alpha: 0.3 }))
                    .clickable(() => doCopyToGroup(""))
                    .padding({ horizontal: 14, vertical: 12 })
            }, [
                UI.Text({
                    text: t.copyToUngrouped,
                    color: colors.onSurface
                })
            ]),
            // Group options
            ...groups.map((g) => UI.Box({
                key: `copy_g_${g.id}`,
                fillMaxWidth: true,
                modifier: ctx.Modifier
                    .clip({ cornerRadius: 10 })
                    .background(colors.secondaryContainer.copy({ alpha: 0.2 }))
                    .clickable(() => doCopyToGroup(g.id))
                    .padding({ horizontal: 14, vertical: 12 })
            }, [
                UI.Text({
                    text: `${g.name}（${getGroupEntryCount(g)}）`,
                    color: colors.onSurface
                })
            ]))
        ]);
    }
    function renderSnippetDialog() {
        return UI.Box({
            fillMaxSize: true,
            contentAlignment: "center"
        }, [
            UI.Surface({
                fillMaxSize: true,
                containerColor: colors.scrim,
                alpha: 0.35,
                onClick: () => setShowSnippetPicker(false)
            }),
            UI.Card({
                fillMaxWidth: true,
                containerColor: colors.surface,
                shape: { cornerRadius: 20 },
                elevation: 8,
                modifier: ctx.Modifier.padding({ horizontal: 20, vertical: 32 })
            }, [
                UI.Column({
                    fillMaxWidth: true,
                    padding: 16,
                    spacing: 12
                }, [
                    UI.Row({
                        fillMaxWidth: true,
                        horizontalArrangement: "spaceBetween",
                        verticalAlignment: "center"
                    }, [
                        UI.Column({
                            weight: 1,
                            spacing: 4
                        }, [
                            UI.Text({
                                text: t.fieldContentTemplates,
                                style: "titleMedium",
                                fontWeight: "bold",
                                color: colors.onSurface
                            }),
                            UI.Text({
                                text: t.fieldContentTemplatesHint,
                                style: "bodySmall",
                                color: colors.onSurfaceVariant
                            })
                        ]),
                        UI.IconButton({
                            onClick: () => setShowSnippetPicker(false),
                            icon: Icons.Close
                        }, [])
                    ]),
                    UI.LazyColumn({
                        fillMaxWidth: true,
                        spacing: 8,
                        height: 360
                    }, CONTENT_SNIPPETS.flatMap((snippet, index) => {
                        const nodes = [
                            UI.Box({
                                modifier: ctx.Modifier
                                    .fillMaxWidth()
                                    .clip({ cornerRadius: 12 })
                                    .clickable(() => insertSnippet(snippet.content))
                                    .padding({ horizontal: 2, vertical: 2 })
                            }, [
                                UI.Column({
                                    fillMaxWidth: true,
                                    padding: 12,
                                    spacing: 4
                                }, [
                                    UI.Text({
                                        text: snippet.label,
                                        color: colors.onSurface,
                                        fontWeight: "bold"
                                    }),
                                    UI.Text({
                                        text: snippet.description,
                                        style: "bodySmall",
                                        color: colors.onSurfaceVariant
                                    })
                                ])
                            ])
                        ];
                        if (index < CONTENT_SNIPPETS.length - 1) {
                            nodes.push(UI.HorizontalDivider({
                                color: colors.outlineVariant.copy({ alpha: 0.6 }),
                                thickness: 1
                            }));
                        }
                        return nodes;
                    }))
                ])
            ])
        ]);
    }
    function wbPlusSelHas(id) {
        return (selIdsRef.current || []).indexOf(String(id)) >= 0;
    }
    function wbPlusSelToggle(id) {
        var arr = (selIdsRef.current || []).slice();
        var k = String(id), i = arr.indexOf(k);
        if (i >= 0) arr.splice(i, 1); else arr.push(k);
        selIdsRef.current = arr;
        setUiTick(uiTick + 1);
    }
    function wbPlusSelClear() {
        selIdsRef.current = [];
        setUiTick(uiTick + 1);
    }
    function wbPlusScopeName() {
        if (!selGroupId) return "全部";
        if (selGroupId === "__ungrouped__") return "未分组";
        var g = (groupsRef.current || []).find(function (x) { return String(x.id) === String(selGroupId); });
        return g ? String(g.name) : "组";
    }
    function wbPlusSelSelectAll() {
        var ids = [];
        if (selGroupId) {
            if (selGroupId === "__ungrouped__") {
                ids = getUngroupedEntries().map(function (e) { return String(e.id); });
            }
            else {
                var g = (groupsRef.current || []).find(function (x) { return String(x.id) === String(selGroupId); });
                if (g && g.entry_ids) ids = g.entry_ids.map(String);
            }
        }
        else {
            ids = (entriesRef.current || []).map(function (e) { return String(e.id); });
        }
        selIdsRef.current = ids;
        setUiTick(uiTick + 1);
    }
    function wbPlusEnterGroupBatch(gid) {
        setSelGroupId(gid);
        setSelMode(true);
        wbPlusSelClear();
        var ids = [];
        if (gid === "__ungrouped__") {
            ids = getUngroupedEntries().map(function (e) { return String(e.id); });
        }
        else {
            var g = (groupsRef.current || []).find(function (x) { return String(x.id) === String(gid); });
            if (g && g.entry_ids) ids = g.entry_ids.map(String);
        }
        selIdsRef.current = ids;
        setUiTick(uiTick + 1);
    }
    async function wbPlusBatchApply() {
        var arr = selIdsRef.current || [];
        if (arr.length === 0) { ctx.showToast("未选中条目"); return; }
        var dep = Math.max(0, parseInt(batchDepth, 10) || 0);
        try {
            var wb = await (0, wb_data_js_1.readEntries)();
            if (!Array.isArray(wb) || wb.length === 0) { ctx.showToast("读取条目失败，已中止"); return; }
            var n = 0;
            wb.forEach(function (e) {
                if (arr.indexOf(String(e.id)) < 0) return;
                e.inject_target = batchTarget || "system";
                e.inject_position = batchPos || "append";
                e.insertion_depth = dep;
                n++;
            });
            if (n === 0) { ctx.showToast("未匹配到条目，已中止"); return; }
            await (0, wb_data_js_1.safeWriteEntries)(wb);
            await loadEntries(true);
            ctx.showToast("批量应用 " + n + " 条");
            wbPlusSelClear();
        } catch (err) { ctx.showToast("批量应用失败：" + err.message); }
    }
    var bulkBusyRef = ctx.useRef("bulkBusyRef", false);
    const [bulkConfirm, setBulkConfirm] = ctx.useState("bulkConfirm", "");
    async function wbPlusBulkAction(action) {
        if (bulkBusyRef.current) return;
        var arr = (selIdsRef.current || []).map(String);
        if (arr.length === 0) { ctx.showToast("未选中条目"); return; }
        if (action === "delete" && bulkConfirm !== "__bulkdel__") {
            setBulkConfirm("__bulkdel__");
            ctx.showToast("再点一次「删除选中」以确认删除 " + arr.length + " 条");
            return;
        }
        if (action === "delete") setBulkConfirm("");
        bulkBusyRef.current = true;
        try {
            var wb = await (0, wb_data_js_1.readEntries)();
            if (!Array.isArray(wb)) { ctx.showToast("读取条目失败，已中止"); return; }
            var reservedId = function (e) { return (0, task_expectation_bridge_js_1.isReservedEntry)(e); };
            var set = new Set(arr);
            var now = new Date().toISOString();
            var n = 0;
            var out;
            if (action === "delete") {
                out = wb.filter(function (e) {
                    if (reservedId(e) || !set.has(String(e.id))) return true;
                    n++;
                    return false;
                });
            }
            else {
                out = wb.map(function (e) {
                    if (reservedId(e) || !set.has(String(e.id))) return e;
                    var x = Object.assign({}, e, { updated_at: now });
                    if (action === "enable") x.enabled = true;
                    else if (action === "disable") x.enabled = false;
                    n++;
                    return x;
                });
            }
            if (n === 0) { ctx.showToast("未匹配到条目，已中止"); return; }
            await (0, wb_data_js_1.safeWriteEntries)(out);
            if (action === "delete") {
                const rm = new Set(arr);
                const groups = await (0, wb_data_js_1.readGroups)();
                let groupsDirty = false;
                for (const g of groups) {
                    const before = Array.isArray(g.entry_ids) ? g.entry_ids.length : 0;
                    g.entry_ids = (Array.isArray(g.entry_ids) ? g.entry_ids : []).filter((id) => !rm.has(id));
                    if (g.entry_ids.length !== before) groupsDirty = true;
                }
                if (groupsDirty) await (0, wb_data_js_1.writeGroups)(groups);
                const hidden = await (0, wb_data_js_1.readHiddenIds)();
                await (0, wb_data_js_1.writeHiddenIds(hidden.filter((id) => !rm.has(id))));
            }
            await loadEntries(true);
            ctx.showToast(({ enable: "已启用", disable: "已禁用", delete: "已删除" }[action] || "已处理") + " " + n + " 条");
            wbPlusSelClear();
        } catch (err) { ctx.showToast("批量操作失败：" + err.message); }
        finally { bulkBusyRef.current = false; }
    }
    async function wbPlusForceAction(mode) {
        var arr = (selIdsRef.current || []).map(String);
        if (arr.length === 0) { ctx.showToast("未选中条目"); return; }
        try {
            var cfg = await (0, wb_data_js_1.readForceConfig)();
            var cur = new Set(Array.isArray(cfg.default) ? cfg.default : []);
            if (mode === "remove") arr.forEach(function (id) { cur.delete(id); });
            else arr.forEach(function (id) { cur.add(id); });
            cfg.default = Array.from(cur);
            await (0, wb_data_js_1.writeForceConfig)(cfg);
            ctx.showToast((mode === "remove" ? "已取消强制 " : "已强制激活 ") + arr.length + " 条（全局默认）");
        } catch (err) { ctx.showToast("强制激活失败：" + err.message); }
    }
    async function wbPlusHideAction(mode) {
        var arr = (selIdsRef.current || []).map(String);
        if (arr.length === 0) { ctx.showToast("未选中条目"); return; }
        try {
            var cur = new Set(await (0, wb_data_js_1.readHiddenIds)());
            if (mode === "unhide") arr.forEach(function (id) { cur.delete(id); });
            else arr.forEach(function (id) { cur.add(id); });
            await (0, wb_data_js_1.writeHiddenIds)(Array.from(cur));
            setHiddenIds(Array.from(cur));
            await loadEntries(true);
            ctx.showToast((mode === "unhide" ? "已恢复 " : "已隐藏 ") + arr.length + " 条");
        } catch (err) { ctx.showToast("隐藏操作失败：" + err.message); }
    }
    async function wbPlusLoadBindings() {
        try {
            var wb = (await (0, wb_data_js_1.readEntries)()).filter(function (e) { return !(0, task_expectation_bridge_js_1.isReservedEntry)(e); });
            var gs = await (0, wb_data_js_1.readGroups)();
            var ov = (0, wb_data_js_1.buildBindingOverview)(wb, gs);
            setEnhData(Object.assign({}, enhData || {}, { bindings: ov }));
            ctx.showToast("绑定总览：" + ov.total + " 条｜全局 " + ov.global_count + "｜分组 " + ov.group_count);
        } catch (err) { ctx.showToast("绑定总览失败：" + err.message); }
    }
    async function wbPlusLoadOrphans() {
        try {
            var wb = (await (0, wb_data_js_1.readEntries)()).filter(function (e) { return !(0, task_expectation_bridge_js_1.isReservedEntry)(e); });
            var gs = await (0, wb_data_js_1.readGroups)();
            var rep = (0, wb_data_js_1.analyzeOrphans)(wb, gs);
            setEnhData(Object.assign({}, enhData || {}, { orphans: rep }));
            ctx.showToast("孤儿条目 " + rep.orphan_count + " 条/共 " + rep.total_entries);
        } catch (err) { ctx.showToast("孤儿检测失败：" + err.message); }
    }
    async function wbPlusClearHidden() {
        try {
            var before = (await (0, wb_data_js_1.readHiddenIds)()).length;
            if (before === 0) { ctx.showToast("无隐藏条目"); return; }
            await (0, wb_data_js_1.writeHiddenIds)([]);
            await loadEntries(true);
            setHiddenIds([]);
            ctx.showToast("已恢复 " + before + " 条隐藏条目");
        } catch (err) { ctx.showToast("恢复失败：" + err.message); }
    }
    var WBPLUS_RECALL_CFG = "/sdcard/Download/Operit/plugins/com.operit.worldbook/recall_config.json";
    async function wbPlusAiRecallLoad() {
        try {
            var r = await Tools.Files.read(WBPLUS_RECALL_CFG);
            var t = String((r && r.content) || "").trim();
            if (t) {
                var c = JSON.parse(t);
                setAiRecallOn(c.enabled === true);
                setAiRecallMode(c.mode === "ai" ? "ai" : "keyword");
                setAiApiBase(String(c.apiBase || ""));
                setAiApiKey(String(c.apiKey || ""));
                setAiModel(String(c.model || ""));
                ctx.showToast("已读取配置");
                return;
            }
            ctx.showToast("无配置文件");
        }
        catch (e) { ctx.showToast("读取失败：" + e.message); }
    }
    async function wbPlusAiRecallSave() {
        try {
            var c = {
                enabled: aiRecallOn === true,
                mode: aiRecallMode === "ai" ? "ai" : "keyword",
                batchSize: 20,
                timeoutMs: 8000,
                apiBase: String(aiApiBase || "").trim(),
                apiKey: String(aiApiKey || "").trim(),
                model: String(aiModel || "").trim()
            };
            await Tools.Files.mkdir("/sdcard/Download/Operit/plugins/com.operit.worldbook", true);
            await Tools.Files.write(WBPLUS_RECALL_CFG, JSON.stringify(c, null, 2));
            ctx.showToast("AI 召回配置已保存");
        }
        catch (e) { ctx.showToast("保存失败：" + e.message); }
    }
    function wbPlusAiRecallCard() {
        if (!aiCfgLoadedRef.current) {
            aiCfgLoadedRef.current = true;
            void wbPlusAiRecallLoad();
        }
        return UI.Card({ containerColor: colors.surface, elevation: 1, modifier: ctx.Modifier.fillMaxWidth() }, [
            UI.Column({ padding: 12, fillMaxWidth: true, spacing: 6 }, [
                UI.Text({ text: "AI 召回配置（注入策略）", fontWeight: "bold", color: colors.onSurface }),
                UI.Text({ text: "关掉关键词召回后，改由 AI 逐条判断每段世界书是否召回。常驻条目不受影响，始终注入。", style: "bodySmall", color: colors.onSurfaceVariant }),
                UI.Row({ spacing: 6, verticalAlignment: "center" }, [
                    UI.Text({ text: "召回方式", style: "labelSmall", color: colors.onSurfaceVariant }),
                    renderChoiceChip("关键词", aiRecallMode === "keyword", () => setAiRecallMode("keyword")),
                    renderChoiceChip("AI 判定", aiRecallMode === "ai", () => setAiRecallMode("ai"))
                ]),
                aiRecallMode === "ai" ? UI.Text({ text: "填入 API 地址则直连该端点判定；留空回落到平台对话模型。", style: "bodySmall", color: colors.onSurfaceVariant }) : null,
                aiRecallMode === "ai" ? UI.TextField({ label: "API 地址（OpenAI 兼容，形如 https://host/v1）", value: aiApiBase, onValueChange: setAiApiBase, singleLine: true, fillMaxWidth: true }) : null,
                aiRecallMode === "ai" ? UI.TextField({ label: "API Key", value: aiApiKey, onValueChange: setAiApiKey, singleLine: true, fillMaxWidth: true }) : null,
                aiRecallMode === "ai" ? UI.TextField({ label: "模型名（如 gpt-4o-mini）", value: aiModel, onValueChange: setAiModel, singleLine: true, fillMaxWidth: true }) : null,
                UI.Row({ spacing: 8 }, [
                    UI.OutlinedButton({ onClick: () => setAiRecallOn(!aiRecallOn), shape: { cornerRadius: 12 }, weight: 1 }, [UI.Text({ text: aiRecallOn ? "已启用" : "已停用" })]),
                    UI.OutlinedButton({ onClick: () => { wbPlusAiRecallLoad(); }, shape: { cornerRadius: 12 }, weight: 1 }, [UI.Text({ text: "读取" })]),
                    UI.OutlinedButton({ onClick: () => { wbPlusAiRecallSave(); }, shape: { cornerRadius: 12 }, weight: 1 }, [UI.Text({ text: "保存" })])
                ])
            ])
        ]);
    }
    function wbPlusBatchBar() {
        var ZU = String.fromCharCode(117, 115, 101, 114);
        var ZA = String.fromCharCode(97, 115, 115, 105, 115, 116, 97, 110, 116);
        var n = (selIdsRef.current || []).length;
        return UI.Card({ containerColor: colors.primaryContainer.copy({ alpha: 0.28 }), elevation: 1, modifier: ctx.Modifier.fillMaxWidth() }, [
            UI.Column({ padding: 10, fillMaxWidth: true, spacing: 6 }, [
                UI.Text({ text: "批量注入策略 ｜ " + wbPlusScopeName() + " ｜ 已选 " + n + " 条", fontWeight: "bold", color: colors.onSurface }),
                UI.Row({ spacing: 6, verticalAlignment: "center" }, [
                    UI.Text({ text: "目标", style: "labelSmall", color: colors.onSurfaceVariant }),
                    renderChoiceChip("系统", batchTarget === "system", () => setBatchTarget("system")),
                    renderChoiceChip("用户", batchTarget === ZU, () => setBatchTarget(ZU)),
                    renderChoiceChip("助手", batchTarget === ZA, () => setBatchTarget(ZA))
                ]),
                UI.Row({ spacing: 6, verticalAlignment: "center" }, [
                    UI.Text({ text: "位置", style: "labelSmall", color: colors.onSurfaceVariant }),
                    renderChoiceChip("最前", batchPos === "prepend", () => setBatchPos("prepend")),
                    renderChoiceChip("最后", batchPos === "append", () => setBatchPos("append")),
                    renderChoiceChip("深度", batchPos === "at_depth", () => setBatchPos("at_depth"))
                ]),
                UI.Row({ spacing: 6, verticalAlignment: "center" }, [
                    UI.Text({ text: "深度", style: "labelSmall", color: colors.onSurfaceVariant }),
                    UI.TextField({ value: batchDepth, onValueChange: setBatchDepth, singleLine: true, weight: 1 })
                ]),
                UI.Row({ spacing: 8 }, [
                    UI.OutlinedButton({ onClick: () => { wbPlusSelSelectAll(); }, shape: { cornerRadius: 12 }, weight: 1 }, [UI.Text({ text: "全选" })]),
                    UI.OutlinedButton({ onClick: () => wbPlusSelClear(), shape: { cornerRadius: 12 }, weight: 1 }, [UI.Text({ text: "清空" })]),
                    UI.OutlinedButton({ onClick: () => wbPlusBatchApply(), shape: { cornerRadius: 12 }, weight: 1 }, [UI.Text({ text: "应用注入" })])
                ]),
                UI.Row({ spacing: 8 }, [
                    UI.OutlinedButton({ onClick: () => wbPlusBulkAction("enable"), shape: { cornerRadius: 12 }, weight: 1 }, [UI.Text({ text: "启用" })]),
                    UI.OutlinedButton({ onClick: () => wbPlusBulkAction("disable"), shape: { cornerRadius: 12 }, weight: 1 }, [UI.Text({ text: "禁用" })]),
                    UI.OutlinedButton({ onClick: () => wbPlusBulkAction("delete"), shape: { cornerRadius: 12 }, weight: 1 }, [UI.Text({ text: bulkConfirm === "__bulkdel__" ? "确认删除" : "删除选中", color: bulkConfirm === "__bulkdel__" ? colors.error : undefined })])
                ]),
                UI.Row({ spacing: 8 }, [
                    UI.OutlinedButton({ onClick: () => wbPlusForceAction("add"), shape: { cornerRadius: 12 }, weight: 1 }, [UI.Text({ text: "强制激活" })]),
                    UI.OutlinedButton({ onClick: () => wbPlusForceAction("remove"), shape: { cornerRadius: 12 }, weight: 1 }, [UI.Text({ text: "取消强制" })])
                ]),
                UI.Row({ spacing: 8 }, [
                    UI.OutlinedButton({ onClick: () => wbPlusHideAction("hide"), shape: { cornerRadius: 12 }, weight: 1 }, [UI.Text({ text: "隐藏选中" })]),
                    UI.OutlinedButton({ onClick: () => wbPlusHideAction("unhide"), shape: { cornerRadius: 12 }, weight: 1 }, [UI.Text({ text: "恢复选中" })])
                ])
            ])
        ]);
    }
    function renderToolbarAction(iconName, contentDescription, onClick, active = false) {
        return UI.Box({
            width: 40,
            height: 40,
            contentAlignment: "center",
            modifier: ctx.Modifier.clip({ type: "circle" }).clickable(onClick)
        }, [
            UI.Icon({
                name: iconName,
                size: 18,
                tint: active ? colors.primary : colors.onSurface,
                contentDescription
            })
        ]);
    }
    function renderChoiceChip(label, selected, onClick, enabled = true) {
        const chipShape = { type: "pill" };
        const borderColor = !enabled
            ? colors.outlineVariant.copy({ alpha: 0.55 })
            : selected
                ? colors.primary.copy({ alpha: 0.22 })
                : colors.outlineVariant;
        const backgroundColor = selected ? colors.primaryContainer.copy({ alpha: 0.38 }) : colors.surface;
        const textColor = !enabled
            ? colors.onSurfaceVariant.copy({ alpha: 0.6 })
            : selected
                ? colors.primary
                : colors.onSurface;
        const chipModifier = enabled
            ? ctx.Modifier
                .clip(chipShape)
                .background(backgroundColor)
                .border(1, borderColor, chipShape)
                .clickable(onClick)
            : ctx.Modifier.clip(chipShape).background(backgroundColor).border(1, borderColor, chipShape);
        return UI.Box({
            modifier: chipModifier.padding({ horizontal: 14, vertical: 9 })
        }, [
            UI.Row({
                spacing: selected ? 6 : 0,
                verticalAlignment: "center"
            }, [
                selected
                    ? UI.Icon({
                        name: "check",
                        size: 16,
                        tint: textColor
                    })
                    : null,
                UI.Text({
                    text: label,
                    fontWeight: selected ? "bold" : "medium",
                    color: textColor
                })
            ].filter(Boolean))
        ]);
    }
    function renderForm() {
        const isEdit = view === "edit";
        return UI.Column({
            padding: 12,
            spacing: 12,
            fillMaxWidth: true
        }, [
            UI.Row({
                fillMaxWidth: true
            }, [
                UI.OutlinedButton({
                    onClick: () => setView("list"),
                    shape: { cornerRadius: 12 }
                }, [
                    UI.Row({
                        spacing: 6,
                        verticalAlignment: "center"
                    }, [
                        UI.Icon({
                            name: "arrowBack",
                            size: 16,
                            tint: colors.onSurface
                        }),
                        UI.Text({
                            text: t.buttonBack,
                            color: colors.onSurface,
                            fontWeight: "bold"
                        })
                    ])
                ])
            ]),
            UI.Card({
                containerColor: colors.surface,
                shape: { cornerRadius: 18 },
                fillMaxWidth: true
            }, [
                UI.Column({
                    padding: 16,
                    spacing: 12,
                    fillMaxWidth: true
                }, [
                    UI.Text({
                        text: t.sectionBasicInfo,
                        style: "titleMedium",
                        fontWeight: "bold",
                        color: colors.onSurface
                    }),
                    UI.Text({
                        text: t.sectionBasicInfoDesc,
                        style: "bodySmall",
                        color: colors.onSurfaceVariant
                    }),
                    UI.TextField({
                        label: t.fieldEntryName,
                        placeholder: t.fieldEntryNamePlaceholder,
                        value: formName,
                        onValueChange: setFormName,
                        singleLine: true,
                        fillMaxWidth: true
                    }),
                    formRecallMode === "keyword" ? UI.TextField({
                        label: t.fieldKeywords,
                        placeholder: t.fieldKeywordsPlaceholder,
                        value: formKeywords,
                        onValueChange: setFormKeywords,
                        singleLine: true,
                        fillMaxWidth: true
                    }) : null,
                    formRecallMode === "keyword" ? UI.OutlinedButton({ onClick: function () { wbPlusAiGenKeywords(); }, fillMaxWidth: true, shape: { cornerRadius: 12 } }, [UI.Text({ text: kwGenBusy ? "生成中…" : "AI 生成关键词（替换当前）" })]) : null,
                    formRecallMode === "keyword" && wbPlusKwList(formKeywords).length > 0
                        ? UI.Column({ fillMaxWidth: true, spacing: 4 }, [
                            UI.Text({
                                text: "关键词 " + wbPlusKwList(formKeywords).length + " 个 · 点按移除",
                                style: "bodySmall",
                                color: colors.onSurfaceVariant
                            }),
                            UI.LazyRow({ fillMaxWidth: true, spacing: 8 }, wbPlusKwList(formKeywords).map(function (kw) {
                                return UI.OutlinedButton({
                                    onClick: function () { setFormKeywords(wbPlusKwRemove(formKeywords, kw)); },
                                    shape: { cornerRadius: 12 }
                                }, [UI.Text({ text: kw + " ×" })]);
                            }))
                        ])
                        : null,
                    UI.TextField({
                        label: t.fieldContent,
                        placeholder: t.fieldContentPlaceholder,
                        value: formContent,
                        onValueChange: setFormContentValue,
                        singleLine: false,
                        minLines: 5,
                        fillMaxWidth: true
                    }),
                    UI.Box({
                        fillMaxWidth: true
                    }, [
                        UI.OutlinedButton({
                            onClick: () => setShowSnippetPicker(!showSnippetPicker),
                            fillMaxWidth: true,
                            shape: { cornerRadius: 14 }
                        }, [
                            UI.Row({
                                fillMaxWidth: true,
                                horizontalArrangement: "spaceBetween",
                                verticalAlignment: "center"
                            }, [
                                UI.Text({
                                    text: t.fieldContentTemplates,
                                    color: colors.onSurface,
                                    fontWeight: "medium"
                                }),
                                UI.Icon({
                                    name: showSnippetPicker ? "arrowDropUp" : "arrowDropDown",
                                    tint: colors.onSurfaceVariant,
                                    size: 20
                                })
                            ])
                        ])
                    ]),
                    UI.Text({
                        text: t.fieldContentTemplatesHint,
                        style: "bodySmall",
                        color: colors.onSurfaceVariant
                    }),
                    UI.Text({
                        text: t.fieldCharacterCard,
                        style: "labelMedium",
                        fontWeight: "bold",
                        color: colors.onSurface
                    }),
                    UI.Box({
                        fillMaxWidth: true
                    }, [
                        UI.OutlinedButton({
                            onClick: () => toggleCardPicker(),
                            fillMaxWidth: true,
                            shape: { cornerRadius: 14 }
                        }, [
                            UI.Row({
                                fillMaxWidth: true,
                                horizontalArrangement: "spaceBetween",
                                verticalAlignment: "center"
                            }, [
                                UI.Column({ weight: 1, spacing: 2 }, [
                                    UI.Text({
                                        text: getSelectedCardLabel(),
                                        color: colors.onSurface,
                                        fontWeight: "medium",
                                        maxLines: 1,
                                        overflow: "ellipsis"
                                    }),
                                    UI.Text({
                                        text: formCharacterCardId ? t.dropdownBoundCard : t.dropdownGlobalEffective,
                                        style: "bodySmall",
                                        color: colors.onSurfaceVariant
                                    })
                                ]),
                                UI.Icon({
                                    name: showCardPicker ? "arrowDropUp" : "arrowDropDown",
                                    tint: colors.onSurfaceVariant,
                                    size: 20
                                })
                            ])
                        ]),
                        UI.DropdownMenu({
                            expanded: showCardPicker,
                            width: CHARACTER_CARD_MENU_WIDTH,
                            modifier: ctx.Modifier.heightIn({ maxHeight: CHARACTER_CARD_MENU_MAX_HEIGHT }),
                            properties: {
                                focusable: true,
                                usePlatformDefaultWidth: false
                            },
                            onDismissRequest: () => {
                                setShowCardPicker(false);
                                setLoadingCards(false);
                            }
                        }, [
                            UI.Box({
                                modifier: ctx.Modifier
                                    .fillMaxWidth()
                                    .clickable(() => doClearCardBinding())
                                    .padding({ horizontal: 16, vertical: 12 })
                            }, [
                                UI.Text({
                                    text: t.dropdownNoCharacterCard,
                                    color: colors.onSurface,
                                    fontWeight: !formCharacterCardId ? "bold" : "normal"
                                })
                            ]),
                            UI.HorizontalDivider({
                                color: colors.outlineVariant,
                                thickness: 1
                            }),
                            ...(loadingCards
                                ? [
                                    UI.Box({
                                        modifier: ctx.Modifier
                                            .fillMaxWidth()
                                            .padding({ horizontal: 16, vertical: 12 })
                                    }, [
                                        UI.Text({
                                            text: t.dropdownLoading,
                                            color: colors.onSurfaceVariant
                                        })
                                    ])
                                ]
                                : availableCards.length === 0
                                    ? [
                                        UI.Box({
                                            modifier: ctx.Modifier
                                                .fillMaxWidth()
                                                .padding({ horizontal: 16, vertical: 12 })
                                        }, [
                                            UI.Text({
                                                text: t.dropdownNoCards,
                                                color: colors.onSurfaceVariant
                                            })
                                        ])
                                    ]
                                    : availableCards.map((card) => UI.Box({
                                        modifier: ctx.Modifier
                                            .fillMaxWidth()
                                            .clickable(() => doPickCard(card.id))
                                            .padding({ horizontal: 16, vertical: 12 })
                                    }, [
                                        UI.Row({
                                            fillMaxWidth: true,
                                            horizontalArrangement: "spaceBetween",
                                            verticalAlignment: "center"
                                        }, [
                                            UI.Column({ weight: 1, spacing: 2 }, [
                                                UI.Text({
                                                    text: card.name,
                                                    color: colors.onSurface,
                                                    fontWeight: card.id === formCharacterCardId ? "bold" : "normal",
                                                    maxLines: 1,
                                                    overflow: "ellipsis"
                                                }),
                                                ...(card.description
                                                    ? [
                                                        UI.Text({
                                                            text: card.description,
                                                            style: "bodySmall",
                                                            color: colors.onSurfaceVariant,
                                                            maxLines: 1,
                                                            overflow: "ellipsis"
                                                        })
                                                    ]
                                                    : [])
                                            ]),
                                            card.id === formCharacterCardId
                                                ? UI.Icon({
                                                    name: "check",
                                                    tint: colors.primary,
                                                    size: 18
                                                })
                                                : UI.Spacer({ width: 18 })
                                        ])
                                    ])))
                        ])
                    ]),
                    UI.Text({
                        text: t.dropdownHint,
                        style: "bodySmall",
                        color: colors.onSurfaceVariant
                    })
                ])
            ]),
            UI.Card({
                containerColor: colors.surface,
                shape: { cornerRadius: 18 },
                fillMaxWidth: true
            }, [
                UI.Column({
                    padding: 16,
                    spacing: 12,
                    fillMaxWidth: true
                }, [
                    UI.Text({
                        text: t.sectionMatchAndEnable,
                        style: "titleMedium",
                        fontWeight: "bold",
                        color: colors.onSurface
                    }),
                    renderSettingRow(t.settingEnabledTitle, t.settingEnabledDesc, formEnabled, setFormEnabled),
                    UI.HorizontalDivider({
                        color: colors.outlineVariant,
                        thickness: 1
                    }),
                    renderSettingRow(t.settingAlwaysActiveTitle, t.settingAlwaysActiveDesc, formAlwaysActive, setFormAlwaysActive),
                    UI.HorizontalDivider({
                        color: colors.outlineVariant,
                        thickness: 1
                    }),
                    renderSettingRow(t.settingRegexTitle, t.settingRegexDesc, formIsRegex, setFormIsRegex),
                    UI.HorizontalDivider({
                        color: colors.outlineVariant,
                        thickness: 1
                    }),
                    renderSettingRow(t.settingCaseSensitiveTitle, t.settingCaseSensitiveDesc, formCaseSensitive, setFormCaseSensitive),
                    UI.HorizontalDivider({
                        color: colors.outlineVariant,
                        thickness: 1
                    }),
                    UI.Column({
                        fillMaxWidth: true,
                        spacing: 4
                    }, [
                        UI.Text({
                            text: "召回方式",
                            color: colors.onSurface,
                            fontWeight: "bold"
                        }),
                        UI.Text({
                            text: "关掉关键词匹配后，改由 AI 逐条判断这条世界书是否召回。",
                            style: "bodySmall",
                            color: colors.onSurfaceVariant
                        }),
                        UI.Row({
                            spacing: 8,
                            verticalAlignment: "center"
                        }, [
                            renderChoiceChip("关键词匹配", formRecallMode === "keyword", () => setFormRecallMode("keyword")),
                            renderChoiceChip("AI 判定", formRecallMode === "ai", () => setFormRecallMode("ai"))
                        ])
                    ])
                ])
            ]),
            UI.Card({
                containerColor: colors.surface,
                shape: { cornerRadius: 18 },
                fillMaxWidth: true
            }, [
                UI.Column({
                    padding: 16,
                    spacing: 12,
                    fillMaxWidth: true
                }, [
                    UI.Text({
                        text: t.sectionInjectStrategy,
                        style: "titleMedium",
                        fontWeight: "bold",
                        color: colors.onSurface
                    }),
                    UI.Text({
                        text: t.sectionInjectStrategyDesc,
                        style: "bodySmall",
                        color: colors.onSurfaceVariant
                    }),
                    UI.Row({ fillMaxWidth: true, spacing: 12 }, [
                        UI.Column({ weight: 1 }, [
                            UI.TextField({
                                label: t.fieldPriority,
                                placeholder: t.fieldPriorityPlaceholder,
                                value: formPriority,
                                onValueChange: setFormPriority,
                                singleLine: true,
                                fillMaxWidth: true
                            })
                        ]),
                        UI.Column({ weight: 1 }, [
                            UI.TextField({
                                label: t.fieldScanDepth,
                                placeholder: t.fieldScanDepthPlaceholder,
                                value: formScanDepth,
                                onValueChange: setFormScanDepth,
                                singleLine: true,
                                fillMaxWidth: true
                            })
                        ])
                    ]),
                    UI.Text({
                        text: t.scanDepthHint,
                        style: "bodySmall",
                        color: colors.onSurfaceVariant
                    }),
                    UI.Spacer({ height: 8 }),
                    UI.Text({
                        text: t.injectTargetTitle,
                        style: "labelMedium",
                        fontWeight: "bold",
                        color: colors.onSurface
                    }),
                    UI.Text({
                        text: t.injectTargetHint,
                        style: "bodySmall",
                        color: colors.onSurfaceVariant
                    }),
                    UI.LazyRow({
                        fillMaxWidth: true,
                        spacing: 8
                    }, [
                        renderChoiceChip(t.injectTargetSystem, formInjectTarget === "system", () => selectInjectTarget("system")),
                        renderChoiceChip(t.injectTargetUser, formInjectTarget === "user", () => selectInjectTarget("user")),
                        renderChoiceChip(t.injectTargetAssistant, formInjectTarget === "assistant", () => selectInjectTarget("assistant"))
                    ]),
                    UI.Text({
                        text: "当前目标：" + wbPlusTargetDetail(formInjectTarget),
                        style: "bodySmall",
                        color: colors.onSurfaceVariant
                    }),
                    UI.Spacer({ height: 8 }),
                    UI.Text({
                        text: t.injectPositionTitle,
                        style: "labelMedium",
                        fontWeight: "bold",
                        color: colors.onSurface
                    }),
                    UI.Text({
                        text: t.injectPositionHint,
                        style: "bodySmall",
                        color: colors.onSurfaceVariant
                    }),
                    UI.LazyRow({
                        fillMaxWidth: true,
                        spacing: 8
                    }, [
                        renderChoiceChip(t.injectPositionPrepend, effectiveInjectPosition === "prepend", () => selectInjectPosition("prepend"), formInjectTarget !== "assistant"),
                        renderChoiceChip(t.injectPositionAppend, effectiveInjectPosition === "append", () => selectInjectPosition("append"), formInjectTarget !== "assistant"),
                        renderChoiceChip(t.injectPositionAtDepth, effectiveInjectPosition === "at_depth", () => selectInjectPosition("at_depth"))
                    ]),
                    UI.Text({
                        text: "当前位置：" + wbPlusPositionLockReason(effectiveInjectPosition),
                        style: "bodySmall",
                        color: colors.onSurfaceVariant
                    }),
                    effectiveInjectPosition === "at_depth"
                        ? UI.Column({
                            spacing: 6
                        }, [
                            UI.TextField({
                                label: t.fieldInsertionDepth,
                                placeholder: t.fieldInsertionDepthPlaceholder,
                                value: formInsertionDepth,
                                onValueChange: setFormInsertionDepth,
                                singleLine: true,
                                fillMaxWidth: true
                            }),
                            UI.Text({
                                text: t.insertionDepthHint,
                                style: "bodySmall",
                                color: colors.onSurfaceVariant
                            }),
                            UI.Text({
                                text: "行号换算：" + wbPlusInsertionDepthDetail(),
                                style: "bodySmall",
                                color: colors.onSurfaceVariant
                            })
                        ])
                        : null,
                    UI.Text({
                        text: "内容 token ≈ " + wbPlusTokens(formContent) + " ｜ 关键词 " + wbPlusKwList(formKeywords).length + " 个",
                        style: "bodySmall",
                        color: colors.onSurfaceVariant
                    }),
                    UI.Text({
                        text: "注入组合：" + wbPlusInjectSummary(),
                        style: "bodySmall",
                        color: colors.onSurfaceVariant
                    })
                ].filter(Boolean))
            ]),
            UI.Button({
                text: isEdit ? t.saveEditButton : t.createEntryButton,
                onClick: () => doSave(),
                fillMaxWidth: true,
                shape: { cornerRadius: 14 }
            })
        ]);
    }
    function renderImportForm() {
        return UI.Column({
            padding: 12,
            spacing: 12,
            fillMaxWidth: true
        }, [
            UI.Row({
                fillMaxWidth: true
            }, [
                UI.OutlinedButton({
                    onClick: () => setView("list"),
                    shape: { cornerRadius: 12 }
                }, [
                    UI.Row({
                        spacing: 6,
                        verticalAlignment: "center"
                    }, [
                        UI.Icon({
                            name: "arrowBack",
                            size: 16,
                            tint: colors.onSurface
                        }),
                        UI.Text({
                            text: t.buttonBack,
                            color: colors.onSurface,
                            fontWeight: "bold"
                        })
                    ])
                ])
            ]),
            UI.Card({
                containerColor: colors.surface,
                shape: { cornerRadius: 18 },
                fillMaxWidth: true
            }, [
                UI.Column({
                    padding: 16,
                    spacing: 12,
                    fillMaxWidth: true
                }, [
                    UI.Text({
                        text: t.sectionImport,
                        style: "titleMedium",
                        fontWeight: "bold",
                        color: colors.onSurface
                    }),
                    UI.Text({
                        text: t.sectionImportDesc,
                        style: "bodySmall",
                        color: colors.onSurfaceVariant
                    }),
                    UI.TextField({
                        label: t.fieldImportPath,
                        placeholder: t.fieldImportPathPlaceholder,
                        value: importPath,
                        onValueChange: setImportPath,
                        singleLine: false,
                        minLines: 2,
                        fillMaxWidth: true
                    }),
                    UI.OutlinedButton({
                        onClick: () => doPickImportFile(),
                        enabled: !importing,
                        fillMaxWidth: true,
                        shape: { cornerRadius: 12 }
                    }, [
                        UI.Text({
                            text: t.buttonPickImportFile,
                            fontWeight: "bold"
                        })
                    ]),
                    UI.Text({
                        text: t.importFormatsTitle,
                        style: "labelMedium",
                        fontWeight: "bold",
                        color: colors.onSurface
                    }),
                    UI.Text({
                        text: t.importFormatsDesc,
                        style: "bodySmall",
                        color: colors.onSurfaceVariant
                    }),
                    UI.Text({
                        text: t.importPathHint,
                        style: "bodySmall",
                        color: colors.onSurfaceVariant
                    })
                ])
            ]),
            UI.Button({
                text: importing ? `${t.importActionButton}...` : t.importActionButton,
                onClick: () => doImport(),
                enabled: !importing,
                fillMaxWidth: true,
                shape: { cornerRadius: 14 }
            })
        ]);
    }
    const hasSearchQuery = searchQuery.trim().length > 0;
    const visibleEntries = hasSearchQuery ? entries.filter((entry) => matchesEntrySearch(entry, searchQuery)) : entries;
    const items = [
        UI.Column({
            key: "actions",
            fillMaxWidth: true,
            spacing: 8,
            padding: { horizontal: 4, vertical: 4 }
        }, [
            UI.Row({
                fillMaxWidth: true,
                horizontalArrangement: "end",
                verticalAlignment: "center",
                spacing: 8
            }, [
                renderToolbarAction("search", t.actionSearch, toggleSearchBar, showSearchBar),
                renderToolbarAction("refresh", t.actionRefresh, () => doRefresh()),
                renderToolbarAction("createNewFolder", t.groupNewButton, doOpenGroupCreate),
                renderToolbarAction("uploadFile", t.buttonImport, doOpenImport),
                renderToolbarAction("info", "增强分析", () => { loadEnhance(); setView("enhance"); }),
                renderToolbarAction("add", t.newEntryButton, doCreate),
                renderToolbarAction("check", "批量选择", () => { setSelMode(!selMode); wbPlusSelClear(); setSelGroupId(""); }, selMode),
                renderToolbarAction("visibility", showHidden ? "隐藏可见" : "显示隐藏", () => setShowHidden(!showHidden), showHidden)
            ]),
            selMode ? wbPlusBatchBar() : null,
            showSearchBar
                ? UI.TextField({
                    label: t.actionSearch,
                    placeholder: t.searchPlaceholder,
                    value: searchQuery,
                    onValueChange: setSearchQuery,
                    singleLine: true,
                    fillMaxWidth: true,
                    leadingIcon: UI.Icon({
                        name: "search",
                        size: 18,
                        tint: colors.onSurfaceVariant
                    }),
                    trailingIcon: hasSearchQuery
                        ? UI.IconButton({
                            onClick: () => setSearchQuery(""),
                            icon: "close"
                        })
                        : undefined
                })
                : null
        ].filter(Boolean))
    ];
    if (view === "group_create" || view === "group_edit") {
        return UI.LazyColumn({ fillMaxSize: true, spacing: 12, padding: { horizontal: 12, vertical: 8 } }, [renderGroupForm()]);
    }
    if (view === "group_delete") {
        return UI.LazyColumn({ fillMaxSize: true, spacing: 12, padding: { horizontal: 12, vertical: 8 } }, [renderGroupDeleteView()]);
    }
    if (view === "copy_to_group") {
        return UI.LazyColumn({ fillMaxSize: true, spacing: 12, padding: { horizontal: 12, vertical: 8 } }, [renderCopyToGroupView()]);
    }
    if (view === "edit" || view === "create") {
        return UI.Box({
            fillMaxSize: true
        }, [
            UI.LazyColumn({
                fillMaxSize: true,
                spacing: 12,
                padding: { horizontal: 12, vertical: 8 }
            }, [renderForm()]),
            showSnippetPicker ? renderSnippetDialog() : null
        ].filter(Boolean));
    }
    if (view === "import") {
        return UI.LazyColumn({
            fillMaxSize: true,
            spacing: 12,
            padding: { horizontal: 12, vertical: 8 }
        }, [renderImportForm()]);
    }
    if (view === "enhance") {
        return renderEnhancePanel();
    }
    if (loading || !hasLoadedOnce) {
        items.push(UI.Column({
            key: "loading",
            fillMaxWidth: true,
            horizontalAlignment: "center",
            padding: 32
        }, [
            UI.CircularProgressIndicator({}),
            UI.Spacer({ height: 8 }),
            UI.Text({
                text: t.listLoading,
                color: colors.onSurfaceVariant
            })
        ]));
    }
    else if (entries.length === 0) {
        items.push(UI.Card({
            key: "empty",
            fillMaxWidth: true,
            containerColor: colors.surfaceVariant,
            elevation: 0
        }, [
            UI.Column({
                fillMaxWidth: true,
                horizontalAlignment: "center",
                padding: 24,
                spacing: 8
            }, [
                UI.Text({
                    text: t.emptyTitle,
                    style: "titleMedium",
                    color: colors.onSurface
                }),
                UI.Text({
                    text: t.emptyDesc,
                    style: "bodySmall",
                    color: colors.onSurfaceVariant
                }),
                UI.FilledTonalButton({
                    onClick: doCreate,
                    height: 36
                }, [
                    UI.Text({
                        text: t.emptyAction,
                        color: colors.onSecondaryContainer,
                        fontWeight: "bold"
                    })
                ])
            ])
        ]));
    }
    else if (visibleEntries.length === 0) {
        items.push(UI.Card({
            key: "search-empty",
            fillMaxWidth: true,
            containerColor: colors.surfaceVariant,
            elevation: 0
        }, [
            UI.Column({
                fillMaxWidth: true,
                horizontalAlignment: "center",
                padding: 24,
                spacing: 8
            }, [
                UI.Text({
                    text: t.searchEmptyTitle,
                    style: "titleMedium",
                    color: colors.onSurface
                }),
                UI.Text({
                    text: t.searchEmptyDesc,
                    style: "bodySmall",
                    color: colors.onSurfaceVariant
                })
            ])
        ]));
    }
    else {
        if (hasSearchQuery) {
            for (const entry of visibleEntries) {
                items.push(renderCard(entry));
            }
        }
        else {
            // Show grouped view
            for (const group of groups) {
                items.push(renderGroupHeader(group));
            }
            const ungroupedNode = renderUngroupedSection();
            if (ungroupedNode) {
                items.push(ungroupedNode);
            }
        }
    }
    return UI.LazyColumn({
        spacing: 10,
        padding: { horizontal: 12, vertical: 8 },
        fillMaxSize: true,
        onLoad: async () => {
            if (hasLoadedOnce || initialLoadInFlight) {
                return;
            }
            setInitialLoadInFlight(true);
            try {
                await loadEntries(true);
                await ensureCharacterCardsLoaded(false);
            }
            finally {
                setInitialLoadInFlight(false);
            }
        }
    }, items);
}