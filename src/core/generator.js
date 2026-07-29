// 自动谱面生成器(亮点, 定位"能用但不完美")
// 基于能量包络的 onset 检测: 分帧算能量 -> 相对局部均值的突增峰值即节拍点
// 不追求完美, 够展示"任意歌自动出谱"
const FRAME = 1024, HOP = 512;

const PRESET = {
  easy:   { minGap: 0.46, sens: 1.7 },
  normal: { minGap: 0.30, sens: 1.45 },
  hard:   { minGap: 0.19, sens: 1.28 },
};

export function generateBeatmap(audioBuffer, difficulty = "normal") {
  const { minGap, sens } = PRESET[difficulty] || PRESET.normal;
  const sr = audioBuffer.sampleRate;

  // 混合为单声道
  const ch = audioBuffer.numberOfChannels;
  const len = audioBuffer.length;
  const mono = new Float32Array(len);
  for (let c = 0; c < ch; c++) {
    const d = audioBuffer.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += d[i] / ch;
  }

  // 每帧能量
  const frames = Math.floor((len - FRAME) / HOP);
  const energy = new Float32Array(Math.max(0, frames));
  for (let f = 0; f < frames; f++) {
    let e = 0;
    const off = f * HOP;
    for (let i = 0; i < FRAME; i++) { const s = mono[off + i]; e += s * s; }
    energy[f] = e / FRAME;
  }

  // 局部均值(约0.5s窗口)平滑基线
  const win = Math.max(4, Math.round((0.5 * sr) / HOP));
  const notes = [];
  let lastT = -Infinity;
  for (let f = 1; f < frames - 1; f++) {
    let avg = 0, cnt = 0;
    for (let k = f - win; k <= f + win; k++) { if (k >= 0 && k < frames) { avg += energy[k]; cnt++; } }
    avg /= cnt;
    const isPeak = energy[f] > energy[f - 1] && energy[f] >= energy[f + 1];
    if (isPeak && energy[f] > avg * sens && avg > 1e-6) {
      const t = (f * HOP) / sr;
      if (t - lastT >= minGap) {
        notes.push({ time: Math.round(t * 1000) / 1000, action: "go" });
        lastT = t;
      }
    }
  }
  // 保底: 若检测太稀(如纯人声/安静), 补一个固定拍以免空谱
  if (notes.length < 8) {
    const step = 0.6;
    for (let t = 1; t < audioBuffer.duration - 1; t += step) {
      notes.push({ time: Math.round(t * 1000) / 1000, action: "go" });
    }
    notes.sort((a, b) => a.time - b.time);
  }
  // HARD 追加少量陷阱假动作
  if (difficulty === "hard" && notes.length > 12) {
    for (let i = 6; i < notes.length - 2; i += 7) {
      const mid = (notes[i].time + notes[i + 1].time) / 2;
      if (notes[i + 1].time - notes[i].time > 0.5) notes.push({ time: Math.round(mid * 1000) / 1000, action: "trap" });
    }
    notes.sort((a, b) => a.time - b.time);
  }
  return notes;
}
