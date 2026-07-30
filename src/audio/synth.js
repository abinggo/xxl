// 合成音乐引擎: 用振荡器/噪声合成鼓、贝斯、旋律
// 采用 Web Audio "前瞻调度" (A Tale of Two Clocks): 每 25ms 预排未来 150ms 的事件,
// 所有 osc.start(when) 用 AudioContext 精确时间 => 采样级精准, 与谱面同源 => 卡点 100% 准
import { getAudio } from "./context.js?v=1785382353";

const LOOKAHEAD = 0.15;   // 预排窗口(秒)
const TICK = 25;          // 调度器轮询(ms)

// ---------- 单音色 ----------
// 噪声 buffer 缓存: 原来每次 snare/hat 都新建数组并逐采样填随机, 踩镲极密 => 主线程 GC 抖动 => 掉帧卡顿。
// 噪声内容听感上无差别, 按时长缓存复用(buffer 不可变, 可被多个 source 共享), 每敲一下降为一次查表。
const _noiseCache = new Map();
function noiseBuffer(ctx, dur = 0.3) {
  const key = Math.round(dur * 1000);
  let buf = _noiseCache.get(key);
  if (buf) return buf;
  const len = Math.floor(ctx.sampleRate * dur);
  buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  _noiseCache.set(key, buf);
  return buf;
}

function kick(ctx, dest, t, gain = 1) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(1.0 * gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + 0.34);
}

function snare(ctx, dest, t, gain = 1) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 0.2);
  const bp = ctx.createBiquadFilter();
  bp.type = "highpass"; bp.frequency.value = 1400;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.7 * gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  // 加一点音调体
  const o = ctx.createOscillator();
  o.type = "triangle"; o.frequency.value = 180;
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.3 * gain, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(bp); bp.connect(g); g.connect(dest);
  o.connect(og); og.connect(dest);
  src.start(t); src.stop(t + 0.2);
  o.start(t); o.stop(t + 0.14);
}

function hat(ctx, dest, t, gain = 1, open = false) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, open ? 0.25 : 0.06);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = 7000;
  const g = ctx.createGain();
  const dur = open ? 0.22 : 0.05;
  g.gain.setValueAtTime(0.28 * gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(hp); hp.connect(g); g.connect(dest);
  src.start(t); src.stop(t + dur + 0.02);
}

function bass(ctx, dest, t, freq, dur, gain = 1) {
  const o = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const lp = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = "sawtooth"; o2.type = "square";
  o.frequency.value = freq; o2.frequency.value = freq / 2;
  lp.type = "lowpass"; lp.frequency.value = 520; lp.Q.value = 6;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5 * gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(dest);
  o.start(t); o2.start(t); o.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
}

function lead(ctx, dest, t, freq, dur, gain = 1) {
  const o = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "triangle"; o2.type = "sawtooth";
  o.frequency.value = freq; o2.frequency.value = freq;
  o2.detune.value = 8;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.28 * gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); o2.connect(g); g.connect(dest);
  o.start(t); o2.start(t); o.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
}

// 铺底和声(pad): 一小节一个和弦, 双失谐锯齿叠 root/五度/八度, 低通柔化, 慢起慢落 => 空间感
function pad(ctx, dest, t, freqs, dur, gain = 1) {
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 1900; lp.Q.value = 0.5;
  const atk = Math.min(0.45, dur * 0.3), rel = Math.min(0.6, dur * 0.4);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12 * gain, t + atk);
  g.gain.setValueAtTime(0.12 * gain, t + Math.max(atk, dur - rel));
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  for (const f of freqs) {
    for (const det of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    }
  }
  lp.connect(g); g.connect(dest);
}

// 打击命中音效(玩家操作反馈, 独立于音乐床)
export function playHitSfx(judgement) {
  const { ctx, master } = getAudio();
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  const base = judgement === "perfect" ? 1400 : judgement === "good" ? 900 : 260;
  o.frequency.setValueAtTime(base, t);
  o.frequency.exponentialRampToValueAtTime(base * (judgement === "miss" ? 0.5 : 1.6), t + 0.08);
  g.gain.setValueAtTime(judgement === "miss" ? 0.18 : 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + 0.14);
}

// ---------- 音乐床调度器 ----------
// events: [{t(songTime秒), voice, ...params}] 已按 t 排序
export function createMusicPlayer(events, { onEnd } = {}) {
  const { ctx, master } = getAudio();
  let startTime = 0;
  let idx = 0;
  let timer = null;
  let endTime = 0;
  let stopped = false;

  function schedule() {
    if (stopped) return;
    const now = ctx.currentTime;
    while (idx < events.length && startTime + events[idx].t < now + LOOKAHEAD) {
      const e = events[idx++];
      const when = startTime + e.t;
      switch (e.voice) {
        case "kick": kick(ctx, master, when, e.g); break;
        case "snare": snare(ctx, master, when, e.g); break;
        case "hat": hat(ctx, master, when, e.g, e.open); break;
        case "bass": bass(ctx, master, when, e.freq, e.dur, e.g); break;
        case "lead": lead(ctx, master, when, e.freq, e.dur, e.g); break;
        case "pad": pad(ctx, master, when, e.freqs, e.dur, e.g); break;
      }
    }
    if (idx >= events.length && now > endTime) {
      stop();
      if (onEnd) onEnd();
      return;
    }
    timer = setTimeout(schedule, TICK);
  }

  function start(at) {
    startTime = at;
    endTime = at + (events.length ? events[events.length - 1].t : 0) + 1.5;
    schedule();
  }
  function stop() {
    stopped = true;
    if (timer) clearTimeout(timer);
  }
  function getStartTime() { return startTime; }

  return { start, stop, getStartTime };
}
