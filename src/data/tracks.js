// 内置原创曲目 + 场景化谱面编译器
// 曲目以"步进网格"定义(每小节16个16分音符); 音乐床与谱面从同一网格派生 => 卡点100%对齐
// 谱面不再是抽象音符, 而是"动作事件": go(点击) / hold(蓄力) / trap(假动作,别按)
import { freq } from "./notes.js";

const STEPS_PER_BAR = 16;
const BEATS_PER_BAR = 4;

// ============ "霓虹夜航" — 完整 City Pop 单曲(D大调, 100 BPM, 约 2:15) ============
// 以"段落"编排完整歌: 前奏→主歌A→预副歌→副歌→主歌B→副歌2→桥段→终副歌→尾奏
// 每段自带鼓型/和弦走向/主旋律; 副歌复用同一段落数据, 保证记忆点统一。
// 鼓型(每小节 16 步), 复用:
const D_CHILL = { kick: "x.......x.......", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x." }; // 慵懒主歌
const D_DRIVE = { kick: "x...x...x...x..x", snare: "....x.......x...", hat: "xxxxxxxxxxxxxxxx" }; // 推进副歌
const D_PRE   = { kick: "x...x...x...x...", snare: "....x...x...x.x.", hat: "x.x.x.x.x.x.x.x." }; // 预副歌铺垫
const D_BRIDGE= { kick: "x.......x.......", snare: "............x...", hat: "..x...x...x...x." }; // 桥段留白
const D_INTRO = { kick: "x...............", snare: "............x...", hat: "..x...x...x...x." }; // 前奏空灵
const D_OUTRO = { kick: "x...............", snare: "............x...", hat: "x...x...x...x..." }; // 尾奏收束

// 和弦走向(每小节低音根音): 主歌 I-vi-ii-V, 副歌 IV-V-I-vi
const CH_VERSE  = ["D2", "B2", "E2", "A2", "D2", "B2", "G2", "A2"];
const CH_CHORUS = ["G2", "A2", "D2", "B2", "G2", "A2", "D2", "A2"];
const CH_PRE    = ["B2", "A2", "G2", "A2"];
const CH_BRIDGE = ["E2", "A2", "B2", "F#2"];
const CH_INTRO  = ["D2", "A2", "B2", "F#2"];
const CH_OUTRO  = ["G2", "A2", "D2", "D2"];

// 主旋律(段内相对拍, 每小节4拍): 主歌舒缓 / 副歌明亮高走
const LEAD_VERSE = [
  { b: 0, n: "A4", d: 1 }, { b: 1, n: "F#4", d: 1 }, { b: 2, n: "A4", d: 1 }, { b: 3, n: "B4", d: 1 },
  { b: 4, n: "A4", d: 1.5 }, { b: 5.5, n: "F#4", d: 0.5 }, { b: 6, n: "E4", d: 2 },
  { b: 8, n: "B4", d: 1 }, { b: 9, n: "A4", d: 1 }, { b: 10, n: "F#4", d: 1 }, { b: 11, n: "A4", d: 1 },
  { b: 12, n: "B4", d: 1 }, { b: 13, n: "C#5", d: 1 }, { b: 14, n: "D5", d: 2 },
  { b: 16, n: "D5", d: 1 }, { b: 17, n: "A4", d: 1 }, { b: 18, n: "B4", d: 1 }, { b: 19, n: "A4", d: 1 },
  { b: 20, n: "F#4", d: 1.5 }, { b: 21.5, n: "A4", d: 0.5 }, { b: 22, n: "E4", d: 2 },
  { b: 24, n: "F#4", d: 1 }, { b: 25, n: "A4", d: 1 }, { b: 26, n: "B4", d: 1 }, { b: 27, n: "C#5", d: 1 },
  { b: 28, n: "D5", d: 1 }, { b: 29, n: "B4", d: 1 }, { b: 30, n: "A4", d: 2 },
];
const LEAD_CHORUS = [
  { b: 0, n: "D5", d: 1 }, { b: 1, n: "E5", d: 1 }, { b: 2, n: "F#5", d: 1 }, { b: 3, n: "E5", d: 1 },
  { b: 4, n: "D5", d: 1 }, { b: 5, n: "A4", d: 1 }, { b: 6, n: "B4", d: 2 },
  { b: 8, n: "B4", d: 1 }, { b: 9, n: "C#5", d: 1 }, { b: 10, n: "D5", d: 1 }, { b: 11, n: "E5", d: 1 },
  { b: 12, n: "F#5", d: 2 }, { b: 14, n: "E5", d: 1 }, { b: 15, n: "D5", d: 1 },
  { b: 16, n: "E5", d: 1 }, { b: 17, n: "F#5", d: 1 }, { b: 18, n: "G5", d: 1 }, { b: 19, n: "F#5", d: 1 },
  { b: 20, n: "E5", d: 1 }, { b: 21, n: "D5", d: 1 }, { b: 22, n: "B4", d: 2 },
  { b: 24, n: "D5", d: 1 }, { b: 25, n: "E5", d: 1 }, { b: 26, n: "F#5", d: 1 }, { b: 27, n: "A5", d: 1 },
  { b: 28, n: "G5", d: 1 }, { b: 29, n: "F#5", d: 1 }, { b: 30, n: "E5", d: 1 }, { b: 31, n: "D5", d: 1 },
];
const LEAD_PRE = [
  { b: 0, n: "F#4", d: 1 }, { b: 1, n: "G4", d: 1 }, { b: 2, n: "A4", d: 1 }, { b: 3, n: "B4", d: 1 },
  { b: 4, n: "C#5", d: 1 }, { b: 5, n: "D5", d: 1 }, { b: 6, n: "E5", d: 2 },
  { b: 8, n: "E5", d: 1 }, { b: 9, n: "D5", d: 1 }, { b: 10, n: "C#5", d: 1 }, { b: 11, n: "B4", d: 1 },
  { b: 12, n: "A4", d: 1 }, { b: 13, n: "B4", d: 1 }, { b: 14, n: "C#5", d: 1 }, { b: 15, n: "E5", d: 1 },
];
const LEAD_BRIDGE = [
  { b: 0, n: "A4", d: 2 }, { b: 2, n: "G4", d: 2 },
  { b: 4, n: "F#4", d: 2 }, { b: 6, n: "E4", d: 2 },
  { b: 8, n: "D4", d: 1 }, { b: 9, n: "E4", d: 1 }, { b: 10, n: "F#4", d: 2 },
  { b: 12, n: "A4", d: 2 }, { b: 14, n: "B4", d: 2 },
];
const LEAD_INTRO = [
  { b: 0, n: "D5", d: 2 }, { b: 2, n: "F#5", d: 2 },
  { b: 4, n: "A5", d: 1.5 }, { b: 5.5, n: "E5", d: 0.5 }, { b: 6, n: "F#5", d: 2 },
  { b: 8, n: "E5", d: 1 }, { b: 9, n: "D5", d: 1 }, { b: 10, n: "A4", d: 2 },
  { b: 12, n: "B4", d: 2 }, { b: 14, n: "A4", d: 2 },
];
const LEAD_OUTRO = [
  { b: 0, n: "D5", d: 2 }, { b: 2, n: "A4", d: 2 },
  { b: 4, n: "F#4", d: 2 }, { b: 6, n: "D4", d: 2 },
  { b: 8, n: "F#4", d: 4 },
  { b: 12, n: "D4", d: 4 },
];

const CUT_SECTIONS = [
  { name: "intro",   bars: 4, drums: D_INTRO,  chords: CH_INTRO,  lead: LEAD_INTRO,  padGain: 0.9, leadGain: 0.8 },
  { name: "verseA",  bars: 8, drums: D_CHILL,  chords: CH_VERSE,  lead: LEAD_VERSE,  padGain: 0.8 },
  { name: "pre",     bars: 4, drums: D_PRE,    chords: CH_PRE,    lead: LEAD_PRE,    padGain: 0.9 },
  { name: "chorus",  bars: 8, drums: D_DRIVE,  chords: CH_CHORUS, lead: LEAD_CHORUS, padGain: 1.0 },
  { name: "verseB",  bars: 8, drums: D_CHILL,  chords: CH_VERSE,  lead: LEAD_VERSE,  padGain: 0.8 },
  { name: "chorus2", bars: 8, drums: D_DRIVE,  chords: CH_CHORUS, lead: LEAD_CHORUS, padGain: 1.0 },
  { name: "bridge",  bars: 4, drums: D_BRIDGE, chords: CH_BRIDGE, lead: LEAD_BRIDGE, padGain: 1.0, leadGain: 0.85 },
  { name: "final",   bars: 8, drums: D_DRIVE,  chords: CH_CHORUS, lead: LEAD_CHORUS, padGain: 1.0 },
  { name: "outro",   bars: 4, drums: D_OUTRO,  chords: CH_OUTRO,  lead: LEAD_OUTRO,  padGain: 0.85, leadGain: 0.8 },
];

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
    genre: "City Pop", bpm: 100, songName: "霓虹夜航", items: true,
    scene: "cut", sceneName: "全屏切击", verb: "音符抛物线飞出, 滑动屏幕划过即可切开",
    sections: CUT_SECTIONS,
  },
];

