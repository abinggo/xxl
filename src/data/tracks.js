// 内置原创曲目 + 谱面编译器
// 曲目以"步进网格"定义(每小节16个16分音符); 音乐床与谱面从同一网格派生 => 卡点100%对齐
import { freq } from "./notes.js";

const STEPS_PER_BAR = 16;
const BEATS_PER_BAR = 4;

// ---- 曲目定义 ----
// drums: 每小节循环的 16 位模式("x"=击, "."=空); chords: 每小节根音(循环)
// lead: 一个乐句(loop)内的旋律 [{b:起始拍, n:音名, d:时值拍}]
export const TRACKS = [
  {
    id: "neon", name: "霓虹脉冲", artist: "TME Synth", ip: "penguin",
    emoji: "🐧", colorA: "#22e1ff", colorB: "#9a6bff",
    genre: "Future Bass", bpm: 128, bars: 4, loops: 3,
    drums: {
      kick:  "x...x...x...x...",
      snare: "....x.......x...",
      hat:   "..x...x...x...x.",
    },
    chords: ["A2", "F2", "C3", "E2"],
    lead: [
      { b: 0, n: "E5", d: 0.5 }, { b: 0.5, n: "D5", d: 0.5 }, { b: 1, n: "C5", d: 1 }, { b: 2, n: "A4", d: 1 }, { b: 3, n: "C5", d: 1 },
      { b: 4, n: "D5", d: 1 }, { b: 5, n: "C5", d: 1 }, { b: 6, n: "A4", d: 2 },
      { b: 8, n: "E5", d: 0.5 }, { b: 8.5, n: "G5", d: 0.5 }, { b: 9, n: "E5", d: 1 }, { b: 10, n: "D5", d: 1 }, { b: 11, n: "C5", d: 1 },
      { b: 12, n: "A4", d: 1 }, { b: 13, n: "C5", d: 1 }, { b: 14, n: "D5", d: 2 },
    ],
  },
  {
    id: "midnight", name: "午夜留声", artist: "TME Synth", ip: "redbird",
    emoji: "🎙️", colorA: "#ff8a5c", colorB: "#ff3d9a",
    genre: "City Pop", bpm: 94, bars: 4, loops: 3,
    drums: {
      kick:  "x.......x.......",
      snare: "....x.......x...",
      hat:   "x.x.x.x.x.x.x.x.",
    },
    chords: ["D2", "A2", "B2", "F#2"],
    lead: [
      { b: 0, n: "F#4", d: 1 }, { b: 1, n: "A4", d: 1 }, { b: 2, n: "B4", d: 1.5 }, { b: 3.5, n: "A4", d: 0.5 },
      { b: 4, n: "C#5", d: 1 }, { b: 5, n: "B4", d: 1 }, { b: 6, n: "A4", d: 2 },
      { b: 8, n: "E5", d: 1 }, { b: 9, n: "C#5", d: 1 }, { b: 10, n: "B4", d: 1.5 }, { b: 11.5, n: "A4", d: 0.5 },
      { b: 12, n: "F#4", d: 1 }, { b: 13, n: "A4", d: 1 }, { b: 14, n: "F#4", d: 2 },
    ],
  },
  {
    id: "cyber", name: "赛博狂潮", artist: "TME Synth", ip: "bluedog",
    emoji: "🐶", colorA: "#4dff9e", colorB: "#22e1ff",
    genre: "Hard EDM", bpm: 150, bars: 4, loops: 3,
    drums: {
      kick:  "x..x..x.x..x..x.",
      snare: "....x.......x...",
      hat:   "xxxxxxxxxxxxxxxx",
    },
    chords: ["E2", "E2", "C2", "D2"],
    lead: [
      { b: 0, n: "E5", d: 0.5 }, { b: 0.5, n: "B4", d: 0.5 }, { b: 1, n: "E5", d: 0.5 }, { b: 1.5, n: "G5", d: 0.5 }, { b: 2, n: "E5", d: 0.5 }, { b: 2.5, n: "D5", d: 0.5 }, { b: 3, n: "B4", d: 1 },
      { b: 4, n: "A4", d: 0.5 }, { b: 4.5, n: "E5", d: 0.5 }, { b: 5, n: "A4", d: 0.5 }, { b: 5.5, n: "B4", d: 0.5 }, { b: 6, n: "D5", d: 1 }, { b: 7, n: "B4", d: 1 },
      { b: 8, n: "G5", d: 0.5 }, { b: 8.5, n: "E5", d: 0.5 }, { b: 9, n: "D5", d: 0.5 }, { b: 9.5, n: "E5", d: 0.5 }, { b: 10, n: "G5", d: 1 }, { b: 11, n: "A5", d: 1 },
      { b: 12, n: "B5", d: 0.5 }, { b: 12.5, n: "A5", d: 0.5 }, { b: 13, n: "G5", d: 0.5 }, { b: 13.5, n: "E5", d: 0.5 }, { b: 14, n: "D5", d: 1 }, { b: 15, n: "E5", d: 1 },
    ],
  },
];

