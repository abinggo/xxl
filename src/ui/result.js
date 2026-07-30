// 结算页: 评级 + 统计 + 分享海报 + 本地最佳
export function renderResult(root, result, { onRetry, onHome, onLeaderboard }) {
  const { song, score, rank, maxCombo, counts, fullCombo } = result;
  const best = updateBest(song.id, score);
  const isNew = score >= best && score > 0;

  const el = document.createElement("div");
  el.className = "screen result";
  el.innerHTML = `
    <div class="result__rank rank-${rank}">${rank}</div>
    ${fullCombo ? `<div class="newbest">✦ FULL COMBO ✦</div>` : ""}
    <div class="result__song">${song.emoji} ${song.name} · ${song.difficulty.toUpperCase()}</div>
    <div class="result__score">${String(score).padStart(6, "0")}</div>
    ${isNew ? `<div class="newbest">🏆 新纪录!</div>` : `<div style="color:var(--text-dim);font-size:12px;margin-top:6px">最佳 ${best}</div>`}
    <div class="result__stats">
      <div class="stat stat--perfect"><div class="stat__v">${counts.perfect}</div><div class="stat__l">PERFECT</div></div>
      <div class="stat stat--good"><div class="stat__v">${counts.good}</div><div class="stat__l">GOOD</div></div>
      <div class="stat stat--miss"><div class="stat__v">${counts.miss}</div><div class="stat__l">MISS</div></div>
      <div class="stat stat--combo"><div class="stat__v">${maxCombo}</div><div class="stat__l">MAX COMBO</div></div>
    </div>
    <button class="result__rankbtn" id="rankBtn" type="button">🏆 查看本曲排行榜</button>
    <div class="result__actions">
      <button class="btn btn--ghost" id="shareBtn">分享海报</button>
      <button class="btn btn--ghost" id="homeBtn">选曲</button>
      <button class="btn" id="retryBtn">再来一次</button>
    </div>
  `;
  el.querySelector("#retryBtn").addEventListener("click", onRetry);
  el.querySelector("#homeBtn").addEventListener("click", onHome);
  el.querySelector("#rankBtn").addEventListener("click", () => onLeaderboard && onLeaderboard(song));
  el.querySelector("#shareBtn").addEventListener("click", () => sharePoster(root, result));
  root.appendChild(el);
}

function updateBest(songId, score) {
  try {
    const key = "tme_best_" + songId;
    const prev = JSON.parse(localStorage.getItem(key) || "{}").score || 0;
    if (score > prev) localStorage.setItem(key, JSON.stringify({ score }));
    return Math.max(prev, score);
  } catch (e) { return score; }
}

// 生成分享海报
function sharePoster(root, result) {
  const { song, score, rank, maxCombo, fullCombo } = result;
  const W = 720, H = 1280;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  // 背景
  const g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#1b0f3d"); g.addColorStop(0.5, "#0a0616"); g.addColorStop(1, "#2a0a2e");
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // 光晕
  radial(c, W * 0.3, H * 0.25, 380, "rgba(154,107,255,0.35)");
  radial(c, W * 0.75, H * 0.7, 420, "rgba(255,61,154,0.28)");

  c.textAlign = "center";
  c.fillStyle = "#22e1ff"; c.font = "800 30px system-ui, sans-serif";
  c.fillText("TME · 节奏派对", W / 2, 120);

  c.font = "900 300px system-ui, sans-serif";
  const rg = c.createLinearGradient(0, 250, 0, 620);
  rg.addColorStop(0, "#ffd84d"); rg.addColorStop(1, "#ff3d9a");
  c.fillStyle = rg;
  c.fillText(rank, W / 2, 620);

  c.fillStyle = "#fff"; c.font = "800 46px system-ui, sans-serif";
  c.fillText(`${song.emoji} ${song.name}`, W / 2, 720);
  c.fillStyle = "rgba(243,240,255,0.6)"; c.font = "500 28px system-ui, sans-serif";
  c.fillText(`${song.ip.name} · ${song.difficulty.toUpperCase()}`, W / 2, 770);

  c.fillStyle = "#fff"; c.font = "900 120px system-ui, sans-serif";
  c.fillText(String(score).padStart(6, "0"), W / 2, 930);
  c.fillStyle = "rgba(243,240,255,0.6)"; c.font = "600 30px system-ui, sans-serif";
  c.fillText(`评级 ${rank}   最大连击 ${maxCombo}`, W / 2, 990);
  if (fullCombo) { c.fillStyle = "#ffd84d"; c.font = "800 40px system-ui, sans-serif"; c.fillText("✦ FULL COMBO ✦", W / 2, 1060); }

  c.fillStyle = "rgba(243,240,255,0.4)"; c.font = "500 24px system-ui, sans-serif";
  c.fillText("扫码来挑战我的成绩 →  music.tencent", W / 2, 1200);

  const url = cv.toDataURL("image/png");

  const mask = document.createElement("div");
  mask.className = "sheet-mask";
  mask.style.alignItems = "center";
  mask.innerHTML = `
    <div style="margin:auto;text-align:center;padding:20px;">
      <img src="${url}" style="width:230px;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.6);border:1px solid var(--stroke)"/>
      <div style="margin-top:16px;display:flex;gap:10px;justify-content:center">
        <a class="btn" href="${url}" download="tme-rhythm-${song.id}.png">保存海报</a>
        <button class="btn btn--ghost" id="closeShare">关闭</button>
      </div>
    </div>`;
  mask.addEventListener("click", (e) => { if (e.target === mask || e.target.id === "closeShare") mask.remove(); });
  root.appendChild(mask);
}

function radial(c, x, y, r, color) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}