// ---- 编译: track -> { music事件, charts(三档 events), duration } ----
export function compileTrack(track) {
  const beatDur = 60 / track.bpm;
  const stepDur = beatDur / 4;

  const music = [];
  const kickTimes = [];
  const snareTimes = [];
  const leadOnsets = []; // {time, freq, dBeats}
  const ctx = { music, kickTimes, snareTimes, leadOnsets, beatDur, stepDur };

  const duration = track.sections
    ? buildSectioned(track, ctx)
    : buildLooped(track, ctx);

  music.sort((a, b) => a.t - b.t);

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

  // 隐藏道具方块: 炸弹(扣分)/加速(加分)/冰冻(暂停下落), 均匀点缀在中段
  if (track.items) { sprinkleItems(easy, duration); sprinkleItems(normal, duration); sprinkleItems(hard, duration); }

  return {
    music, duration,
    charts: { easy, normal, hard },
    meta: { bpm: track.bpm, beatDur, scene: track.scene },
  };
}

// 段落编排: 逐段逐小节铺鼓/贝斯/pad/主旋律 => 返回总时长(秒)
function buildSectioned(track, { music, kickTimes, snareTimes, leadOnsets, beatDur, stepDur }) {
  let barCursor = 0;
  for (const sec of track.sections) {
    const secStart = barCursor * BEATS_PER_BAR * beatDur;
    for (let bar = 0; bar < sec.bars; bar++) {
      const barStart = (barCursor + bar) * BEATS_PER_BAR * beatDur;
      const root = sec.chords[bar % sec.chords.length];
      const rootFreq = freq(root);
      for (let s = 0; s < STEPS_PER_BAR; s++) {
        const t = barStart + s * stepDur;
        if (sec.drums.kick[s] === "x") {
          music.push({ t, voice: "kick", g: 1.0 });
          kickTimes.push(t);
          music.push({ t, voice: "bass", freq: rootFreq, dur: 0.2, g: 1.0 });
        }
        if (sec.drums.snare[s] === "x") { music.push({ t, voice: "snare", g: 0.9 }); snareTimes.push(t); }
        if (sec.drums.hat[s] === "x") music.push({ t, voice: "hat", g: 0.8, open: false });
      }
      if (sec.pad !== false) {
        // 开放和声: 高八度 root + 五度(2^{7/12}) + 八度, 持续整小节
        const base = rootFreq * 2;
        const padFreqs = [base, base * 1.498307, base * 2];
        music.push({ t: barStart, voice: "pad", freqs: padFreqs, dur: BEATS_PER_BAR * beatDur * 0.98, g: sec.padGain ?? 1 });
      }
    }
    if (sec.lead) for (const nt of sec.lead) {
      const t = secStart + nt.b * beatDur;
      const dur = nt.d * beatDur * 0.95;
      music.push({ t, voice: "lead", freq: freq(nt.n), dur, g: sec.leadGain ?? 1 });
      leadOnsets.push({ time: t, freq: freq(nt.n), dBeats: nt.d });
    }
    barCursor += sec.bars;
  }
  return barCursor * BEATS_PER_BAR * beatDur;
}

