// 关卡结构: 一款游戏 / 单入口 / 三个世界(=三种玩法) × 三个小关(=三档难度)
//   世界1 音符跳跃(单键上跳·全民K歌红鸟)  1-1 1-2 1-3
//   世界2 敲击工坊(多轨敲钉·酷狗蓝狗)      2-1 2-2 2-3
//   世界3 节奏切割(滑动切音符·QQ企鹅)      3-1 3-2 3-3
import { TRACKS } from "./tracks.js?v=1785348576";
import { getIP } from "./ip.js?v=1785348576";

// 世界顺序(玩法由易到难: 单点 -> 多轨 -> 滑切)
const WORLD_ORDER = ["jump", "workshop", "cut"];

const DIFFS = [
  { diff: "easy",   name: "跟拍", lv: "★☆☆", tip: "正拍稳踩" },
  { diff: "normal", name: "卡点", lv: "★★☆", tip: "切分+蓄力" },
  { diff: "hard",   name: "炫技", lv: "★★★", tip: "假动作陷阱" },
];

export const WORLDS = WORLD_ORDER.map((id, wi) => {
  const track = TRACKS.find((t) => t.id === id);
  const ip = getIP(track.ip);
  return {
    world: wi + 1, track, ip,
    name: track.name, scene: track.scene, sceneName: track.sceneName, verb: track.verb,
    emoji: track.emoji, colorA: track.colorA, colorB: track.colorB,
    levels: DIFFS.map((d, li) => ({
      id: `${wi + 1}-${li + 1}`, world: wi + 1, sub: li + 1,
      label: `${wi + 1}-${li + 1}`,
      diff: d.diff, name: d.name, lv: d.lv, tip: d.tip,
      track, scene: track.scene, sceneName: track.sceneName,
    })),
  };
});

export function findLevel(levelId) {
  for (const w of WORLDS) {
    const lv = w.levels.find((l) => l.id === levelId);
    if (lv) return { world: w, level: lv };
  }
  return null;
}

// ---- 进度 / 星级 / 解锁(localStorage) ----
const KEY = "tme_progress_v2";

export function getProgress() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}
function saveProgress(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }

export function rankStars(rank) {
  return rank === "S" ? 3 : rank === "A" ? 2 : (rank === "B" || rank === "C") ? 1 : 0;
}

export function recordClear(levelId, rank, score) {
  const p = getProgress();
  const stars = rankStars(rank);
  const prev = p[levelId] || { stars: 0, best: 0 };
  p[levelId] = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, score || 0) };
  saveProgress(p);
  return p[levelId];
}

// 解锁规则: 每个世界的 x-1 默认开放(方便演示三种玩法);
//   x-2 需通关 x-1, x-3 需通关 x-2 (世界内线性解锁)
export function isUnlocked(levelId) {
  const [w, s] = levelId.split("-").map(Number);
  if (s <= 1) return true;
  const prev = `${w}-${s - 1}`;
  const p = getProgress();
  return !!(p[prev] && p[prev].stars > 0);
}

export function levelStars(levelId) {
  const p = getProgress();
  return p[levelId]?.stars || 0;
}
