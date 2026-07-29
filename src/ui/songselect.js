// 选曲界面: 曲目卡片 + 自选音乐上传 + 难度选择弹层
import { getIP } from "../data/ip.js?v=1785348576";

const DIFF = [
  { key: "easy", name: "EASY", lv: "★☆☆", tip: "跟拍 · 正拍稳踩" },
  { key: "normal", name: "NORMAL", lv: "★★☆", tip: "卡点 · 切分与蓄力" },
  { key: "hard", name: "HARD", lv: "★★★", tip: "炫技 · 有假动作陷阱" },
];

export function renderSongSelect(root, { tracks, onPlay, onCustom }) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <div class="brand">
      <div class="brand__logo">TME · 10th ANNIVERSARY</div>
      <div class="brand__title">节奏派对</div>
      <div class="brand__sub">跟着音乐卡点 · 让 IP 家族为你打 call</div>
    </div>
    <div class="songlist" id="songlist"></div>
  `;
  const list = el.querySelector("#songlist");

  tracks.forEach((t) => {
    const ip = getIP(t.ip);
    const best = getBest(t.id);
    const card = document.createElement("div");
    card.className = "songcard";
    card.style.setProperty("--card-a", t.colorA);
    card.style.setProperty("--card-b", t.colorB);
    card.innerHTML = `
      <div class="songcard__cover">${t.emoji}</div>
      <div class="songcard__info">
        <div class="songcard__name">${t.name}</div>
        <div class="songcard__scene">🎮 ${t.sceneName} · ${t.verb}</div>
        <div class="songcard__meta">
          <span class="tag">${t.genre}</span>
          <span>${t.bpm} BPM</span>
          ${best ? `<span>最佳 ${best}</span>` : ""}
        </div>
      </div>
      <div class="songcard__ip">${ip.emoji}<br>${ip.name}</div>
    `;
    card.addEventListener("click", () => openDiff(root, t.name, (d) => onPlay(t, d)));
    list.appendChild(card);
  });

  // 自选音乐
  const up = document.createElement("label");
  up.className = "upload-card";
  up.innerHTML = `🎵 <b>上传任意歌曲</b> · AI 自动生成谱面<br><span style="opacity:.7;font-size:12px">支持 mp3 / m4a / wav</span>
    <input type="file" accept="audio/*" hidden id="fileInput">`;
  list.appendChild(up);
  up.querySelector("#fileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) openDiff(root, file.name, (d) => onCustom(file, d));
  });

  root.appendChild(el);
}

function openDiff(root, title, choose) {
  const mask = document.createElement("div");
  mask.className = "sheet-mask";
  mask.innerHTML = `
    <div class="sheet">
      <div class="sheet__title">选择难度</div>
      <div class="sheet__sub">${title}</div>
      <div class="diff-row">
        ${DIFF.map((d) => `
          <div class="diff-btn" data-d="${d.key}">
            <div class="diff-btn__name">${d.name}</div>
            <div class="diff-btn__lv">${d.lv}</div>
            <div class="diff-btn__tip">${d.tip}</div>
          </div>`).join("")}
      </div>
    </div>`;
  mask.addEventListener("click", (e) => {
    if (e.target === mask) mask.remove();
    const btn = e.target.closest(".diff-btn");
    if (btn) { mask.remove(); choose(btn.dataset.d); }
  });
  root.appendChild(mask);
}

function getBest(songId) {
  try {
    const raw = localStorage.getItem("tme_best_" + songId);
    return raw ? JSON.parse(raw).score : 0;
  } catch (e) { return 0; }
}
