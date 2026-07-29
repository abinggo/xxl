// 单入口标题页 + 关卡地图(世界×小关)
import { WORLDS, getProgress, isUnlocked, levelStars } from "../data/levels.js?v=1785342161";

// ---------- 标题页(唯一入口 · 动态封面) ----------
// 保留海报 1.png 原样(字体/水晶标题/水晶按钮全不变), 只叠一层动效: 彩纸飘落、
// 星光闪烁、音符上浮、标题流光 + 海报整体轻微呼吸缩放, 让静图"活"起来。
// 每首歌自带一个小图标, 让选曲一眼能分清(日落/花海)
const SONG_ICON = { sunset: "🌅", flower: "🌸" };

export function renderHome(root, { songs, onStart, onCustom }) {
  const list = songs && songs.length ? songs : [{ id: "riluo", name: "日落大道", genre: "Sunset Drive", theme: "sunset" }];
  let sel = 0;                                   // 选中的歌(决定音乐 + 谱面 + 进场主题)

  const el = document.createElement("div");
  el.className = "screen home home--cover";
  el.innerHTML = `
    <div class="cover">
      <img class="cover__img" id="coverImg" src="./assets/bg/cover.png" alt="一拍即合 · 节拍切击" draggable="false" />
      <canvas class="cover__fx" id="coverFx"></canvas>
      <button class="cover__pickbtn" id="songBtn"></button>
      <button class="hot hot--play" id="startBtn" aria-label="开始"></button>
    </div>

    <div class="sheet" id="songSheet" hidden>
      <div class="sheet__panel">
        <div class="sheet__title">选择歌曲</div>
        <div class="sheet__list" id="songList"></div>
        <button class="sheet__custom" id="customBtn">＋ 自选本地音乐</button>
        <button class="sheet__close" id="sheetClose">取消</button>
      </div>
    </div>
    <input type="file" accept="audio/*" hidden id="fileInput">
  `;

  const songBtn = el.querySelector("#songBtn");
  const sheet = el.querySelector("#songSheet");
  const listEl = el.querySelector("#songList");

  function iconOf(s) { return SONG_ICON[s.theme] || "🎵"; }
  function paintSongBtn() { songBtn.innerHTML = `${iconOf(list[sel])} <b>${list[sel].name}</b> ▾`; }
  function paintList() {
    listEl.innerHTML = list.map((s, i) => `
      <button class="sheet__row${i === sel ? " on" : ""}" data-i="${i}">
        <span class="sheet__ic">${iconOf(s)}</span>
        <span class="sheet__nm">${s.name}</span>
        <span class="sheet__gn">${s.genre || ""}</span>
        ${i === sel ? '<span class="sheet__ck">✓</span>' : ""}
      </button>`).join("");
    listEl.querySelectorAll(".sheet__row").forEach((row) => {
      row.addEventListener("click", () => { sel = +row.dataset.i; paintSongBtn(); closeSheet(); });
    });
  }
  function openSheet() { paintList(); sheet.hidden = false; }
  function closeSheet() { sheet.hidden = true; }

  songBtn.addEventListener("click", openSheet);
  el.querySelector("#sheetClose").addEventListener("click", closeSheet);
  sheet.addEventListener("click", (e) => { if (e.target === sheet) closeSheet(); });

  // 开始开拍 => 用【选中的歌】进场(主题跟随该歌自带)
  el.querySelector("#startBtn").addEventListener("click", () => onStart(list[sel], list[sel].theme));

  const fi = el.querySelector("#fileInput");
  el.querySelector("#customBtn").addEventListener("click", () => fi.click());
  fi.addEventListener("change", (e) => { const f = e.target.files[0]; if (f) { closeSheet(); onCustom(f, list[sel].theme); } });

  paintSongBtn();
  paintList();                    // 预填充列表, 弹层任何时候显示都不会是空的
  root.appendChild(el);
  startCoverAnim(el.querySelector("#coverFx"));
}

