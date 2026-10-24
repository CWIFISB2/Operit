"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// ============ 世界书条目演化引擎 v1 ============
// 参考开源实现：
//   PromptAgent (arXiv 2310.16427, maitrix-org)
//     采样错误 -> 生成错误反馈(action) -> 计算奖励 -> MCTS 保留高奖励路径
//   Promptomatix (SalesforceAIResearch)
//     optimize -> generate_feedback -> optimize_with_feedback 闭环
//   OPRO (google-deepmind)
//     把历史 (instruction, score) 轨迹整体交给优化器
//   APE (Automatic Prompt Engineer)
//     生成候选 -> 打分 -> 择优保留
//
// 映射到世界书条目：
//   条目正文             = prompt
//   触发后 AI 被纠正     = 模型错误 errors
//   纠正原因             = 错误反馈 action
//   无纠正率             = reward (0-1)
//   条目版本             = MCTS 节点
//   history[]            = 搜索路径
// 铁律：只有 corrections > 0 才允许演化，无错误不改写。

// ---------- 基础工具 ----------
function clamp01(v, d) {
    var n = Number(v);
    if (!isFinite(n)) return (d === undefined ? 0 : d);
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
}
function round3(v) {
    return Math.round((Number(v) || 0) * 1000) / 1000;
}
function entryName(entry) {
    if (!entry || typeof entry !== "object") return "";
    return String(entry.name || entry.title || "").trim();
}

// ---------- 静态先验（APE 的初始打分） ----------
// trials 为 0 时不能给 0.5 一刀切，否则 66 条全一样、排名无信息。
// 这里用可解释的结构指标给先验分，真实 trials 积累后实测逐步接管。
function staticPrior(entry) {
    if (!entry || typeof entry !== "object") return 0.5;
    var score = 0.42;
    var content = String(entry.content || "");
    var len = content.length;

    // 可触发性：有关键词或常驻，否则根本不会被召回
    var kw = Array.isArray(entry.keywords) ? entry.keywords.filter(function (k) { return String(k || "").trim(); }) : [];
    if (entry.always_active) score += 0.10;
    else if (kw.length > 0) score += 0.08;
    else score -= 0.10;

    // 体量：太短缺约束，太长挤上下文
    if (len >= 80 && len <= 1200) score += 0.10;
    else if (len > 1200 && len <= 2500) score += 0.04;
    else if (len > 2500) score -= 0.08;
    else if (len > 0 && len < 80) score -= 0.10;
    else if (len === 0) score -= 0.20;

    // 结构化：有分段或列表说明约束清楚
    if (content.indexOf(String.fromCharCode(10)) >= 0) score += 0.05;
    if (content.indexOf("- ") >= 0 || content.indexOf(entryName(entry)) >= 0) score += 0.03;

    // 命名可识别
    if (entryName(entry).length >= 2) score += 0.03;

    // 关键词数量合理
    if (kw.length >= 2 && kw.length <= 12) score += 0.04;
    else if (kw.length > 20) score -= 0.04;

    // 有召回模式配置
    if (entry.recall_mode) score += 0.02;

    return round3(clamp01(score, 0.5));
}

// ---------- reward（PromptAgent 的 cal_metric） ----------
// 贝叶斯收缩：k=4，先验强度 4 次样本，避免 1 次命中就满分
function computeReward(trials, corrections, prior) {
    var t = Math.max(0, Number(trials) || 0);
    var c = Math.max(0, Number(corrections) || 0);
    if (c > t) c = t;
    var p = (prior === undefined || prior === null) ? 0.5 : clamp01(prior, 0.5);
    var k = 4;
    var ok = t - c;
    return round3((ok + k * p) / (t + k));
}

function rewardTier(reward, trials) {
    var t = Number(trials) || 0;
    if (t < 3) return "insufficient";
    var r = Number(reward) || 0;
    if (r >= 0.85) return "mature";
    if (r >= 0.65) return "stable";
    if (r >= 0.4) return "shaky";
    return "broken";
}

// 按先验分给的预期层级：样本不足时用它看结构质量
// 语义与实测 tier 一致，但只是"起点判断"，不作结论
function priorTier(entry) {
    var p = (entry && typeof entry.evo_prior === "number") ? entry.evo_prior : staticPrior(entry);
    if (p >= 0.72) return "stable";
    if (p >= 0.6) return "shaky";
    return "broken";
}

// ---------- 字段补全 ----------
function ensureEvo(entry) {
    if (!entry || typeof entry !== "object") return entry;
    var prior = staticPrior(entry);
    if (typeof entry.evo_prior !== "number") entry.evo_prior = prior;
    if (typeof entry.version !== "number") entry.version = 1;
    if (typeof entry.trials !== "number") entry.trials = 0;
    if (typeof entry.corrections !== "number") entry.corrections = 0;
    if (!Array.isArray(entry.errors)) entry.errors = [];
    if (!Array.isArray(entry.history)) entry.history = [];
    if (typeof entry.lastEvolvedAt !== "number") entry.lastEvolvedAt = 0;
    entry.reward = computeReward(entry.trials, entry.corrections, entry.evo_prior);
    return entry;
}

