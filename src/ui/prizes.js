import { getPrizes } from "../data/prizes.js";

export function renderPrizes(root, { onBack }) {
  const prizes = getPrizes();
  const el = document.createElement("div");
  el.className = "screen prizes-page";
  el.innerHTML = `
    <header class="prizes-page__head">
      <button class="prizes-page__back" type="button" aria-label="返回首页">‹</button>
      <div>
        <div class="prizes-page__eyebrow">MY COLLECTION</div>
        <h2>我的奖品</h2>
      </div>
      <span class="prizes-page__count">${prizes.length} 件</span>
    </header>
    ${prizes.length ? `
      <div class="prizes-page__grid">
        ${prizes.map(renderPrize).join("")}
      </div>
    ` : `
      <div class="prizes-page__empty">
        <div class="prizes-page__empty-icon">🎁</div>
        <h3>还没有奖品</h3>
        <p>在歌曲中切开闪耀礼盒<br>完成本局后就会收藏到这里</p>
        <button class="prizes-page__play" type="button">去挑战</button>
      </div>
    `}
  `;
  const back = () => onBack && onBack();
  el.querySelector(".prizes-page__back").addEventListener("click", back);
  el.querySelector(".prizes-page__play")?.addEventListener("click", back);
  root.appendChild(el);
}
function renderPrize(prize) {
  const date = prize.collectedAt ? new Date(prize.collectedAt) : null;
  const dateText = date && !Number.isNaN(date.getTime())
    ? `${date.getMonth() + 1}月${date.getDate()}日`
    : "刚刚获得";
  return `
    <article class="prize-card">
      <div class="prize-card__visual">
        <img src="${prize.image}" alt="${prize.name || "音乐奖品"}" />
        <span>${prize.rarity || "隐藏款"}</span>
      </div>
      <div class="prize-card__body">
        <h3>${prize.name || "神秘音乐礼物"}</h3>
        <p>${prize.songName || "音乐挑战"} · ${dateText}</p>
      </div>
    </article>
  `;
}
