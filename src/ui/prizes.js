import { getPrizes } from "../data/prizes.js";

// 奖品陈列墙: 两款签名奖品常驻展示, 点开看礼品卡大图
const CATALOG = [
  { key: "riluo",  name: "大疆 Pocket 3",      songName: "日落大道", rarity: "隐藏福利",
    image: "./assets/gift/cards/riluo_card.png" },
  { key: "huahai", name: "周同学定制黑胶唱片", songName: "花海主题", rarity: "隐藏福利",
    image: "./assets/gift/cards/huahai_card.png" },
];

export function renderPrizes(root, { onBack }) {
  const owned = getPrizes();
  const countOf = (key) => owned.filter((p) => p.songId === key || p.key === key).length;
  const total = owned.length;

  const el = document.createElement("div");
  el.className = "screen prizes-page";
  el.innerHTML = `
    <header class="prizes-page__head">
      <button class="prizes-page__back" type="button" aria-label="返回首页">‹</button>
      <div>
        <div class="prizes-page__eyebrow">MY COLLECTION</div>
        <h2>我的奖品</h2>
      </div>
      <span class="prizes-page__count">${total} 件</span>
    </header>
    <div class="prizes-page__grid">
      ${CATALOG.map((c) => renderPrize(c, countOf(c.key))).join("")}
    </div>
  `;

  el.querySelector(".prizes-page__back").addEventListener("click", () => onBack && onBack());
  el.querySelectorAll(".prize-card").forEach((card) => {
    const open = () => {
      const item = CATALOG.find((c) => c.key === card.dataset.key);
      if (item) openDetail(el, item);
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
  root.appendChild(el);
}

function renderPrize(c, owned) {
  return `
    <article class="prize-card${owned ? " prize-card--owned" : ""}" data-key="${c.key}" role="button" tabindex="0">
      <div class="prize-card__visual">
        <img src="${c.image}" alt="${c.name}" draggable="false" />
        <span>${c.rarity}</span>
        ${owned ? `<em class="prize-card__owned">已获得${owned > 1 ? ` ×${owned}` : ""}</em>` : ""}
      </div>
      <div class="prize-card__body">
        <h3>${c.name}</h3>
        <p>${c.songName} · 点击查看礼品卡</p>
      </div>
    </article>
  `;
}

// 点开: 展示整张礼品卡大图(卡片本身已含标题/领取按钮)
function openDetail(root, c) {
  const box = document.createElement("div");
  box.className = "prize-detail";
  box.innerHTML = `
    <div class="prize-detail__mask"></div>
    <div class="prize-detail__card">
      <img src="${c.image}" alt="${c.name}" draggable="false" />
      <button class="prize-detail__claim" type="button" aria-label="领取">点击领取</button>
      <button class="prize-detail__close" type="button" aria-label="关闭">×</button>
    </div>
  `;
  const close = () => box.remove();
  box.querySelector(".prize-detail__mask").addEventListener("click", close);
  box.querySelector(".prize-detail__close").addEventListener("click", close);
  box.querySelector(".prize-detail__claim").addEventListener("click", close);
  requestAnimationFrame(() => box.classList.add("prize-detail--in"));
  root.appendChild(box);
}
