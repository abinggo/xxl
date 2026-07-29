// 内置原创曲目 + 场景化谱面编译器
// 曲目以"步进网格"定义(每小节16个16分音符); 音乐床与谱面从同一网格派生 => 卡点100%对齐
// 谱面不再是抽象音符, 而是"动作事件": go(点击) / hold(蓄力) / trap(假动作,别按)
import { freq } from "./notes.js";

const STEPS_PER_BAR = 16;
const BEATS_PER_BAR = 4;

// ---- 曲目定义 ----
export const TRACKS = [
  {
    id: "jump", name: "音符跳跃", artist: "全民K歌", ip: "redbird",
    emoji: "🐦", colorA: "#ff5c5c", colorB: "#ffd84d",
    genre: "Future Bass", bpm: 120, bars: 4, loops: 3,
    scene: "jump", sceneName: "单键上跳", verb: "点击卡拍, 沿霓虹音符盘往上跳",
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
    id: "workshop", name: "敲击工坊", artist: "酷狗音乐", ip: "bluedog",
    emoji: "🐶", colorA: "#3d9aff", colorB: "#4dff9e",
    genre: "Hard EDM", bpm: 150, bars: 4, loops: 3,
    scene: "workshop", sceneName: "多轨敲钉", verb: "钉子落到判定线, 按对应键一锤夯平",
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
  {
    id: "cut", name: "节拍切击", artist: "QQ音乐", ip: "penguin",
    emoji: "🐧", colorA: "#2fd0ff", colorB: "#9a6bff",
    genre: "City Pop", bpm: 94, bars: 4, loops: 3,
    scene: "cut", sceneName: "全屏切击", verb: "音符抛物线飞出, 滑动屏幕划过即可切开",
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
];

// ---- 编译: track -> { music事件, charts(三档 events), duration } ----
export function compileTrack(track) {
  const beatDur = 60 / track.bpm;
  const stepDur = beatDur / 4;
  const loopBeats = track.bars * BEATS_PER_BAR;
  const loopDur = loopBeats * beatDur;

  const music = [];
  const kickTimes = [];
  const snareTimes = [];
  const leadOnsets = []; // {time, freq, dBeats}

  for (let L = 0; L < track.loops; L++) {
    const loopStart = L * loopDur;
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
    for (const nt of track.lead) {
      const t = loopStart + nt.b * beatDur;
      const dur = nt.d * beatDur * 0.95;
      music.push({ t, voice: "lead", freq: freq(nt.n), dur, g: 1.0 });
      leadOnsets.push({ time: t, freq: freq(nt.n), dBeats: nt.d });
    }
  }
  music.sort((a, b) => a.t - b.t);
  const duration = track.loops * loopDur;

  // ---- 谱面派生: 三档难度考不同能力 ----
  const holdMap = new Map(); // time(round) -> dur(秒), 长音变蓄力
  for (const o of leadOnsets) if (o.dBeats >= 1.5) holdMap.set(round(o.time), o.dBeats * beatDur * 0.9);

  // EASY 跟拍: 每个正拍一个 go, 稳定, 无陷阱
  const beats = [];
  for (let t = 0; t < duration - 0.05; t += beatDur) beats.push(round(t));
  const easy = buildEvents(beats, null, { beatDur, duration, traps: 0 });

  // NORMAL 卡点: kick+snare 骨架(含切分与休止) + 少量 hold
  const normalTimes = dedupe([...kickTimes, ...snareTimes, ...holdMap.keys()]);
  const normal = buildEvents(normalTimes, holdMap, { beatDur, duration, traps: 0 });

  // HARD 炫技: kick+snare+旋律 密集切分 + hold + 陷阱假动作
  const hardTimes = dedupe([...kickTimes, ...snareTimes, ...leadOnsets.map((o) => o.time)]);
  const hard = buildEvents(hardTimes, holdMap, { beatDur, duration, traps: 1 });

  return {
    music, duration,
    charts: { easy, normal, hard },
    meta: { bpm: track.bpm, beatDur, scene: track.scene },
  };
}

// 由时间点集合构造动作事件; holdMap 命中则为 hold; traps>0 时在空档插入陷阱
function buildEvents(times, holdMap, { beatDur, duration, traps }) {
  const evs = times
    .filter((t) => t >= beatDur * 0.5 && t <= duration - beatDur * 0.5)
    .map((t) => {
      const h = holdMap && holdMap.get(round(t));
      return h ? { time: round(t), action: "hold", dur: h } : { time: round(t), action: "go" };
    });

  if (traps > 0) {
    const occ = evs.map((e) => e.time);
    const free = (tt) => !occ.some((o) => Math.abs(o - tt) < beatDur * 0.45);
    // 从后半段起, 每约 2 拍尝试在 offbeat 放一个陷阱, 控制密度
    let toggle = 0;
    for (let t = duration * 0.35; t < duration - beatDur; t += beatDur * 2) {
      const tt = round(t + beatDur * 0.5); // offbeat 更迷惑
      if (free(tt)) {
        if (toggle % 2 === 0) { evs.push({ time: tt, action: "trap" }); occ.push(tt); }
        toggle++;
      }
    }
  }

  evs.sort((a, b) => a.time - b.time);
  return evs;
}

function dedupe(iterable) {
  const s = [...iterable].map(round).sort((a, b) => a - b);
  const out = [];
  for (const t of s) if (!out.length || t - out[out.length - 1] > 0.06) out.push(t);
  return out;
}

function round(x) { return Math.round(x * 1000) / 1000; }
