"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Screen;

// 世界书 v2 · 增强字段编辑面板
//
// 关键约束（第一版踩过的坑，这里全部规避）：
//   1. 所有 ctx.useState / ctx.useRef 必须在 Screen 顶层调用 —— 不能放在
//      嵌套函数里（Compose DSL 的 hook 顺序约束）。
//   2. 不跨 ToolPkg 调工具：ToolPkg 工具之间不互通，这里直接 require 共享模块。
//   3. 编辑缓冲统一放在 Screen 顶层的一组 state 里，openEdit() 时灌入，
//      避免每条目一个 state。
//   4. UI 只负责渲染 + 发命令，业务全在 wb_store_v2 / wb_fields / wb_engine。

const wb_data_1 = require("../../shared/wb_data.js");
const wb_fields_1 = require("../../shared/wb_fields.js");
const wb_store_v2_1 = require("../../shared/wb_store_v2.js");
const wb_engine_1 = require("../../shared/wb_engine.js");

const RUNTIME_FILE = "worldbook_v2.json";
const DEFAULT_RUNTIME = {
    enabled: true,
    tokenBudget: 0,
    minActivations: 0,
    maxRecursionDepth: 5,
    stickyEnabled: true,
    appendToExisting: true,
};

const KEY_LOGIC_OPTS = ["and_any", "and_all", "not_any", "not_all"];
const POS_OPTS = ["append", "prepend", "at_depth"];

function runtimePath() {
    return String(wb_data_1.NATIVE_DIR || "") + "/" + RUNTIME_FILE;
}

async function readRuntimeCfg() {
    try {
        const r = await Tools.Files.read(runtimePath());
        const txt = String((r && r.content) || "").trim();
        if (!txt) return Object.assign({}, DEFAULT_RUNTIME);
        return Object.assign({}, DEFAULT_RUNTIME, JSON.parse(txt));
    } catch (_e) {
        return Object.assign({}, DEFAULT_RUNTIME);
    }
}

async function writeRuntimeCfg(cfg) {
    try {
        await Tools.Files.write(runtimePath(), JSON.stringify(cfg, null, 2));
        return { ok: true };
    } catch (err) {
        return { ok: false, error: String((err && err.message) || err) };
    }
}

function num(v, dflt) {
    const n = parseInt(String(v == null ? "" : v), 10);
    return isNaN(n) ? dflt : n;
}

