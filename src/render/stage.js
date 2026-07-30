// 共享舞台: 背景 / 霓虹透视地板 / 演唱会灯光 / HUD / 倒计时 / 相机抖动 / 闪光 / 粒子
// 场景(runner/whack/slice)只负责在舞台上画"演员", 舞台负责其余一切随音乐律动
import { createFx } from "./fx.js?v=1785392993";
import { COLORS } from "./config.js?v=1785392993";

export function createStage(canvas, { song }) {
  const ctx = canvas.getContext("2d");
  const fx = createFx();
  const cA = song.ip?.color || song.colorA || COLORS.cyan;
  const cB = song.ip?.accent || song.colorB || COLORS.magenta;

  let W = 0, H = 0, dpr = 1;
  let shake = 0;
  let flashCol = null, flashA = 0;
  let vignette = null;
  const geom = {};

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    geom.floorY = H * 0.70;
    geom.heroX = W * 0.26;
    geom.heroY = geom.floorY;
    geom.actionX = W * 0.50;
    geom.actionY = geom.floorY;
    geom.W = W; geom.H = H;
    buildVignette();
  }

  function buildVignette() {
    vignette = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.2, W / 2, H * 0.5, H * 0.75);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.55)");
  }

  function shakeBy(n) { shake = Math.max(shake, n); }
  function flash(col, a = 0.5) { flashCol = col; flashA = a; }

  // ---- 每帧: 背景层 ----
  function begin(world) {
    const bands = world.bands || {};
    const bass = bands.bass || 0, energy = bands.energy || 0;
    ctx.save();
    if (shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake *= 0.82;
    }
    // 背景渐变
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#160a30");
    g.addColorStop(0.45, "#0b0718");
    g.addColorStop(1, "#05030d");
    ctx.fillStyle = g; ctx.fillRect(-40, -40, W + 80, H + 80);

    // 演唱会顶部灯束 + 律动光晕
    drawLights(bass, energy, world.t || 0);
    // 霓虹透视地板(随拍滚动) — 部分玩法自绘playfield, 关闭它
    if (world.floor !== false) drawFloor(world);
  }

  function drawLights(bass, energy, t) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    // 两侧扫射光束
    const beams = [
      { x: W * 0.2, col: cA }, { x: W * 0.8, col: cB },
    ];
    for (const bm of beams) {
      const sway = Math.sin(t * 1.3 + bm.x) * W * 0.12;
      const grad = ctx.createLinearGradient(bm.x, 0, bm.x + sway, geom.floorY);
      grad.addColorStop(0, hexA(bm.col, 0.28 + energy * 0.25));
      grad.addColorStop(1, hexA(bm.col, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(bm.x - 26, 0); ctx.lineTo(bm.x + 26, 0);
      ctx.lineTo(bm.x + sway + 120, geom.floorY); ctx.lineTo(bm.x + sway - 120, geom.floorY);
      ctx.closePath(); ctx.fill();
    }
    // 顶部脉冲光带
    const topGlow = ctx.createRadialGradient(W / 2, H * 0.28, 8, W / 2, H * 0.28, W * (0.45 + bass * 0.5));
    topGlow.addColorStop(0, hexA(cB, 0.16 + bass * 0.3));
    topGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = topGlow; ctx.fillRect(0, 0, W, H * 0.6);
    ctx.restore();
  }

  function drawFloor(world) {
    const t = world.t || 0;
    const bpm = world.bpm || 120;
    const beatDur = 60 / bpm;
    const floorY = geom.floorY;
    const vpX = W / 2;
    const scroll = (t / (beatDur * 2)) % 1; // 每两拍滚一格
    const rows = 14;

    ctx.save();
    // 地板底色
    const fg = ctx.createLinearGradient(0, floorY, 0, H);
    fg.addColorStop(0, "#0a0820");
    fg.addColorStop(1, "#050310");
    ctx.fillStyle = fg; ctx.fillRect(0, floorY, W, H - floorY);

    // 横向退行线(棋盘带)
    for (let i = 0; i < rows; i++) {
      const z0 = ease((i + scroll) / rows);
      const z1 = ease((i + 1 + scroll) / rows);
      const y0 = floorY + (H - floorY) * z0;
      const y1 = floorY + (H - floorY) * z1;
      if (i % 2 === 0) {
        ctx.fillStyle = hexA(cA, 0.05 + 0.05 * (1 - z0));
        ctx.fillRect(0, y0, W, y1 - y0);
      }
      ctx.strokeStyle = hexA(cA, 0.10 + 0.25 * z0);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(W, y0); ctx.stroke();
    }
    // 纵向汇聚线
    ctx.strokeStyle = hexA(cB, 0.16);
    for (let i = -6; i <= 6; i++) {
      const xTop = vpX + i * (W * 0.03);
      const xBot = vpX + i * (W * 0.28);
      ctx.beginPath(); ctx.moveTo(xTop, floorY); ctx.lineTo(xBot, H); ctx.stroke();
    }
    // 地平线光
    ctx.globalCompositeOperation = "lighter";
    const hg = ctx.createLinearGradient(0, floorY - 20, 0, floorY + 14);
    hg.addColorStop(0, "rgba(0,0,0,0)");
    hg.addColorStop(0.5, hexA(cA, 0.5));
    hg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = hg; ctx.fillRect(0, floorY - 20, W, 34);
    ctx.restore();
  }

  // ---- 每帧: 前景层(粒子/HUD/闪光/暗角/倒计时) ----
  function fxLayer() { fx.update(); fx.draw(ctx); }

  function hud(world) {
    const s = world.scorer;
    const prog = Math.max(0, Math.min(1, world.rankProgress ?? s.rankProgress ?? 0));
    const grd = prog >= 1 ? "SSS" : prog >= 2 / 3 ? "SS" : prog >= 1 / 3 ? "S" : "READY";
    const mult = 1 + Math.min(0.5, Math.floor(s.combo / 10) * 0.05);
    ctx.save();
    ctx.textBaseline = "alphabetic";

    // ---- 左: COMBO × 倍率 ----
    ctx.textAlign = "left";
    ctx.font = "800 11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(243,240,255,0.6)";
    ctx.fillText("COMBO", 20, 30);
    const pulse = 1 + Math.min(0.28, s.combo / 200);
    ctx.font = `900 ${Math.round(30 * pulse)}px system-ui, sans-serif`;
    const cg = ctx.createLinearGradient(20, 34, 20, 66);
    cg.addColorStop(0, "#ffffff"); cg.addColorStop(1, COLORS.gold);
    ctx.fillStyle = cg;
    ctx.shadowColor = COLORS.gold; ctx.shadowBlur = s.combo > 0 ? 14 : 0;
    ctx.fillText(String(s.combo), 20, 62);
    ctx.shadowBlur = 0;
    ctx.font = "800 11px system-ui, sans-serif";
    ctx.fillStyle = hexA(cA, 0.95);
    ctx.fillText(`连击 x${mult.toFixed(1)}`, 20, 80);

    // ---- 中: 大分数 + 历史最高 ----
    ctx.textAlign = "center";
    ctx.font = "900 34px system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = cB; ctx.shadowBlur = 16;
    ctx.fillText(fmt(s.score), W / 2, 50);
    ctx.shadowBlur = 0;
    if (world.best > 0) {
      ctx.font = "800 11px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,216,77,0.9)";
      ctx.fillText(`♛ 历史最高 ${fmt(world.best)}`, W / 2, 68);
    }
    // 计时
    if (world.duration > 0) {
      ctx.font = "800 11px system-ui, sans-serif";
      ctx.fillStyle = "rgba(243,240,255,0.6)";
      ctx.fillText(`${mmss(world.t)} / ${mmss(world.duration)}`, W / 2, world.best > 0 ? 84 : 70);
    }

    // ---- 右上角「当前评级」徽章已移除: 避免被右侧回退/暂停按钮遮挡; 评级仍由下方进度条 + S/SS/SSS 三星呈现 ----

    // ---- 评级条 + S/SS/SSS 三星（MISS 归零，满级喷火） ----
    const bx = 20, bw = W - 40, by = 96, bh = 10, br = bh / 2;
    const t = world.t || 0;
    // 轨道: 更亮的底 + 霓虹描边
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    roundRect(ctx, bx, by, bw, bh, br); ctx.fill();
    ctx.strokeStyle = hexA(cA, 0.45); ctx.lineWidth = 1.5;
    roundRect(ctx, bx, by, bw, bh, br); ctx.stroke();
    if (prog > 0) {
      const fw = Math.max(bh, bw * prog);
      ctx.save();
      roundRect(ctx, bx, by, fw, bh, br); ctx.clip();
      // 高饱和霓虹渐变 + 强发光
      const pg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      pg.addColorStop(0, "#22e1ff"); pg.addColorStop(0.5, "#ffd84d"); pg.addColorStop(1, "#ff4fd8");
      ctx.fillStyle = pg; ctx.shadowColor = COLORS.gold; ctx.shadowBlur = 16;
      ctx.fillRect(bx, by, fw, bh); ctx.shadowBlur = 0;
      // 上缘高光
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      roundRect(ctx, bx + 2, by + 1.5, fw - 4, 2.5, 1.25); ctx.fill();
      // 流动光泽
      const shineX = bx + ((t * 150) % (fw + 90)) - 45;
      const sg = ctx.createLinearGradient(shineX - 34, 0, shineX + 34, 0);
      sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(0.5, "rgba(255,255,255,0.6)"); sg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sg; ctx.fillRect(bx, by, fw, bh);
      ctx.restore();
      // 进度头亮点
      const hx = bx + fw, hy = by + bh / 2;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 13);
      hg.addColorStop(0, "#ffffff"); hg.addColorStop(0.4, hexA(COLORS.gold, 0.9)); hg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(hx, hy, 13, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // 三颗星分别对应 S / SS / SSS。
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const rankMarks = [
      { threshold: 1 / 3, pos: 0.31, label: "S" },
      { threshold: 2 / 3, pos: 0.62, label: "SS" },
      { threshold: 1, pos: 0.92, label: "SSS" },
    ];
    for (let i = 0; i < 3; i++) {
      const mark = rankMarks[i], sx = bx + bw * mark.pos, reached = prog >= mark.threshold;
      ctx.font = "900 15px system-ui, sans-serif";
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(6,4,16,0.9)";
      ctx.strokeText("★", sx, by + bh / 2);
      ctx.fillStyle = reached ? COLORS.gold : "rgba(210,220,255,0.45)";
      ctx.shadowColor = COLORS.gold; ctx.shadowBlur = reached ? 12 : 0;
      ctx.fillText("★", sx, by + bh / 2);
      ctx.shadowBlur = 0;
      ctx.font = "900 8px system-ui, sans-serif";
      ctx.fillStyle = reached ? "#ffffff" : "rgba(210,220,255,0.58)";
      ctx.fillText(mark.label, sx, by + bh + 8);
    }
    if (prog >= 1) drawRankFlame(ctx, bx + bw, by + bh / 2, t);
    ctx.restore();
  }

  function overlay(world) {
    // 暗角
    ctx.save();
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // 闪光
    if (flashA > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = hexA(flashCol || "#ffffff", flashA);
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      flashA *= 0.82;
    }

    // 倒计时 / GO
    if (world.countText) {
      ctx.save();
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const big = world.countText === "GO!" ? 92 : 118;
      ctx.font = `900 ${big}px system-ui, sans-serif`;
      const g = ctx.createLinearGradient(0, H * 0.38, 0, H * 0.6);
      g.addColorStop(0, cA); g.addColorStop(1, cB);
      ctx.fillStyle = g; ctx.shadowColor = cB; ctx.shadowBlur = 34;
      ctx.globalAlpha = world.countAlpha ?? 0.95;
      ctx.fillText(world.countText, W / 2, H * 0.46);
      ctx.restore();
    }
    ctx.restore(); // 关闭 begin() 的 save(相机)
  }

  return {
    resize, begin, fxLayer, hud, overlay,
    fx, shakeBy, flash, geom,
    get colorA() { return cA; }, get colorB() { return cB; },
    get width() { return W; }, get height() { return H; },
  };
}

// ---- 工具 ----
function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function mmss(s) { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
function gradeColor(g) {
  return g === "SSS" ? "#ff5cf0" : g === "SS" ? "#ffd84d" : g === "S" ? "#22e1ff" : "#9fb0d0";
}
function drawRankFlame(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x - 2, y + 2);
  ctx.globalCompositeOperation = "lighter";
  const pulse = 1 + Math.sin(t * 13) * 0.12;
  ctx.scale(pulse, pulse);
  const flame = (w, h, color, sway) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-w * 0.55, 2);
    ctx.quadraticCurveTo(-w, -h * 0.42, sway, -h);
    ctx.quadraticCurveTo(w, -h * 0.42, w * 0.55, 2);
    ctx.closePath();
    ctx.fill();
  };
  ctx.shadowColor = "#ff4f18"; ctx.shadowBlur = 18;
  flame(14, 31, "rgba(255,72,22,0.92)", Math.sin(t * 9) * 4);
  ctx.shadowColor = "#ffd84d"; ctx.shadowBlur = 12;
  flame(9, 24, "rgba(255,216,77,0.96)", Math.sin(t * 12 + 1) * 3);
  ctx.shadowBlur = 8;
  flame(4.5, 15, "rgba(255,255,238,0.98)", Math.sin(t * 15 + 2) * 2);
  for (let i = 0; i < 4; i++) {
    const phase = t * (3.4 + i * 0.3) + i * 1.7;
    const sy = -18 - ((phase * 17) % 22);
    const sx = Math.sin(phase * 2.1) * (8 + i * 2);
    ctx.fillStyle = i % 2 ? "#ffd84d" : "#ff6b28";
    ctx.beginPath(); ctx.arc(sx, sy, 1.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
export function ease(x) { return x * x; }
export function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export function hexA(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
