// 判定逻辑 — 纯函数, 便于单测
// 判定窗口(秒), 见设计文档
export const WINDOWS = { perfect: 0.065, good: 0.13, miss: 0.17 };

export const SCORE = { perfect: 100, good: 50, miss: 0 };

// 给定音符时间与命中时间, 返回判定级别(命中在 good 窗口内才算命中)
export function judgeHit(noteTime, hitTime) {
  const d = Math.abs(hitTime - noteTime);
  if (d <= WINDOWS.perfect) return "perfect";
  if (d <= WINDOWS.good) return "good";
  return null; // 不在可命中窗口(太早/太远, 忽略这次输入)
}

// 计分器: 维护 combo / score / 统计, 计算最终评级
export function createScorer(totalNotes) {
  let expectedNotes = totalNotes;
  let score = 0, combo = 0, maxCombo = 0, rankProgress = 0;
  const counts = { perfect: 0, good: 0, miss: 0 };

  function add(judgement) {
    counts[judgement]++;
    if (judgement === "miss") {
      combo = 0;
      rankProgress = 0;
    } else {
      combo++;
      if (combo > maxCombo) maxCombo = combo;
      // 评级条刻意做得轻量爽快：约 12 个 PERFECT 或 17 个 GOOD 即可充满。
      rankProgress = Math.min(1, rankProgress + (judgement === "perfect" ? 0.085 : 0.06));
      // combo 倍率(温和): 每 10 连 +5%, 上限 +50%
      const mult = 1 + Math.min(0.5, Math.floor(combo / 10) * 0.05);
      score += SCORE[judgement] * mult;
    }
    return { judgement, combo, score: Math.round(score) };
  }

  function rank() {
    if (rankProgress >= 1) return "SSS";
    if (rankProgress >= 2 / 3) return "SS";
    if (rankProgress >= 1 / 3) return "S";
    return "A";
  }

  // 空挥/抢拍: 只断连击, 不计入音符统计
  function breakCombo() { combo = 0; }

  // 道具直接加减分(不计入判定统计, 不影响连击): 炸弹扣分 / 加速道具加分 / 冰冻加分
  function addRaw(delta) { score = Math.max(0, score + delta); return Math.round(score); }
  function setTotalNotes(next) { expectedNotes = Math.max(0, Number(next) || 0); }

  return {
    add, breakCombo, addRaw, setTotalNotes,
    get score() { return Math.round(score); },
    get combo() { return combo; },
    get maxCombo() { return maxCombo; },
    get rankProgress() { return rankProgress; },
    get counts() { return counts; },
    rank,
    get totalNotes() { return expectedNotes; },
    isFullCombo() { return counts.miss === 0 && (counts.perfect + counts.good) === expectedNotes; },
  };
}
