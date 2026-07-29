// 判定逻辑 — 纯函数, 便于单测
// 判定窗口(秒), 见设计文档
export const WINDOWS = { perfect: 0.045, good: 0.09, miss: 0.14 };

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
  let score = 0, combo = 0, maxCombo = 0;
  const counts = { perfect: 0, good: 0, miss: 0 };

  function add(judgement) {
    counts[judgement]++;
    if (judgement === "miss") {
      combo = 0;
    } else {
      combo++;
      if (combo > maxCombo) maxCombo = combo;
      // combo 倍率(温和): 每 10 连 +5%, 上限 +50%
      const mult = 1 + Math.min(0.5, Math.floor(combo / 10) * 0.05);
      score += SCORE[judgement] * mult;
    }
    return { judgement, combo, score: Math.round(score) };
  }

  function accuracy() {
    const done = counts.perfect + counts.good + counts.miss;
    if (!done) return 1;
    return (counts.perfect + counts.good * 0.5) / done;
  }

  function rank() {
    const acc = accuracy();
    if (counts.miss === 0 && acc >= 0.95) return "S";
    if (acc >= 0.85) return "A";
    if (acc >= 0.7) return "B";
    return "C";
  }

  return {
    add,
    get score() { return Math.round(score); },
    get combo() { return combo; },
    get maxCombo() { return maxCombo; },
    get counts() { return counts; },
    accuracy, rank, totalNotes,
    isFullCombo() { return counts.miss === 0 && (counts.perfect + counts.good) === totalNotes; },
  };
}
