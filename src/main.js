// 入口与屏幕路由: 选曲 -> 游戏 -> 结算
import { getAudio, unlockAudio } from "./audio/context.js";
import { TRACKS, compileTrack } from "./data/tracks.js";
import { getIP } from "./data/ip.js";
import { createGame } from "./core/engine.js";
import { renderSongSelect } from "./ui/songselect.js";
import { renderResult } from "./ui/result.js";
import { generateBeatmap } from "./core/generator.js";
import { createMusicPlayer } from "./audio/synth.js";
import { createBufferPlayer } from "./audio/decoded.js";

const canvas = document.getElementById("gameCanvas");
const screens = document.getElementById("screens");
let game = null;
let inputBound = false;

// 状态栏时间
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

// ---------- 选曲 ----------
function goSongSelect() {
  if (game) { game.destroy(); game = null; }
  showCanvas(false);
  clearScreens();
  renderSongSelect(screens, {
    tracks: TRACKS,
    onPlay: (track, difficulty) => startBuiltin(track, difficulty),
    onCustom: (file, difficulty) => startCustom(file, difficulty),
  });
}

// ---------- 内置曲目 ----------
async function startBuiltin(track, difficulty) {
  loading("载入曲目…");
  await unlockAudio();
  const compiled = compileTrack(track);
  const song = { id: track.id, name: track.name, artist: track.artist, genre: track.genre,
    ip: getIP(track.ip), difficulty, emoji: track.emoji };
  const player = createMusicPlayer(compiled.music);
  launch(song, player, compiled.beatmaps[difficulty], compiled.duration);
}

// ---------- 自选音乐(自动生成谱面) ----------
async function startCustom(file, difficulty) {
  loading("分析音乐、自动生成谱面…");
  await unlockAudio();
  const { ctx } = getAudio();
  const arr = await file.arrayBuffer();
  const audioBuf = await ctx.decodeAudioData(arr);
  const notes = generateBeatmap(audioBuf, difficulty);
  const player = createBufferPlayer(audioBuf); // 直接播放原音频
  const song = { id: "custom", name: file.name.replace(/\.[^.]+$/, ""), artist: "自选音乐",
    genre: "AUTO", ip: getIP("ximalaya"), difficulty, emoji: "🎵", custom: true };
  launch(song, player, notes, audioBuf.duration);
}

// ---------- 启动一局 ----------
function launch(song, player, notes, duration) {
  clearScreens();
  showCanvas(true);
  game = createGame(canvas, {
    song, player, notes, duration,
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
  renderResult(screens, result, {
    onRetry: () => {
      const track = TRACKS.find((t) => t.id === result.song.id);
      if (track) startBuiltin(track, result.song.difficulty);
      else goSongSelect();
    },
    onHome: () => goSongSelect(),
  });
}

// ---------- 输入 ----------
function bindInput() {
  if (inputBound) return;
  inputBound = true;
  window.addEventListener("keydown", (e) => {
    if (!game) return;
    const k = e.key.toLowerCase();
    if (k === "f" || e.key === "ArrowLeft") { game.pressLane(0); e.preventDefault(); }
    else if (k === "j" || e.key === "ArrowRight") { game.pressLane(1); e.preventDefault(); }
    else if (k === "a") { game.toggleAutoplay(); }
  });
  const press = (e) => {
    if (!game) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    game.pressLane(x < rect.width / 2 ? 0 : 1);
  };
  canvas.addEventListener("pointerdown", press);
}

window.addEventListener("resize", () => { if (game) game.resize(); });

// 启动
goSongSelect();