// 旧式单段落循环编排(jump/workshop 仍用) => 返回总时长(秒)
function buildLooped(track, { music, kickTimes, snareTimes, leadOnsets, beatDur, stepDur }) {
  const loopDur = track.bars * BEATS_PER_BAR * beatDur;
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
        if (track.drums.snare[s] === "x") { music.push({ t, voice: "snare", g: 0.9 }); snareTimes.push(t); }
        if (track.drums.hat[s] === "x") music.push({ t, voice: "hat", g: 0.8, open: false });
      }
    }
    for (const nt of track.lead) {
      const t = loopStart + nt.b * beatDur;
      const dur = nt.d * beatDur * 0.95;
      music.push({ t, voice: "lead", freq: freq(nt.n), dur, g: 1.0 });
      leadOnsets.push({ time: t, freq: freq(nt.n), dBeats: nt.d });
    }
  }
  return track.loops * loopDur;
}

// 在谱面中段点缀隐藏道具: 只标记 go 动作, 避开开头/结尾, 加权序列(加分多、炸弹少)
// 导出供自选/花海等自动谱面复用
export function sprinkleItems(events, duration) {
  const lo = duration * 0.11, hi = duration * 0.93;
  const seq = ["bonus", "freeze", "bonus", "bomb", "bonus", "freeze", "bomb", "bonus"];
  let k = 0;
  events.forEach((e, i) => {
    if (e.action !== "go") return;
    if (e.time < lo || e.time > hi) return;
    if (i % 10 === 5) { e.item = seq[k % seq.length]; k++; }
  });
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
