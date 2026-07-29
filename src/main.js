// 入口与屏幕路由: 标题(单入口) -> 关卡地图 -> 场景闯关 -> 结算
import { getAudio, unlockAudio } from "./audio/context.js";
import { TRACKS, compileTrack } from "./data/tracks.js";
import { getIP, loadIPSprites } from "./data/ip.js";
import { findLevel, recordClear, getProgress, WORLDS } from "./data/levels.js";
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
    onStart: () => startCut("normal"),
    onCustom: (file) => startCustom(file, "normal"),
  });
}

// 直接开一局节拍切击(cut 世界的对应难度关)
function startCut(difficulty = "normal") {
  const cutWorld = WORLDS.find((w) => w.track.id === "cut");
  const level = cutWorld.levels.find((l) => l.diff === difficulty) || cutWorld.levels[1] || cutWorld.levels[0];
  startLevel(level);
}

// ---------- 进入关卡 ----------
async function startLevel(level) {
  loading(`载入 ${level.label}…`);
  await unlockAudio();
  const track = level.track;
  const difficulty = level.diff;
  const compiled = compileTrack(track);
  const best = getProgress()[level.id]?.best || 0;
  const song = { id: track.id, name: track.name, artist: track.artist, genre: track.genre,
    ip: getIP(track.ip), difficulty, emoji: track.emoji, sceneName: track.sceneName,
    levelId: level.id, levelLabel: level.label, best };
  const player = createMusicPlayer(compiled.music);
  launch(song, player, compiled.charts[difficulty], compiled.duration, compiled.meta);
}

// ---------- 自选音乐(自动生成谱面) ----------
async function startCustom(file, difficulty) {
  loading("分析音乐、自动生成谱面…");
  await unlockAudio();
  const { ctx } = getAudio();
  const arr = await file.arrayBuffer();
  const audioBuf = await ctx.decodeAudioData(arr);
  const events = generateBeatmap(audioBuf, difficulty);
  const player = createBufferPlayer(audioBuf);
  const song = { id: "custom", name: file.name.replace(/\.[^.]+$/, ""), artist: "自选音乐",
    genre: "AUTO", ip: getIP("ximalaya"), difficulty, emoji: "🎵", custom: true,
    sceneName: "音浪切片", levelLabel: "自选" };
  launch(song, player, events, audioBuf.duration, { bpm: 120, beatDur: 0.5, scene: "cut" });
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
      const found = result.song.levelId ? findLevel(result.song.levelId) : null;
      if (found) startLevel(found.level);
      else startCut("normal");
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
  canvas.addEventListener("pointerdown", (e) => {
    if (!game) return;
    canvas.setPointerCapture?.(e.pointerId);
    const [x, y] = xy(e); game.pointer("down", x, y); e.preventDefault();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!game) return;
    const [x, y] = xy(e); game.pointer("move", x, y);
  });
  const up = (e) => { if (!game) return; const [x, y] = xy(e); game.pointer("up", x, y); };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
}

window.addEventListener("resize", () => { if (game) game.resize(); });

goHome();
