// 单入口标题页 + 关卡地图(世界×小关)
import { WORLDS, getProgress, isUnlocked, levelStars } from "../data/levels.js";

// ---------- 标题页(唯一入口) ----------
// 单游戏封面(海报 1.png = assets/bg/cover.png), 在"开始开拍"按钮上叠一个透明热区直接开局。
export function renderHome(root, { onStart, onCustom }) {
  const el = document.createElement("div");
  el.className = "screen home home--cover";
  el.innerHTML = `
    <div class="cover">
      <img class="cover__img" src="./assets/bg/cover.png" alt="一拍即合 · 节拍切击" draggable="false" />
      <button class="hot hot--play"   id="startBtn"  aria-label="开始开拍"></button>
      <button class="hot hot--pick"   id="customBtn" aria-label="自选歌曲"></button>
      <input type="file" accept="audio/*" hidden id="fileInput">
    </div>
  `;
  el.querySelector("#startBtn").addEventListener("click", onStart);
  const fi = el.querySelector("#fileInput");
  el.querySelector("#customBtn").addEventListener("click", () => fi.click());
  fi.addEventListener("change", (e) => { const f = e.target.files[0]; if (f) onCustom(f); });
  root.appendChild(el);
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