// ---- 编译: track -> { music事件, beatmaps, duration } ----
export function compileTrack(track) {
  const beatDur = 60 / track.bpm;
  const stepDur = beatDur / 4;
  const loopBeats = track.bars * BEATS_PER_BAR;
  const loopDur = loopBeats * beatDur;

  const music = [];
  const kickTimes = [];   // 每次 kick 的绝对时间
  const snareTimes = [];
  const leadOnsets = [];  // {time, freq, dBeats}

  for (let L = 0; L < track.loops; L++) {
    const loopStart = L * loopDur;
    // 鼓 + 贝斯(逐小节循环鼓型)
    for (let bar = 0; bar < track.bars; bar++) {
      const barStart = loopStart + bar * BEATS_PER_BAR * beatDur;
      const root = track.chords[bar % track.chords.length];
      for (let s = 0; s < STEPS_PER_BAR; s++) {
        const t = barStart + s * stepDur;
        if (track.drums.kick[s] === "x") {
          music.push({ t, voice: "kick", g: 1.0 });
          kickTimes.push(t);
          music.push({ t, voice: "bass", freq: freq(root), dur: 0.18, g: 1.0 });
        }
        if (track.drums.snare[s] === "x") {
          music.push({ t, voice: "snare", g: 0.9 });
          snareTimes.push(t);
        }
        if (track.drums.hat[s] === "x") {
          music.push({ t, voice: "hat", g: 0.8, open: false });
        }
      }
    }
    // 旋律(逐 loop)
    for (const nt of track.lead) {
      const t = loopStart + nt.b * beatDur;
      const dur = nt.d * beatDur * 0.95;
      music.push({ t, voice: "lead", freq: freq(nt.n), dur, g: 1.0 });
      leadOnsets.push({ time: t, freq: freq(nt.n), dBeats: nt.d });
    }
  }
  music.sort((a, b) => a.t - b.t);

  const duration = track.loops * loopDur;

  // ---- 谱面派生 ----
  // easy: 只取每拍上的 kick(下拍), 稀疏
  // normal: 全部 kick + snare 骨架
  // hard: kick/snare + 旋律音, 更密更切分, 长音变 Hold
  const easy = buildMap(dedupe(kickTimes.filter((t) => isOnBeat(t, beatDur))), null, beatDur);
  const normal = buildMap(dedupe([...kickTimes, ...snareTimes]), null, beatDur);
  const hard = buildMap(
    dedupe([...kickTimes, ...snareTimes, ...leadOnsets.map((o) => o.time)]),
    leadOnsets, beatDur
  );

  return {
    music, duration,
    beatmaps: { easy, normal, hard },
    meta: { bpm: track.bpm, beatDur },
  };
}

function isOnBeat(t, beatDur) {
  const r = (t / beatDur) % 1;
  return r < 0.02 || r > 0.98;
}

function dedupe(times) {
  const s = [...times].sort((a, b) => a - b);
  const out = [];
  for (const t of s) {
    if (!out.length || t - out[out.length - 1] > 0.06) out.push(t);
  }
  return out;
}

// 由时间点构造音符; lane 交替, 若提供 leadOnsets 则按音高走向分配 lane + 长音转 Hold
function buildMap(times, leadOnsets, beatDur) {
  const notes = [];
  let lane = 0;
  const leadByTime = new Map();
  if (leadOnsets) for (const o of leadOnsets) leadByTime.set(round(o.time), o);

  let prevFreq = null;
  for (const t of times) {
    const lo = leadByTime.get(round(t));
    let type = "tap", dur;
    if (lo) {
      // 按音高走向决定 lane: 升高->右(1), 降低->左(0)
      if (prevFreq != null) lane = lo.freq >= prevFreq ? 1 : 0;
      prevFreq = lo.freq;
      if (lo.dBeats >= 1.5) { type = "hold"; dur = lo.dBeats * beatDur * 0.9; }
    } else {
      lane = lane ^ 1; // 交替
    }
    notes.push(dur != null ? { time: round(t), type, dur, lane } : { time: round(t), type, lane });
  }
  notes.sort((a, b) => a.time - b.time);
  return notes;
}

function round(x) { return Math.round(x * 1000) / 1000; }
