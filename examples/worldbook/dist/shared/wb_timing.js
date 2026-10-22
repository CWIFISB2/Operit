"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTiming = resolveTiming;
exports.pruneTiming = pruneTiming;
// 世界书 v2 · 时效状态机（Sticky / Cooldown / Delay）
//
// 语义对齐 SillyTavern：
//   delay    ：条目首次可被触发前需要经过的消息条数（冷却前的等待）
//   sticky   ：一旦命中，后续 N 条消息内持续注入（不刷新，重复命中不续期）
//   cooldown ：sticky 结束后，N 条消息内不再触发
//
// 关键约束（与 ST 一致）：
//   1. 改条目（任一时效字段变化）→ 立即清除该条目进行中的效果
//   2. sticky 期间重复命中不刷新时长
//   3. cooldown 期间完全不可触发，包括 always_active
//   4. 计数以「用户消息条数」为基准（不是 token、不是轮次）
//
// 状态存于 state.timers[entryId]：
//   { firstSeen: number, lastHit: number, stickyUntil: number, cooldownUntil: number,
//     sig: string }
// sig 是时效配置的指纹，配置一变则整条状态作废。
var __TIMER = {};
function sigOf(entry) {
    return [
        String(Number(entry.delay) || 0),
        String(Number(entry.sticky) || 0),
        String(Number(entry.cooldown) || 0),
    ].join("|");
}
function clearTimer(entryId) {
    delete __TIMER[String(entryId)];
}
function resetAll() {
    __TIMER = {};
}
function getTimer(entryId) {
    return __TIMER[String(entryId)] || null;
}
function exportState() {
    // 供持久化：只导出必要字段
    var out = {};
    for (var k in __TIMER) {
        if (!Object.prototype.hasOwnProperty.call(__TIMER, k))
            continue;
        var t = __TIMER[k];
        out[k] = {
            firstSeen: t.firstSeen,
            lastHit: t.lastHit,
            stickyUntil: t.stickyUntil,
            cooldownUntil: t.cooldownUntil,
            sig: t.sig,
        };
    }
    return out;
}
function importState(obj) {
    __TIMER = {};
    if (!obj || typeof obj !== "object")
        return;
    for (var k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k))
            continue;
        var t = obj[k];
        if (!t || typeof t !== "object")
            continue;
        __TIMER[k] = {
            firstSeen: Number(t.firstSeen) || 0,
            lastHit: Number(t.lastHit) || 0,
            stickyUntil: Number(t.stickyUntil) || 0,
            cooldownUntil: Number(t.cooldownUntil) || 0,
            sig: String(t.sig || ""),
        };
    }
}
/**
 * 判断某个条目在当前消息序号下是否可触发。
 *
 * @param entry 条目
 * @param msgIndex 当前用户消息累计序号（从 0 开始）
 * @returns { ok, reason }
 */