function Screen(ctx) {
    const colors = ctx.MaterialTheme.colorScheme;

    // ---------- ① 顶层 state（全部在此，禁止下沉） ----------
    const [tick, setTick] = ctx.useState("v2tick", 0);
    const bump = () => setTick(tick + 1);

    const [loading, setLoading] = ctx.useState("v2loading", true);
    const [errMsg, setErrMsg] = ctx.useState("v2err", "");
    const [tipMsg, setTipMsg] = ctx.useState("v2tip", "");

    const entriesRef = ctx.useRef("v2entries", []);
    const entries = entriesRef.current;
    const setEntries = (v) => { entriesRef.current = Array.isArray(v) ? v : []; bump(); };

    const [filter, setFilter] = ctx.useState("v2filter", "all");
    const [query, setQuery] = ctx.useState("v2query", "");
    const [expandedId, setExpandedId] = ctx.useState("v2expanded", "");
    const [busyId, setBusyId] = ctx.useState("v2busy", "");

    // 编辑缓冲（一次性灌入，不按条目开 state）
    const [bufProb, setBufProb] = ctx.useState("v2bProb", "100");
    const [bufKeyLogic, setBufKeyLogic] = ctx.useState("v2bKL", "and_any");
    const [bufSecLogic, setBufSecLogic] = ctx.useState("v2bSL", "and_any");
    const [bufWhole, setBufWhole] = ctx.useState("v2bWhole", false);
    const [bufGroups, setBufGroups] = ctx.useState("v2bGroups", "");
    const [bufWeight, setBufWeight] = ctx.useState("v2bWeight", "100");
    const [bufPrio, setBufPrio] = ctx.useState("v2bPrio", false);
    const [bufSticky, setBufSticky] = ctx.useState("v2bSticky", "0");
    const [bufCool, setBufCool] = ctx.useState("v2bCool", "0");
    const [bufDelay, setBufDelay] = ctx.useState("v2bDelay", "0");
    const [bufExcRec, setBufExcRec] = ctx.useState("v2bExcRec", false);
    const [bufPreRec, setBufPreRec] = ctx.useState("v2bPreRec", false);
    const [bufPos, setBufPos] = ctx.useState("v2bPos", "append");
    const [bufDepth, setBufDepth] = ctx.useState("v2bDepth", "0");
    const [bufOrder, setBufOrder] = ctx.useState("v2bOrder", "100");

    // 运行时配置缓冲
    const [rtBudget, setRtBudget] = ctx.useState("v2rtBudget", "0");
    const [rtMin, setRtMin] = ctx.useState("v2rtMin", "0");
    const [rtDepth, setRtDepth] = ctx.useState("v2rtDepth", "5");

    // 干跑
    const [dryText, setDryText] = ctx.useState("v2dryText", "");
    const [dryOut, setDryOut] = ctx.useState("v2dryOut", "");
    const dryActRef = ctx.useRef("v2dryAct", []);
    const dryAct = dryActRef.current;
    const setDryAct = (v) => { dryActRef.current = Array.isArray(v) ? v : []; bump(); };

    const [statsLine, setStatsLine] = ctx.useState("v2stats", "");

    // ---------- ② 读取 ----------
    async function reload() {
        setLoading(true);
        setErrMsg("");
        try {
            const list = await wb_store_v2_1.readEntriesV2();
            setEntries(list);
            const st = wb_store_v2_1.v2Stats(list);
            setStatsLine(
                "共 " + st.total + " 条　概率 " + st.withProbability +
                "　分组 " + st.withGroups + "　时效 " + st.withTiming +
                "　递归 " + st.withRecursion + "　角色过滤 " + st.withCharFilter
            );
            const cfg = await readRuntimeCfg();
            setRtBudget(String(num(cfg.tokenBudget, 0)));
            setRtMin(String(num(cfg.minActivations, 0)));
            setRtDepth(String(num(cfg.maxRecursionDepth, 5)));
        } catch (e) {
            setErrMsg("读取失败：" + String((e && e.message) || e));
        }
        setLoading(false);
    }

    async function ensureLoaded() {
        if (entries.length === 0 && loading) {
            await reload();
        }
    }
    // 保留但不由渲染期调用（见底部 onLoad）。
    void ensureLoaded;

    // ---------- ③ 编辑缓冲灌入 ----------
    function openEdit(e) {
        const v = wb_fields_1.normalizeV2Entry(e);
        setBufProb(String(v.probability));
        setBufKeyLogic(v.keyLogic);
        setBufSecLogic(v.secondaryLogic);
        setBufWhole(v.matchWholeWords === true);
        setBufGroups(v.inclusionGroups || "");
        setBufWeight(String(v.groupWeight));
        setBufPrio(v.prioritizeInclusion === true);
        setBufSticky(String(v.sticky));
        setBufCool(String(v.cooldown));
        setBufDelay(String(v.delay));
        setBufExcRec(v.excludeRecursion === true);
        setBufPreRec(v.preventRecursion === true);
        setBufPos(v.position);
        setBufDepth(String(v.depth));
        setBufOrder(String(v.order));
        setExpandedId(String(e.id || ""));
    }

    // ---------- ④ 保存单个 ----------
    async function saveEntry(id) {
        if (busyId) return;
        setBusyId(String(id));
        setErrMsg("");
        try {
            const patch = {
                probability: num(bufProb, 100),
                keyLogic: bufKeyLogic,
                secondaryLogic: bufSecLogic,
                matchWholeWords: bufWhole === true,
                inclusionGroups: String(bufGroups || ""),
                groupWeight: num(bufWeight, 100),
                prioritizeInclusion: bufPrio === true,
                sticky: num(bufSticky, 0),
                cooldown: num(bufCool, 0),
                delay: num(bufDelay, 0),
                excludeRecursion: bufExcRec === true,
                preventRecursion: bufPreRec === true,
                position: bufPos,
                depth: num(bufDepth, 0),
                order: num(bufOrder, 100),
            };
            const r = await wb_store_v2_1.patchEntryV2(String(id), patch);
            if (r && r.ok) {
                setTipMsg("已保存 " + String(id));
                await reload();
            } else {
                setErrMsg("保存失败：" + String((r && r.error) || "unknown"));
            }
        } catch (e) {
            setErrMsg("保存异常：" + String((e && e.message) || e));
        }
        setBusyId("");
    }

    // ---------- ⑤ 重置 ----------
    async function resetEntry(id) {
        if (busyId) return;
        setBusyId(String(id));
        setErrMsg("");
        try {
            const patch = Object.assign({}, wb_fields_1.V2_DEFAULTS);
            const r = await wb_store_v2_1.patchEntryV2(String(id), patch);
            if (r && r.ok) {
                setTipMsg("已重置 " + String(id));
                await reload();
            } else {
                setErrMsg("重置失败：" + String((r && r.error) || "unknown"));
            }
        } catch (e) {
            setErrMsg("重置异常：" + String((e && e.message) || e));
        }
        setBusyId("");
    }

    // ---------- ⑥ 运行时保存 ----------
    async function saveRuntime() {
        setErrMsg("");
        try {
            const cfg = {
                enabled: true,
                tokenBudget: num(rtBudget, 0),
                minActivations: num(rtMin, 0),
                maxRecursionDepth: num(rtDepth, 5),
                stickyEnabled: true,
                appendToExisting: true,
            };
            const r = await writeRuntimeCfg(cfg);
            if (r && r.ok) setTipMsg("运行时配置已保存");
            else setErrMsg("运行时保存失败：" + String((r && r.error) || "unknown"));
        } catch (e) {
            setErrMsg("运行时异常：" + String((e && e.message) || e));
        }
        bump();
    }

    // ---------- ⑦ 干跑 ----------
    async function runDry() {
        const txt = String(dryText || "").trim();
        if (!txt) { setErrMsg("请先输入测试文本"); return; }
        setErrMsg("");
        setDryOut("运行中…");
        setDryAct([]);
        try {
            let list = await wb_store_v2_1.readEntriesV2();
            for (let i = 0; i < list.length; i += 1) delete list[i]._matched;
            const cfg = await readRuntimeCfg();
            const res = wb_engine_1.runPipeline(list, txt, 0, {
                tokenBudget: num(cfg.tokenBudget, 0),
                minActivations: num(cfg.minActivations, 0),
                maxRecursionDepth: num(cfg.maxRecursionDepth, 5),
            });
            const act = [];
            for (let k = 0; k < res.entries.length; k += 1) {
                const e = res.entries[k];
                act.push({
                    id: String(e.id || ""),
                    name: String(e.name || ""),
                    always: e.always_active === true,
                    forced: e._forced === true,
                });
            }
            setDryAct(act);
            const d = res.diag || {};
            setDryOut(
                "总数 " + list.length +
                "　激活 " + act.length +
                (d.tokenCost != null ? "　token " + d.tokenCost : "") +
                (d.dropped != null ? "　裁掉 " + d.dropped : "")
            );
        } catch (e) {
            setDryOut("");
            setErrMsg("干跑异常：" + String((e && e.message) || e));
        }
    }

    // ---------- ⑧ 迁移 ----------
    async function doMigrate() {
        setErrMsg("");
        try {
            const r = await wb_store_v2_1.migrateAllOnce();
            if (r && r.ok) {
                setTipMsg(r.skipped ? "已迁移过，跳过" : "迁移完成 " + r.count + " 条");
                await reload();
            } else {
                setErrMsg("迁移失败：" + String((r && r.error) || "unknown"));
            }
        } catch (e) {
            setErrMsg("迁移异常：" + String((e && e.message) || e));
        }
    }

    // ---------- ⑨ 派生 ----------
    const list = Array.isArray(entries) ? entries : [];
    const q = String(query || "").trim().toLowerCase();
    const shown = [];
    for (let i = 0; i < list.length; i += 1) {
        const e = list[i] || {};
        const v = wb_fields_1.normalizeV2Entry(e);
        if (filter === "nondefault") {
            const nonDefault =
                v.probability < 100 || !!v.inclusionGroups ||
                v.sticky > 0 || v.cooldown > 0 || v.delay > 0 ||
                v.excludeRecursion || v.preventRecursion ||
                v.keyLogic !== "and_any";
            if (!nonDefault) continue;
        }
        if (q) {
            const nm = String(e.name || "").toLowerCase();
            const ct = String(e.content || "").toLowerCase();
            if (nm.indexOf(q) < 0 && ct.indexOf(q) < 0) continue;
        }
        shown.push({ entry: e, v2: v });
    }

    // ---------- ⑩ 组件 ----------
    function chip(label, active, onTap) {
        // 选中态用 FilledTonalButton，未选中用 OutlinedButton —— DSL 里这两个
        // 是仅有的、属性集最稳的按钮形态（OutlinedButton 不支持 containerColor）。
        if (active) {
            return UI.FilledTonalButton({
                onClick: onTap,
                shape: { cornerRadius: 12 },
                height: 34,
            }, [UI.Text({ text: label, style: "bodySmall" })]);
        }
        return UI.OutlinedButton({
            onClick: onTap,
            shape: { cornerRadius: 12 },
            height: 34,
        }, [UI.Text({ text: label, style: "bodySmall" })]);
    }

    function numRow(label, value, onChange, hint) {
        return UI.Column({ spacing: 2 }, [
            UI.Text({ text: label, style: "bodySmall", color: colors.onSurfaceVariant }),
            UI.TextField({
                label: String(hint || ""),
                value: String(value == null ? "" : value),
                onValueChange: onChange,
                singleLine: true,
                fillMaxWidth: true,
            }),
        ]);
    }

    function switchRow(label, checked, onToggle) {
        return UI.Row({ fillMaxWidth: true, verticalAlignment: "center" }, [
            UI.Text({
                text: label,
                style: "bodySmall",
                color: colors.onSurface,
                weight: 1,
                weightFill: false,
            }),
            UI.Switch({ checked: checked === true, onCheckedChange: onToggle }),
        ]);
    }

    function logicRow(label, value, onChange) {
        const nodes = [];
        for (let i = 0; i < KEY_LOGIC_OPTS.length; i += 1) {
            const opt = KEY_LOGIC_OPTS[i];
            nodes.push(chip(opt, value === opt, () => onChange(opt)));
        }
        return UI.Column({ spacing: 4 }, [
            UI.Text({ text: label, style: "bodySmall", color: colors.onSurfaceVariant }),
            UI.Row({ spacing: 6 }, nodes),
        ]);
    }

    function entryCard(item) {
        const e = item.entry;
        const v = item.v2;
        const id = String(e.id || "");
        const isOpen = expandedId === id;
        const isBusy = busyId === id;

        const summaryBits = [];
        if (v.probability < 100) summaryBits.push(v.probability + "%");
        if (v.inclusionGroups) summaryBits.push("组:" + v.inclusionGroups);
        if (v.sticky > 0) summaryBits.push("持续" + v.sticky);
        if (v.cooldown > 0) summaryBits.push("冷却" + v.cooldown);
        if (v.delay > 0) summaryBits.push("延迟" + v.delay);
        if (v.keyLogic !== "and_any") summaryBits.push(v.keyLogic);
        if (v.excludeRecursion) summaryBits.push("不递归");
        if (v.preventRecursion) summaryBits.push("免递归");

        const head = [
            UI.Row({ fillMaxWidth: true, verticalAlignment: "center" }, [
                UI.Text({
                    text: String(e.name || "(未命名)"),
                    fontWeight: "bold",
                    color: colors.onSurface,
                    weight: 1,
                    weightFill: false,
                }),
                UI.Text({
                    text: e.enabled === false ? "停用" : "启用",
                    style: "bodySmall",
                    color: e.enabled === false ? colors.error : colors.primary,
                }),
            ]),
            UI.Text({
                text: summaryBits.length ? summaryBits.join("　") : "无增强字段",
                style: "bodySmall",
                color: colors.onSurfaceVariant,
            }),
        ];

        const body = [];
        if (isOpen) {
            body.push(UI.HorizontalDivider({}));
            body.push(numRow("触发概率 (0-100)", bufProb, setBufProb, "100=必定"));
            body.push(logicRow("关键词逻辑", bufKeyLogic, setBufKeyLogic));
            body.push(logicRow("次级关键词逻辑", bufSecLogic, setBufSecLogic));
            body.push(switchRow("全词匹配", bufWhole, (c) => setBufWhole(c === true)));
            body.push(numRow("包含组（逗号分隔）", bufGroups, setBufGroups, "同组只留一个"));
            body.push(numRow("组权重", bufWeight, setBufWeight, "越大越容易选"));
            body.push(switchRow("优先包含（按命中数确定性裁决）", bufPrio, (c) => setBufPrio(c === true)));
            body.push(numRow("持续条数 sticky", bufSticky, setBufSticky, "命中后保持 N 条"));
            body.push(numRow("冷却条数 cooldown", bufCool, setBufCool, "N 条内不再触发"));
            body.push(numRow("延迟条数 delay", bufDelay, setBufDelay, "N 条后才可触发"));
            body.push(switchRow("不参与递归扫描", bufExcRec, (c) => setBufExcRec(c === true)));
            body.push(switchRow("不被递归触发", bufPreRec, (c) => setBufPreRec(c === true)));
            body.push(UI.Column({ spacing: 4 }, [
                UI.Text({ text: "注入位置", style: "bodySmall", color: colors.onSurfaceVariant }),
                UI.Row({ spacing: 6 }, POS_OPTS.map((p) => chip(p, bufPos === p, () => setBufPos(p)))),
            ]));
            body.push(numRow("插入深度", bufDepth, setBufDepth, "at_depth 时生效"));
            body.push(numRow("排序 order", bufOrder, setBufOrder, "越小越优先"));
            body.push(UI.Row({ spacing: 8 }, [
                UI.OutlinedButton({
                    onClick: () => saveEntry(id),
                    shape: { cornerRadius: 12 },
                    weight: 1,
                    enabled: !isBusy,
                }, [UI.Text({ text: isBusy ? "保存中…" : "保存" })]),
                UI.OutlinedButton({
                    onClick: () => resetEntry(id),
                    shape: { cornerRadius: 12 },
                    weight: 1,
                    enabled: !isBusy,
                }, [UI.Text({ text: "重置默认" })]),
            ]));
        }

        return UI.Card({ containerColor: colors.surface, elevation: 1, modifier: ctx.Modifier.fillMaxWidth() }, [
            UI.Column({ padding: 12, fillMaxWidth: true, spacing: 6 }, [
                UI.Box({
                    modifier: ctx.Modifier.fillMaxWidth().clickable(() => {
                        if (isOpen) {
                            setExpandedId("");
                        } else {
                            openEdit(e);
                        }
                    }),
                }, [
                    UI.Column({ spacing: 4 }, head),
                ]),
                ...body,
            ].filter(Boolean)),
        ]);
    }

    function toolbar() {
        return UI.Card({ containerColor: colors.surface, elevation: 1, modifier: ctx.Modifier.fillMaxWidth() }, [
            UI.Column({ padding: 12, fillMaxWidth: true, spacing: 8 }, [
                UI.Text({ text: "世界书 v2 · 增强字段", fontWeight: "bold", color: colors.onSurface }),
                UI.Text({ text: statsLine || "尚未读取", style: "bodySmall", color: colors.onSurfaceVariant }),
                UI.TextField({
                    label: "搜索名称/内容",
                    value: query,
                    onValueChange: setQuery,
                    singleLine: true,
                    fillMaxWidth: true,
                }),
                UI.Row({ spacing: 8 }, [
                    chip("全部", filter === "all", () => setFilter("all")),
                    chip("仅已增强", filter === "nondefault", () => setFilter("nondefault")),
                    chip("刷新", false, () => reload()),
                    chip("迁移", false, () => doMigrate()),
                ]),
                errMsg ? UI.Text({ text: errMsg, style: "bodySmall", color: colors.error }) : null,
                tipMsg ? UI.Text({ text: tipMsg, style: "bodySmall", color: colors.primary }) : null,
            ].filter(Boolean)),
        ]);
    }

    function runtimeCard() {
        return UI.Card({ containerColor: colors.primaryContainer.copy({ alpha: 0.25 }), elevation: 1, modifier: ctx.Modifier.fillMaxWidth() }, [
            UI.Column({ padding: 12, fillMaxWidth: true, spacing: 8 }, [
                UI.Text({ text: "运行时配置", fontWeight: "bold", color: colors.onSurface }),
                UI.Text({ text: runtimePath(), style: "bodySmall", color: colors.onSurfaceVariant }),
                UI.Row({ spacing: 8 }, [
                    UI.Column({ weight: 1 }, [numRow("Token 预算（0=不限）", rtBudget, setRtBudget)]),
                    UI.Column({ weight: 1 }, [numRow("最少激活条数", rtMin, setRtMin)]),
                ]),
                UI.Row({ spacing: 8 }, [
                    UI.Column({ weight: 1 }, [numRow("最大递归深度", rtDepth, setRtDepth)]),
                    UI.Column({ weight: 1 }, [
                        UI.OutlinedButton({
                            onClick: () => saveRuntime(),
                            shape: { cornerRadius: 12 },
                            fillMaxWidth: true,
                        }, [UI.Text({ text: "保存运行时" })]),
                    ]),
                ]),
            ]),
        ]);
    }

    function dryCard() {
        const actNodes = [];
        for (let i = 0; i < dryAct.length; i += 1) {
            const a = dryAct[i];
            actNodes.push(UI.Text({
                text: "· " + a.name + (a.always ? " [常驻]" : "") + (a.forced ? " [强制]" : ""),
                style: "bodySmall",
                color: colors.onSurfaceVariant,
            }));
        }
        return UI.Card({ containerColor: colors.surface, elevation: 1, modifier: ctx.Modifier.fillMaxWidth() }, [
            UI.Column({ padding: 12, fillMaxWidth: true, spacing: 8 }, [
                UI.Text({ text: "干跑测试（不写库）", fontWeight: "bold", color: colors.onSurface }),
                UI.TextField({
                    label: "输入测试文本",
                    value: dryText,
                    onValueChange: setDryText,
                    singleLine: false,
                    fillMaxWidth: true,
                }),
                UI.OutlinedButton({
                    onClick: () => runDry(),
                    shape: { cornerRadius: 12 },
                    fillMaxWidth: true,
                }, [UI.Text({ text: "运行干跑" })]),
                dryOut ? UI.Text({ text: dryOut, style: "bodySmall", color: colors.primary }) : null,
                ...actNodes,
            ].filter(Boolean)),
        ]);
    }

    // ---------- ⑪ 渲染 ----------
    // 始终返回 LazyColumn —— 首次加载挂在 onLoad 上，
    // 若加载态提前 return 别的根节点，onLoad 永不触发 → 死锁（已由冒烟测试抓到）。
    const nodes = [];

    if (loading && list.length === 0) {
        nodes.push(UI.Card({ containerColor: colors.surface, elevation: 1, modifier: ctx.Modifier.fillMaxWidth() }, [
            UI.Column({ padding: 24, fillMaxWidth: true, spacing: 8, horizontalAlignment: "center" }, [
                UI.CircularProgressIndicator({}),
                UI.Text({ text: "正在读取世界书…", style: "bodySmall", color: colors.onSurfaceVariant }),
            ]),
        ]));
    }

    nodes.push(toolbar());
    nodes.push(runtimeCard());
    nodes.push(dryCard());

    if (shown.length === 0) {
        nodes.push(UI.Card({ containerColor: colors.surface, elevation: 1, modifier: ctx.Modifier.fillMaxWidth() }, [
            UI.Column({ padding: 12, fillMaxWidth: true, spacing: 4 }, [
                UI.Text({ text: "没有匹配的条目", color: colors.onSurfaceVariant }),
                UI.Text({
                    text: "世界书为空时请先在 v1 管理界面或通过工具创建条目。",
                    style: "bodySmall",
                    color: colors.onSurfaceVariant,
                }),
            ]),
        ]));
    } else {
        for (let i = 0; i < shown.length; i += 1) {
            nodes.push(entryCard(shown[i]));
        }
    }

    nodes.push(UI.Spacer({ height: 32 }));

    return UI.LazyColumn({
        fillMaxSize: true,
        spacing: 12,
        padding: { horizontal: 12, vertical: 8 },
        onLoad: async () => {
            if (!loading) return;
            await reload();
        },
    }, nodes);
}