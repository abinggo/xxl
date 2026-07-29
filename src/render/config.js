// 场景化玩法/渲染 共享常量
export const COLORS = {
  perfect: "#ffd84d",
  good: "#22e1ff",
  miss: "#ff5b8a",
  trap: "#ff4d4d",
  text: "#f3f0ff",
  cyan: "#22e1ff",
  magenta: "#ff3d9a",
  gold: "#ffd84d",
  violet: "#9a6bff",
  ink: "#20143a",
};

// 物体从进场到抵达"动作点"的时长(秒)由 beatDur 推导, 这里给夹取范围
export const APPROACH_MIN = 0.62;
export const APPROACH_MAX = 1.15;
export const APPROACH_BEATS = 2; // 提前 2 拍进场

export function approachTime(beatDur) {
  return Math.max(APPROACH_MIN, Math.min(APPROACH_MAX, beatDur * APPROACH_BEATS));
}