function resolveTiming(entry, msgIndex) {
    var delay = Math.max(0, Number(entry.delay) || 0);
    var sticky = Math.max(0, Number(entry.sticky) || 0);
    var cooldown = Math.max(0, Number(entry.cooldown) || 0);
    var id = String(entry.id || "");
    if (!id)
        return { ok: true, reason: "no_id" };
    // 三个字段全为 0：不做时效控制
    if (delay === 0 && sticky === 0 && cooldown === 0) {
        return { ok: true, reason: "no_timing" };
    }
    var sig = sigOf(entry);
    var t = __TIMER[id];
    // 配置变化 → 整条状态作废
    if (t && t.sig !== sig) {
        delete __TIMER[id];
        t = undefined;
    }
    if (!t) {
        t = { firstSeen: msgIndex, lastHit: -1, stickyUntil: 0, cooldownUntil: 0, sig: sig };
        __TIMER[id] = t;
    }
    // ① delay：首次可触发前要过 N 条
    if (delay > 0 && msgIndex - t.firstSeen < delay) {
        return { ok: false, reason: "delay:" + (delay - (msgIndex - t.firstSeen)) };
    }
    // ② sticky：仍在持续期内，直接放行（无需关键词命中）
    // 【顺序关键】sticky 必须排在 cooldown 之前判断。
    // 因为 sticky 期间 cooldownUntil 已经被预置成 sticky+cooldown 的终点，
    // 若先判 cooldown 会导致 sticky 永不生效（v2 修复的 bug）。
    if (t.stickyUntil > 0 && msgIndex <= t.stickyUntil) {
        return { ok: true, reason: "sticky:" + (t.stickyUntil - msgIndex + 1), sticky: true };
    }
    // ③ cooldown：冷却中完全不可触发
    // 语义：命中后「接下来 N 条」冷却。用 <= 才能覆盖到第 N 条本身。
    if (t.cooldownUntil > 0 && msgIndex <= t.cooldownUntil) {
        return { ok: false, reason: "cooldown:" + (t.cooldownUntil - msgIndex + 1) };
    }
    return { ok: true, reason: "ready" };
}
/**
 * 记录一次命中，推进 sticky / cooldown。
 *
 * 语义要点：sticky 期间重复命中不续期（与 ST 一致）。
 */
function recordHit(entry, msgIndex) {
    var sticky = Math.max(0, Number(entry.sticky) || 0);
    var cooldown = Math.max(0, Number(entry.cooldown) || 0);
    var id = String(entry.id || "");
    if (!id)
        return;
    if (sticky === 0 && cooldown === 0)
        return;
    var sig = sigOf(entry);
    var t = __TIMER[id];
    if (t && t.sig !== sig) {
        delete __TIMER[id];
        t = undefined;
    }
    if (!t) {
        t = { firstSeen: msgIndex, lastHit: -1, stickyUntil: 0, cooldownUntil: 0, sig: sig };
        __TIMER[id] = t;
    }
    // sticky 已经在生效期内：不续期，只更新时间戳
    if (t.stickyUntil > msgIndex) {
        t.lastHit = msgIndex;
        return;
    }
    t.lastHit = msgIndex;
    if (sticky > 0) {
        t.stickyUntil = msgIndex + sticky;
        // sticky 结束后进入 cooldown
        if (cooldown > 0) {
            t.cooldownUntil = msgIndex + sticky + cooldown;
        }
    }
    else if (cooldown > 0) {
        t.cooldownUntil = msgIndex + cooldown;
    }
}
/**
 * 清理：条目被删除/禁用后，把无效的 timer 丢掉，防无限增长。
 *
 * @param validIds 当前存在的条目 id 集合
 */
function pruneTiming(validIds) {
    var keep = {};
    for (var k in __TIMER) {
        if (!Object.prototype.hasOwnProperty.call(__TIMER, k))
            continue;
        if (validIds.has(String(k))) {
            keep[k] = __TIMER[k];
        }
    }
    __TIMER = keep;
}
/**
 * 条目被修改时清除其时效状态（ST 的“改条目即移除进行中效果”）。
 */
function invalidate(entryId) {
    delete __TIMER[String(entryId)];
}
/**
 * 诊断：返回当前所有进行中的状态（供 UI 展示）。
 */
function snapshot() {
    var out = [];
    for (var k in __TIMER) {
        if (!Object.prototype.hasOwnProperty.call(__TIMER, k))
            continue;
        var t = __TIMER[k];
        out.push({
            id: k,
            firstSeen: t.firstSeen,
            lastHit: t.lastHit,
            stickyUntil: t.stickyUntil,
            cooldownUntil: t.cooldownUntil,
        });
    }
    return out;
}
exports.resetAll = resetAll;
exports.getTimer = getTimer;
exports.exportState = exportState;
exports.importState = importState;
exports.recordHit = recordHit;
exports.invalidate = invalidate;
exports.snapshot = snapshot;