// 入口与屏幕路由: 标题(单入口) -> 关卡地图 -> 场景闯关 -> 结算
import { getAudio, unlockAudio } from "./audio/context.js";
import { TRACKS, compileTrack, sprinkleItems } from "./data/tracks.js";
import { getIP, loadIPSprites } from "./data/ip.js";
import { recordClear, getProgress, WORLDS } from "./data/levels.js";
import { createGame } from "./core/engine.js";
import { renderHome } from "./ui/levelselect.js";
import { renderResult } from "./ui/result.js";
import { generateBeatmap } from "./core/generator.js";
import { createMusicPlayer } from "./audio/synth.js";
import { createBufferPlayer } from "./audio/decoded.js";

loadIPSprites(); // 后台预载 IP 贴图(有则用, 无则回退矢量)

const canvas = document.getElementById("gameCanvas");
const screens = document.getElementById("screens");
let game = null;
let inputBound = false;
let currentSong = null;                 // 当前选中的曲目(用于"再来一次"重开同一首)
let currentTheme = "neon";              // 当前视觉主题(与歌曲解耦: 任意歌可配任意主题)

// ---------- 曲库(纯音乐来源) ----------
// 主题(视觉)与歌曲(音频)彻底解耦: 首页可任选一首歌 + 任选一套主题皮肤组合进场。
const SONGS = [
  { id: "neon", name: "霓虹夜航", genre: "City Pop", cover: "./assets/bg/cover.png", kind: "synth" },
  { id: "huahai", name: "花海主题", genre: "Sakura Pop", cover: "./assets/bg/huahai_cover.png",
    kind: "mp3", url: "./assets/audio/huahai.mp3" },
];

// ---------- 主题皮肤(视觉/配色/切割物, 不绑定具体歌曲) ----------
const THEMES = {
  neon:   { colorA: "#7b3cff", colorB: "#22e1ff", emoji: "💎", scene: "切水晶" },
  flower: { colorA: "#ff6fb5", colorB: "#c86bff", emoji: "🌸", scene: "切花" },
};
// 把主题皮肤套到 song 元数据上(只改配色/场景名/图标等表现层, 不动音频与谱面)
function applyTheme(song, theme) {
  const th = THEMES[theme] || THEMES.neon;
  return {
    ...song,
    ip: { ...(song.ip || {}), color: th.colorA, accent: th.colorB },
    colorA: th.colorA, colorB: th.colorB, emoji: th.emoji, sceneName: th.scene,
  };
}

