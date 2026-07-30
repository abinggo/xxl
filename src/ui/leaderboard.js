import { getSongRanking, getOverallRanking } from "../data/leaderboard.js";

export function showLeaderboard(root, { songs, selectedSong }) {
  const list = songs?.length ? [...songs] : [selectedSong];
  if (selectedSong && !list.some((song) => song.id === selectedSong.id)) list.unshift(selectedSong);
  let mode = "song";
  let song = selectedSong || list[0];

  const mask = document.createElement("div");
  mask.className = "leaderboard-mask";
  mask.innerHTML = `
    <section class="leaderboard" role="dialog" aria-modal="true" aria-label="排行榜">
      <header class="leaderboard__head">
        <div>
          <div class="leaderboard__eyebrow">RHYTHM RANKING</div>
          <h2>节奏排行榜</h2>
        </div>
        <button class="leaderboard__close" type="button" aria-label="关闭排行榜">×</button>
      </header>
      <div class="leaderboard__tabs">
        <button class="leaderboard__tab on" type="button" data-mode="song">单曲榜</button>
        <button class="leaderboard__tab" type="button" data-mode="overall">总榜</button>
      </div>
      <div class="leaderboard__songs"></div>
      <div class="leaderboard__summary"></div>
      <div class="leaderboard__list"></div>
      <div class="leaderboard__foot">每首歌仅记录你的历史最高成绩</div>
    </section>
  `;

  const songsEl = mask.querySelector(".leaderboard__songs");
  const summaryEl = mask.querySelector(".leaderboard__summary");
  const rowsEl = mask.querySelector(".leaderboard__list");

  function renderSongs() {
    songsEl.hidden = mode !== "song";
    if (mode !== "song") return;
    songsEl.innerHTML = list.map((item) => `
      <button class="leaderboard__song${item.id === song.id ? " on" : ""}" type="button" data-song="${item.id}">
        ${item.theme === "flower" ? "🌸" : item.theme === "sunset" ? "🌅" : "🎵"} ${item.name}
      </button>
    `).join("");
    songsEl.querySelectorAll(".leaderboard__song").forEach((button) => {
      button.addEventListener("click", () => {
        song = list.find((item) => item.id === button.dataset.song) || song;
        paint();
      });
    });
  }

  function paint() {
    mask.querySelectorAll(".leaderboard__tab").forEach((tab) => tab.classList.toggle("on", tab.dataset.mode === mode));
    renderSongs();
    const rows = mode === "song" ? getSongRanking(song) : getOverallRanking(list);
    const mine = rows.find((row) => row.isMe);
    summaryEl.innerHTML = mode === "song"
      ? `<div><span>当前单曲</span><b>${song.name}</b></div>
         <div class="leaderboard__myrank"><span>我的排名</span><strong>第 ${mine.position} 名</strong></div>`
      : `<div><span>全平台总榜</span><b>累计各歌曲最高分</b></div>
         <div class="leaderboard__myrank"><span>我的总排名</span><strong>第 ${mine.position} 名</strong></div>`;
    rowsEl.innerHTML = rows.slice(0, 10).map((row) => `
      <div class="leaderboard__row${row.isMe ? " is-me" : ""}">
        <div class="leaderboard__pos pos-${row.position}">${row.position <= 3 ? ["🥇", "🥈", "🥉"][row.position - 1] : row.position}</div>
        <div class="leaderboard__avatar">${row.avatar}</div>
        <div class="leaderboard__player">
          <b>${row.name}${row.isMe ? '<em>我</em>' : ""}</b>
          <span>${!row.hasScore && row.isMe ? "暂无成绩 · 完成一局即可提升排名" : mode === "song"
            ? `${row.rank || "S"} 评级 · ${row.maxCombo} COMBO`
            : "各歌曲最高分累计"}</span>
        </div>
        <div class="leaderboard__score">${formatScore(row.score)}</div>
      </div>
    `).join("");
  }

  mask.querySelectorAll(".leaderboard__tab").forEach((tab) => {
    tab.addEventListener("click", () => { mode = tab.dataset.mode; paint(); });
  });
  const close = () => mask.remove();
  mask.querySelector(".leaderboard__close").addEventListener("click", close);
  mask.addEventListener("click", (event) => { if (event.target === mask) close(); });
  paint();
  root.appendChild(mask);
}

function formatScore(score) {
  return Math.round(score || 0).toLocaleString("zh-CN");
}