// ---------- 动态封面动效(只叠在海报上, 不动海报本身) ----------
const CV = {
  PURPLE: "#a855ff", VIOLET: "#7b3cff", BLUE: "#2f7bff",
  CYAN: "#22e1ff", PINK: "#ff4fd8", GOLD: "#ffd84d",
};
const CV_PAL = [CV.CYAN, CV.PINK, CV.PURPLE, CV.BLUE, CV.GOLD];

function startCoverAnim(cv) {
  if (!cv) return;
  const ctx = cv.getContext("2d");
  // 飘落彩纸
  const conf = Array.from({ length: 40 }, (_, i) => ({
    x: (i * 0.113 + 0.04) % 1, y: (i * 0.271) % 1,
    s: 4 + (i % 4) * 3, sp: 0.035 + (i % 5) * 0.014,
    col: CV_PAL[(i + 2) % CV_PAL.length], rot: i, rs: (i % 2 ? 1 : -1) * 1.5,
    sw: 0.02 + (i % 3) * 0.012,
  }));
  // 闪烁星光(集中在企鹅四周)
  const spark = Array.from({ length: 56 }, (_, i) => ({
    x: 0.5 + Math.cos(i * 2.3) * (0.16 + (i % 5) * 0.06),
    y: 0.5 + Math.sin(i * 2.3) * (0.18 + (i % 4) * 0.05),
    r: 0.6 + (i % 3) * 0.9, tw: i * 0.7,
    col: i % 3 ? "#ffffff" : CV_PAL[i % CV_PAL.length],
  }));
  // 上浮音符
  const notes = Array.from({ length: 9 }, (_, i) => ({
    x: 0.16 + (i * 0.11) % 0.68, ph: i * 0.9,
    sp: 0.05 + (i % 4) * 0.02, size: 15 + (i % 3) * 8,
    col: CV_PAL[i % CV_PAL.length], glyph: i % 2 ? "♪" : "♫",
  }));

  function frame() {
    if (!cv.isConnected) return; // 脱离 DOM 自动停止
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth || 393, H = cv.clientHeight || 698;
    if (cv.width !== ((W * dpr) | 0) || cv.height !== ((H * dpr) | 0)) {
      cv.width = (W * dpr) | 0; cv.height = (H * dpr) | 0;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const t = performance.now() / 1000;
    drawCoverFx(ctx, W, H, t, conf, spark, notes);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function drawCoverFx(ctx, W, H, t, conf, spark, notes) {
  const beat = 0.5 + 0.5 * Math.sin(t * 3.4);

  // ---- 企鹅周围脉冲光晕(screen 叠加, 随拍呼吸) ----
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const cx = W * 0.5, cy = H * 0.5;
  const pr = W * (0.34 + 0.05 * beat);
  const glow = ctx.createRadialGradient(cx, cy, pr * 0.3, cx, cy, pr);
  glow.addColorStop(0, cvA(CV.PINK, 0.12 + 0.10 * beat));
  glow.addColorStop(0.6, cvA(CV.PURPLE, 0.05));
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // ---- 星光闪烁 ----
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (const s of spark) {
    const tw = 0.5 + 0.5 * Math.sin(t * 3 + s.tw);
    const a = 0.15 + 0.75 * tw;
    const rr = s.r * (0.7 + 0.7 * tw);
    ctx.fillStyle = cvA(s.col, a);
    ctx.shadowColor = s.col; ctx.shadowBlur = 6 * tw;
    // 十字星
    ctx.beginPath(); ctx.arc(s.x * W, s.y * H, rr, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0; ctx.restore();

  // ---- 上浮音符 ----
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const n of notes) {
    const prog = (t * n.sp + n.ph) % 1;
    const y = H * (0.72 - prog * 0.42);
    const x = W * n.x + Math.sin(t * 0.9 + n.ph) * 14;
    const a = Math.sin(prog * Math.PI) * 0.8;
    ctx.fillStyle = cvA(n.col, a);
    ctx.shadowColor = n.col; ctx.shadowBlur = 10;
    ctx.font = `900 ${n.size}px system-ui, sans-serif`;
    ctx.fillText(n.glyph, x, y);
  }
  ctx.shadowBlur = 0; ctx.restore();

  // ---- 彩纸飘落 ----
  for (const p of conf) {
    const py = (p.y + t * p.sp) % 1;
    const px = p.x + Math.sin(t * 0.8 + p.rot) * p.sw;
    ctx.save();
    ctx.translate(px * W, py * H);
    ctx.rotate(t * p.rs + p.rot);
    ctx.fillStyle = cvA(p.col, 0.85);
    ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
    ctx.restore();
  }

  // ---- 标题流光扫过(不改标题, 只加一道高光) ----
  const period = 3.8;
  const sp = ((t % period) / period);
  if (sp < 0.55) {
    const band = sp / 0.55;              // 0..1 扫过
    const tx = W * (-0.25 + band * 1.5);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, H * 0.10, W, H * 0.16); ctx.clip(); // 限制在标题带
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(tx, 0); ctx.rotate(-0.35);
    const sg = ctx.createLinearGradient(-40, 0, 40, 0);
    sg.addColorStop(0, "rgba(255,255,255,0)");
    sg.addColorStop(0.5, "rgba(255,255,255,0.5)");
    sg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sg; ctx.fillRect(-40, -H * 0.2, 80, H * 0.6);
    ctx.restore();
  }
}

function cvA(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ---------- 关卡地图 ----------
export function renderLevelMap(root, { onPlay, onBack }) {
  const el = document.createElement("div");
  el.className = "screen map";
  el.innerHTML = `
    <div class="map__head">
      <button class="iconbtn" id="backBtn">‹</button>
      <div class="map__title">选择关卡</div>
      <div style="width:34px"></div>
    </div>
    <div class="worlds" id="worlds"></div>
  `;
  const wrap = el.querySelector("#worlds");

  WORLDS.forEach((w) => {
    const sec = document.createElement("div");
    sec.className = "world";
    sec.style.setProperty("--wa", w.colorA);
    sec.style.setProperty("--wb", w.colorB);
    sec.innerHTML = `
      <div class="world__head">
        <div class="world__badge">${w.ip.emoji}</div>
        <div class="world__meta">
          <div class="world__name"><b>世界 ${w.world}</b> · ${w.name}</div>
          <div class="world__scene">🎮 ${w.sceneName} · ${w.verb}</div>
        </div>
        <div class="world__ip">${w.ip.name}</div>
      </div>
      <div class="nodes"></div>
    `;
    const nodes = sec.querySelector(".nodes");
    w.levels.forEach((lv, i) => {
      const unlocked = isUnlocked(lv.id);
      const stars = levelStars(lv.id);
      const node = document.createElement("div");
      node.className = "node" + (unlocked ? "" : " node--lock");
      node.innerHTML = `
        <div class="node__label">${lv.label}</div>
        <div class="node__diff">${lv.name}</div>
        <div class="node__stars">${unlocked ? renderStars(stars) : "🔒"}</div>
      `;
      if (unlocked) node.addEventListener("click", () => onPlay(lv));
      nodes.appendChild(node);
      if (i < w.levels.length - 1) {
        const link = document.createElement("div");
        link.className = "node-link";
        nodes.appendChild(link);
      }
    });
    wrap.appendChild(sec);
  });

  el.querySelector("#backBtn").addEventListener("click", onBack);
  root.appendChild(el);
}

function renderStars(n) {
  let s = "";
  for (let i = 0; i < 3; i++) s += i < n ? "★" : "☆";
  return `<span class="stars stars--${n}">${s}</span>`;
}