function tickClock() {
  const d = new Date();
  document.getElementById("statusTime").textContent =
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
tickClock(); setInterval(tickClock, 15000);

function clearScreens() { screens.innerHTML = ""; }
function showCanvas(show) { canvas.classList.toggle("hidden", !show); }

function loading(text) {
  clearScreens();
  const el = document.createElement("div");
  el.className = "loading";
  el.innerHTML = `<div class="spinner"></div><div class="loading__txt">${text}</div>`;
  screens.appendChild(el);
}

// ---------- 标题页(唯一入口: 单游戏"节拍切击") ----------
function goHome() {
  if (game) { game.destroy(); game = null; }
  showCanvas(false);
  clearScreens();
  renderHome(screens, {
    songs: SONGS,
    theme: currentTheme,
    onStart: ({ song, theme }) => playSelected(song, theme),
    onThemeChange: (theme) => { currentTheme = theme; },
    onCustom: (file, theme) => startCustom(file, theme),
  });
}

// 选定"歌曲 + 主题"组合进场(合成曲走内置谱面, mp3/自选 走自动生成谱面)
function playSelected(song, theme) {
  currentSong = song;
  currentTheme = theme || currentTheme;
  if (song.kind === "synth") startSynthSong(currentTheme);
  else if (song._buf) launchBuffer(song._buf, song, currentTheme);   // 已解码(自选/重开): 直接复用
  else startMp3Song(song, currentTheme);
}

// ---------- 内置合成曲(霓虹夜航) + 任选主题皮肤 ----------
async function startSynthSong(theme) {
  const cutWorld = WORLDS.find((w) => w.track.id === "cut");
  const level = cutWorld.levels.find((l) => l.diff === "normal") || cutWorld.levels[0];
  loading(`载入 ${level.label}…`);
  await unlockAudio();
  const track = level.track;
  const compiled = compileTrack(track);
  const best = getProgress()[level.id]?.best || 0;
  let song = { id: track.id, name: "霓虹夜航", artist: track.artist, genre: track.genre,
    ip: getIP(track.ip), difficulty: "normal", emoji: track.emoji,
    levelId: level.id, levelLabel: level.label, best };
  song = applyTheme(song, theme);
  const player = createMusicPlayer(compiled.music);
  launch(song, player, compiled.charts.normal, compiled.duration, { ...compiled.meta, theme });
}

// ---------- mp3 BGM(如花海): 拉流 -> 解码 -> 缓存到 currentSong._buf 复用 ----------
async function startMp3Song(s, theme) {
  loading(`载入 ${s.name}…`);
  await unlockAudio();
  const { ctx } = getAudio();
  const resp = await fetch(s.url);
  const audioBuf = await ctx.decodeAudioData(await resp.arrayBuffer());
  currentSong = { ...s, _buf: audioBuf };            // 缓存解码结果, 供"再来一次"秒开
  launchBuffer(audioBuf, s, theme);
}

// ---------- 自选本地音乐 ----------
async function startCustom(file, theme = currentTheme) {
  loading("分析音乐、自动生成谱面…");
  await unlockAudio();
  const { ctx } = getAudio();
  const audioBuf = await ctx.decodeAudioData(await file.arrayBuffer());
  const info = { id: "custom", name: file.name.replace(/\.[^.]+$/, ""), genre: "AUTO", custom: true };
  currentSong = { ...info, _buf: audioBuf };
  currentTheme = theme;
  launchBuffer(audioBuf, info, theme);
}

// ---------- 从已解码的 AudioBuffer 起一局(mp3/自选/重开 共用) ----------
function launchBuffer(audioBuf, info, theme) {
  const events = generateBeatmap(audioBuf, "normal");
  sprinkleItems(events, audioBuf.duration);          // 隐藏道具(障碍/加分/冰冻)
  const player = createBufferPlayer(audioBuf);
  let song = { id: info.id, name: info.name, artist: info.custom ? "自选音乐" : (info.genre || "BGM"),
    genre: info.genre, ip: { name: "企鹅", emoji: "🐧" }, difficulty: "normal",
    custom: info.custom, levelLabel: info.name };
  song = applyTheme(song, theme);
  launch(song, player, events, audioBuf.duration, { bpm: 120, beatDur: 0.5, scene: "cut", theme });
}

// ---------- 启动一局 ----------
function launch(song, player, events, duration, meta) {
  clearScreens();
  showCanvas(true);
  game = createGame(canvas, {
    song, player, events, duration, meta,
    onComplete: (result) => showResult(result),
  });
  window.__game = game;
  if (new URLSearchParams(location.search).get("auto") === "1") game.setAutoplay(true);
  bindInput();
  game.start();
}

// ---------- 结算 ----------
function showResult(result) {
  showCanvas(false);
  clearScreens();
  // 记录通关星级 + 解锁下一小关
  if (result.song.levelId) recordClear(result.song.levelId, result.rank, result.score);
  renderResult(screens, result, {
    onRetry: () => {
      if (currentSong) { playSelected(currentSong, currentTheme); return; }  // 重开当前"歌+主题"组合
      goHome();
    },
    onHome: () => goHome(),
  });
}

// ---------- 输入: 路由到引擎的 key / pointer (单键跳 / 多轨敲 / 滑动切) ----------
const KEYS = new Set([" ", "f", "j", "F", "J", "d", "k", "D", "K",
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);
function xy(e) {
  const r = canvas.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}
function bindInput() {
  if (inputBound) return;
  inputBound = true;
  window.addEventListener("keydown", (e) => {
    if (!game || e.repeat) return;
    if (KEYS.has(e.key)) { game.key(e.key); e.preventDefault(); }
    // 自动演示仅通过 ?auto=1 开启, 不再绑定按键, 避免误触失去参与感
  });
  // 划过即切: 无需按住, 鼠标/触控板划过 or 触屏拖动经过音符就切割(水果忍者手感)
  canvas.addEventListener("pointerdown", (e) => {
    if (!game) return;
    const [x, y] = xy(e); game.pointer("down", x, y); e.preventDefault();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!game) return;
    // 合并高频中间点: 快速滑动时补齐两帧之间的轨迹, 不漏切、更顺滑
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    if (evs && evs.length) { for (const ev of evs) { const [x, y] = xy(ev); game.pointer("move", x, y); } }
    else { const [x, y] = xy(e); game.pointer("move", x, y); }
  });
  const up = (e) => {
    if (!game) return;
    const [x, y] = xy(e); game.pointer("up", x, y);
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("pointerleave", up);   // 离开画布重置, 回来时不会拉出一整条长切线
}

window.addEventListener("resize", () => { if (game) game.resize(); });

goHome();