// ---------- 采样信号 ----------
// kind: correction / error（计为纠正） | success（计为通过）
function harvestSignal(entry, signal, now) {
    ensureEvo(entry);
    var at = now || Date.now();
    var kind = String((signal && signal.kind) || "correction").toLowerCase();
    var detail = String((signal && signal.detail) || "").trim();

    entry.trials = (entry.trials || 0) + 1;
    if (kind === "correction" || kind === "error") {
        entry.corrections = (entry.corrections || 0) + 1;
        if (detail) {
            entry.errors.push({ at: at, kind: kind, detail: detail.slice(0, 300) });
            if (entry.errors.length > 12) entry.errors = entry.errors.slice(-12);
        }
    }
    entry.reward = computeReward(entry.trials, entry.corrections, entry.evo_prior);
    entry.evo_tier = rewardTier(entry.reward, entry.trials);
    return entry;
}

// ---------- 生成诊断（Promptomatix 的 generate_feedback） ----------
function buildFeedback(entry) {
    ensureEvo(entry);
    var r = entry.reward || 0;
    var t = entry.trials || 0;
    var c = entry.corrections || 0;
    var tier = rewardTier(r, t);
    var advice = [];

    if (tier === "insufficient") {
        advice.push("样本不足（" + t + " 次），先积累使用记录再谈改写");
    } else if (tier === "broken") {
        advice.push("无纠正率仅 " + Math.round(r * 100) + "%，基本没起作用，考虑重写或并入其它条目");
    } else if (tier === "shaky") {
        advice.push("无纠正率 " + Math.round(r * 100) + "%，方向对但不够准，需要收紧表述");
    } else if (tier === "stable") {
        advice.push("无纠正率 " + Math.round(r * 100) + "%，稳定可用，暂不必改");
    } else {
        advice.push("无纠正率 " + Math.round(r * 100) + "%，已成熟，不改才对");
    }

    // 从错误证据提炼动作
    var seen = {};
    var actions = [];
    for (var i = 0; i < entry.errors.length; i += 1) {
        var d = String(entry.errors[i].detail || "").trim();
        if (!d || seen[d]) continue;
        seen[d] = 1;
        actions.push(d);
        if (actions.length >= 5) break;
    }
    if (actions.length) {
        advice.push("累计错误证据 " + c + " 条，高频原因：");
        for (var j = 0; j < actions.length; j += 1) advice.push("  - " + actions[j]);
    }

    var content = String(entry.content || "");
    if (content.length > 3000) advice.push("正文 " + content.length + " 字偏长，建议拆分");
    if (content.length > 0 && content.length < 40) advice.push("正文仅 " + content.length + " 字偏短，可能缺关键约束");
    if (!entry.always_active && (!Array.isArray(entry.keywords) || entry.keywords.length === 0)) {
        advice.push("没有关键词也不常驻，这条永远不会被召回");
    }

    return {
        id: entry.id,
        name: entryName(entry),
        tier: rewardTier(r, t),
        prior_tier: priorTier(entry),
        reward: round3(r),
        prior: round3(entry.evo_prior || 0),
        trials: t,
        corrections: c,
        version: entry.version || 1,
        advice: advice,
        shouldEvolve: (rewardTier(r, t) === "broken" || rewardTier(r, t) === "shaky") && c > 0
    };
}

// ---------- 应用演化（MCTS 节点推进） ----------
function applyEvolution(entry, newContent, why, now) {
    ensureEvo(entry);
    var at = now || Date.now();
    var prev = String(entry.content || "");
    var next = String(newContent || "");
    if (prev === next) {
        return { changed: false, reason: "内容未变" };
    }
    entry.history.push({
        version: entry.version || 1,
        content: prev,
        reward: entry.reward || 0,
        trials: entry.trials || 0,
        corrections: entry.corrections || 0,
        at: at,
        why: String(why || "")
    });
    if (entry.history.length > 8) entry.history = entry.history.slice(-8);

    entry.content = next;
    entry.version = (entry.version || 1) + 1;
    entry.lastEvolvedAt = at;
    // 新节点重新评估：统计清零，先验按新内容重算
    entry.trials = 0;
    entry.corrections = 0;
    entry.errors = [];
    entry.evo_prior = staticPrior(entry);
    entry.reward = computeReward(0, 0, entry.evo_prior);
    entry.evo_tier = rewardTier(entry.reward, 0);
    return { changed: true, version: entry.version, prevVersion: entry.version - 1 };
}

// ---------- 排名（PromptAgent 的 top-k 保留） ----------
// 升序：最差的在前，先处理最差的
function rankEntries(entries, minTrials) {
    var mt = (minTrials === undefined) ? 0 : Number(minTrials) || 0;
    var out = [];
    for (var i = 0; i < entries.length; i += 1) {
        var e = ensureEvo(entries[i]);
        if (e.enabled === false) continue;
        var t = e.trials || 0;
        if (t < mt) continue;
        out.push({
            id: e.id,
            name: entryName(e),
            tier: rewardTier(e.reward, t),
            prior_tier: priorTier(e),
            reward: round3(e.reward || 0),
            prior: round3(e.evo_prior || 0),
            trials: t,
            corrections: e.corrections || 0,
            version: e.version || 1,
            len: String(e.content || "").length,
            always_active: !!e.always_active,
            keywords: Array.isArray(e.keywords) ? e.keywords.length : 0
        });
    }
    out.sort(function (a, b) {
        if (a.reward !== b.reward) return a.reward - b.reward;
        return b.trials - a.trials;
    });
    return out;
}

module.exports = {
    clamp01: clamp01,
    round3: round3,
    entryName: entryName,
    staticPrior: staticPrior,
    computeReward: computeReward,
    rewardTier: rewardTier,
    priorTier: priorTier,
    ensureEvo: ensureEvo,
    harvestSignal: harvestSignal,
    buildFeedback: buildFeedback,
    applyEvolution: applyEvolution,
    rankEntries: rankEntries
};