// 节拍切击(全屏切击) — 还原海报: 企鹅吉祥物(耳机+红围巾)在霓虹舞台中央起舞, 玻璃质感的
// 立体水晶方块(等距三面 + 线框三角面 + ♪)从下方成群抛物线飞出, 手指/鼠标滑动 => 粉紫青
// 螺旋刀光划过即切开, 命中: 玻璃碎成两半 + 棱面碎晶 + 冲击环 + 相机冲击 + PERFECT 金字。
// 背景: 两侧音箱墙 + 人群荧光棒 + 舞池光环 + 满屏钻石碎屑 + 扫射光束。桌面 F/J 切最近音符。
import { COLORS } from "../config.js";
import { hexA } from "../stage.js";
import { clamp, lerp } from "./base.js";

const PURPLE = "#a855ff", VIOLET = "#7b3cff", BLUE = "#2f7bff", CYAN = "#22e1ff";
const PINK = "#ff4fd8", GREEN = "#5be08a", GOLD = "#ffd84d";
const PALETTE = [PURPLE, BLUE, CYAN, PINK, VIOLET];
const CUT = { perfect: 0.09, good: 0.22 };
const MISS_AFTER = 0.26;
const TRAIL_LIFE = 0.5;

// 企鹅吉祥物贴图(抠图立绘), 加载完成前回退为发光徽章
let PENG = null;
{ const im = new Image(); im.onload = () => { PENG = im; }; im.src = "./assets/ip/penguin_hero.png"; }

export function createCut(stage, game) {
  const { geom } = stage;
  const chart = game.chart;
  const RISE = Math.max(1.3, game.approach * 1.9);   // 更长滞空 => 同时更多音符在空中

  const trail = [];
  let prevPt = null, autoPt = null;
  let firstActive = 0, recent = null, lastScore = 0, lastPopT = -1;
  let fever = 0, feverT = -1, feverFlashT = -1;
  let pengPulse = 0, pengMood = 1;
  let lastDecor = -999;
  const decor = [];                                  // 背景飞舞装饰水晶(可被顺带切碎, 不计分)

  // 满屏钻石碎屑(缓慢漂移 + 闪烁)
  const confetti = [];
  for (let i = 0; i < 54; i++) confetti.push({
    xf: ((i * 61) % 100) / 100, yf: ((i * 143) % 100) / 100,
    r: 4 + (i % 4) * 3, ph: i * 0.6, sp: 0.4 + (i % 5) * 0.12,
    col: PALETTE[i % PALETTE.length], rot: i * 0.9,
  });
  // 星尘
  const stars = [];
  for (let i = 0; i < 80; i++) stars.push({
    xf: ((i * 73) % 100) / 100, yf: ((i * 137) % 100) / 100,
    r: 0.6 + (i % 3) * 0.7, ph: i * 0.7, col: PALETTE[i % PALETTE.length],
  });
  // 人群 + 荧光棒
  const crowd = [];
  for (let i = 0; i < 48; i++) crowd.push({ xf: i / 47, ph: i * 0.8, col: [PINK, VIOLET, CYAN, GREEN, GOLD, BLUE][i % 6] });
  // 波形圆徽(海报里的装饰)
  const badges = [
    { xf: 0.15, yf: 0.34, col: GREEN, ph: 0.0, r: 15 },
    { xf: 0.86, yf: 0.30, col: CYAN, ph: 1.4, r: 14 },
    { xf: 0.13, yf: 0.60, col: BLUE, ph: 2.6, r: 13 },
    { xf: 0.88, yf: 0.58, col: GREEN, ph: 3.3, r: 13 },
  ];

  chart.forEach((n, i) => {
    n._launch = n.time - RISE;
    n._apexYf = 0.22 + (i % 5) * 0.05;
    const dir = i % 2 === 0 ? 1 : -1;
    n._x0f = clamp(0.5 + dir * (0.10 + (i % 4) * 0.09), 0.10, 0.90);
    n._x1f = clamp(n._x0f + dir * (0.16 + (i % 3) * 0.08), 0.06, 0.94);
    n._gold = i % 7 === 3;
    n._col = n._gold ? GOLD : PALETTE[i % PALETTE.length];
    n._shape = n._gold ? 0 : i % 3;                  // 0玻璃方块 1音符环 2水晶宝石
    n._bob = i * 1.3;
    n._spec = i * 0.9;
  });

  function notePos(n, t) {
    const el = t - n._launch;
    const apex = n._apexYf * geom.H;
    const startY = geom.H * 1.18;
    const k = (startY - apex) / (RISE * RISE);
    const y = apex + k * (el - RISE) * (el - RISE);
    const x = lerp(n._x0f * geom.W, n._x1f * geom.W, clamp(el / (2 * RISE), 0, 1));
    return { x, y, el };
  }

  const feverOn = () => feverT >= 0 && game.t < feverT;

  // ---------- 切割判定 ----------
  function noteRadius(n) { return (n._gold ? 38 : 30) + 26; }

  function sliceSeg(ax, ay, bx, by) {
    const t = game.t;
    const ang = Math.atan2(by - ay, bx - ax);
    for (let i = firstActive; i < chart.length; i++) {
      const n = chart[i];
      if (n._done) continue;
      const dt = t - n.time;
      if (dt < -CUT.good) { if (n.time - t > 0.5) break; continue; }
      if (dt > CUT.good) continue;
      const p = notePos(n, t);
      if (segDist(p.x, p.y, ax, ay, bx, by) <= noteRadius(n)) {
        resolveHit(n, Math.abs(dt) <= CUT.perfect ? "perfect" : "good", ang);
      }
    }
    for (const d of decor) {
      if (d._cut) continue;
      if (segDist(d.x, d.y, ax, ay, bx, by) <= d.size + 14) {
        d._cut = true;
        stage.fx.spawnHalves(d.x, d.y, d.col, ang, d.size);
        stage.fx.spawnBurst(d.x, d.y, d.col, 5, 1.1);
      }
    }
  }

  function sliceNearest() {
    const t = game.t;
    let best = null, bestDt = Infinity;
    for (let i = firstActive; i < chart.length; i++) {
      const n = chart[i];
      if (n._done) continue;
      const dt = Math.abs(t - n.time);
      if (dt < bestDt) { bestDt = dt; best = n; }
      if (n.time - t > 0.5) break;
    }
    if (best && bestDt <= CUT.good) {
      const p = notePos(best, t);
      const ang = -0.7 + Math.sin(best._bob) * 0.5;
      synthBlade(p.x, p.y, ang);
      resolveHit(best, bestDt <= CUT.perfect ? "perfect" : "good", ang);
    }
  }

  function laneTap() { sliceNearest(); }
  function tap() { sliceNearest(); }

  function pointer(type, x, y) {
    const t = game.t;
    if (type === "down") { trail.length = 0; trail.push({ x, y, t }); prevPt = { x, y }; sliceSeg(x - 1, y, x + 1, y); return; }
    if (type === "move") {
      const p = prevPt || { x, y };
      sliceSeg(p.x, p.y, x, y);
      trail.push({ x, y, t }); if (trail.length > 32) trail.shift();
      prevPt = { x, y };
      return;
    }
    if (type === "up") { prevPt = null; }
  }

  function synthBlade(x, y, ang) {
    const t = game.t, L = 88;
    for (let k = -1; k <= 1; k++) trail.push({ x: x + Math.cos(ang) * L * k, y: y + Math.sin(ang) * L * k, t });
    if (trail.length > 32) trail.splice(0, trail.length - 32);
  }

  function resolveHit(n, j, ang) {
    const t = game.t;
    n._done = true; n._rt = t; n._judge = j;
    recent = { t, j };
    const { x, y } = notePos(n, t);
    const col = n._col, hot = j === "perfect", gold = n._gold;

    const res = game.judge(j);
    const gained = Math.max(0, res.score - lastScore); lastScore = res.score;
    pengPulse = 1; pengMood = 1;

    // 玻璃碎裂成两半 + 碎晶 + 火花 + 冲击环(白色克制, 避免叠加过曝盖住判定字)
    stage.fx.spawnHalves(x, y, col, ang, gold ? 36 : 28);
    stage.fx.spawnShards(x, y, col, hot ? 18 : 12, hot ? 2.2 : 1.7);
    stage.fx.spawnShards(x, y, "#ffffff", hot ? 4 : 2, 1.6);
    stage.fx.spawnBurst(x, y, col, hot ? 13 : 8, 1.8);
    stage.fx.spawnBurst(x, y, "#ffffff", hot ? 3 : 2, 1.5);
    stage.fx.spawnRing(x, y, col, hot ? 1.9 : 1.2);
    if (hot || gold) stage.fx.spawnRing(x, y, hot ? col : "#ffffff", 1.4);
    if (gold) { stage.fx.spawnShards(x, y, GOLD, 18, 2.4); stage.fx.spawnBurst(x, y, GOLD, 13, 2.1); stage.fx.spawnRing(x, y, GOLD, 2.1); }
    stage.shakeBy(gold ? 7 : hot ? 4.5 : 2.5);
    stage.flash(gold ? GOLD : col, gold ? 0.16 : hot ? 0.09 : 0.045);
    if (navigator.vibrate) navigator.vibrate(hot ? 16 : 8);

    const jx = x + Math.sin(n._bob * 2.1) * geom.W * 0.05;
    const jy = y - geom.H * 0.03;
    if (hot || gold) {
      stage.fx.spawnPop(jx, jy, "PERFECT", GOLD, { size: gold ? 32 : 28, rise: 1.0, decay: 0.03 });
      stage.fx.spawnPop(jx, jy + geom.H * 0.03, "+" + gained, GOLD, { size: 16, rise: 1.0, decay: 0.035 });
      lastPopT = t;
    } else if (t - lastPopT > 0.12) {
      stage.fx.spawnPop(jx, jy, "GOOD", col, { size: 20, rise: 1.05, decay: 0.05 });
      lastPopT = t;
    }

    if (!feverOn()) {
      fever = clamp(fever + (hot ? 0.09 : 0.05) + (gold ? 0.05 : 0), 0, 1);
      if (fever >= 1) { feverT = t + 6.5; fever = 1; feverFlashT = t; stage.flash(GOLD, 0.22); stage.shakeBy(8); }
    }
    if (feverOn()) { stage.fx.spawnBurst(x, y, GOLD, 8, 1.6); stage.fx.spawnShards(x, y, PINK, 5, 1.4); }
  }

  // ---------- 自动演示 ----------
  function auto(t) {
    for (let i = firstActive; i < chart.length; i++) {
      const n = chart[i];
      if (n._done) continue;
      if (t >= n.time) {
        const p = notePos(n, t);
        if (autoPt) { for (let k = 1; k <= 3; k++) trail.push({ x: lerp(autoPt.x, p.x, k / 3), y: lerp(autoPt.y, p.y, k / 3), t }); }
        else trail.push({ x: p.x, y: p.y, t });
        if (trail.length > 32) trail.splice(0, trail.length - 32);
        const ang = autoPt ? Math.atan2(p.y - autoPt.y, p.x - autoPt.x) : -0.6;
        autoPt = { x: p.x, y: p.y };
        resolveHit(n, Math.abs(t - n.time) <= CUT.perfect ? "perfect" : "good", ang);
      }
    }
  }

  // ---------- 每帧推进 ----------
  function update(t) {
    while (firstActive < chart.length) {
      const n = chart[firstActive];
      if (n._done) { firstActive++; continue; }
      if (t - n.time > MISS_AFTER) {
        n._done = true; n._judge = "miss"; recent = { t, j: "miss" };
        game.judge("miss", { silent: true });
        pengMood = -1;
        if (t - lastPopT > 0.12) {
          const p = notePos(n, t);
          stage.fx.spawnPop(p.x, p.y, "MISS", COLORS.miss, { size: 20, rise: 0.9, decay: 0.05 });
          lastPopT = t;
        }
        fever = clamp(fever - 0.15, 0, 1);
        firstActive++;
      } else break;
    }
    while (trail.length && t - trail[0].t > TRAIL_LIFE) trail.shift();
    if (!trail.length) autoPt = null;
    pengPulse *= 0.90;
    pengMood += (1 - pengMood) * 0.05;

    if (t >= 0 && t - lastDecor > 0.28) {
      lastDecor = t;
      const n = 1 + (((t * 7) | 0) % 2);
      for (let i = 0; i < n; i++) spawnDecor(t, i);
    }
    for (let i = decor.length - 1; i >= 0; i--) {
      const d = decor[i], el = t - d.t0;
      if (el > 3.2 || (el > 0.4 && dcY(d, el) > geom.H * 1.15)) decor.splice(i, 1);
    }
  }

  function spawnDecor(t, seed) {
    const rnd = (Math.sin(t * 91.7 + seed * 53.3) * 43758.5) % 1;
    const r2 = (Math.sin(t * 12.9 + seed * 78.2) * 24634.6) % 1;
    const x0 = geom.W * (0.10 + Math.abs(rnd) * 0.80);
    decor.push({
      t0: t, x0, y0: geom.H * 1.1, vx: r2 * geom.W * 0.09,
      vy: -(geom.H * (0.95 + Math.abs(rnd) * 0.35)),
      col: PALETTE[(Math.abs(rnd * 5) | 0) % PALETTE.length],
      shape: (Math.abs(r2 * 3) | 0) % 3, size: 12 + Math.abs(rnd) * 9,
      spin: (r2 - 0.5) * 2, x: x0, y: geom.H * 1.1, _cut: false,
    });
  }
  function dcY(d, el) { return d.y0 + d.vy * el + 0.5 * (geom.H * 1.5) * el * el; }

  // ================= 绘制 =================
  function draw(g) {
    const c = g.ctx, t = g.t, bands = g.bands || {};
    const fv = feverOn();

    drawBackground(c, t, bands, fv);
    drawPenguin(c, t, bands, fv);
    drawSwirl(c, t, fv);
    drawBadges(c, t, fv);
    drawDecor(c, t);

    for (let i = firstActive; i < chart.length; i++) {
      const n = chart[i];
      if (n._done) continue;
      const p = notePos(n, t);
      if (p.el < 0 || p.el > 2 * RISE || p.y > geom.H * 1.1) continue;
      drawNote(c, p.x, p.y, n, t);
    }

    drawBlade(c, t, fv);
    drawWeapon(c, t, fv);

    if (feverFlashT >= 0 && t - feverFlashT < 1.0) {
      const k = (t - feverFlashT) / 1.0;
      c.save(); c.globalAlpha = 1 - k;
      c.textAlign = "center"; c.textBaseline = "middle";
      c.font = `900 ${Math.round(56 * (1 + (1 - k) * 0.3))}px system-ui`;
      c.fillStyle = GOLD; c.shadowColor = GOLD; c.shadowBlur = 34;
      c.fillText("FEVER!", geom.W / 2, geom.H * 0.4);
      c.restore();
    }

    drawFeverPill(c, t, fv);
    if (t < 5.5 && !recent) drawHint(c, t);
  }

  // ===== 背景: 霓虹 Live 舞台 =====
  function drawBackground(c, t, bands, fv) {
    const energy = bands.energy || 0, bass = bands.bass || 0;
    const cx = geom.W / 2;

    // 顶部脉冲光雾
    c.save(); c.globalCompositeOperation = "lighter";
    const pc = fv ? GOLD : PURPLE;
    const top = c.createRadialGradient(cx, geom.H * 0.30, 10, cx, geom.H * 0.30, geom.W * (0.7 + bass * 0.3));
    top.addColorStop(0, hexA(pc, 0.18 + bass * 0.14));
    top.addColorStop(0.6, hexA(BLUE, 0.05));
    top.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = top; c.fillRect(0, 0, geom.W, geom.H);

    // 旋转光束
    c.save(); c.translate(cx, geom.H * 0.02);
    for (let i = 0; i < 5; i++) {
      c.save(); c.rotate(t * 0.14 + i * (Math.PI * 2 / 5));
      const gg = c.createLinearGradient(0, 0, 0, geom.H);
      gg.addColorStop(0, hexA(fv ? GOLD : [PURPLE, BLUE, PINK, CYAN, VIOLET][i], 0.09 + bass * 0.05));
      gg.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = gg;
      c.beginPath(); c.moveTo(-16, 0); c.lineTo(16, 0); c.lineTo(96, geom.H); c.lineTo(-96, geom.H); c.closePath(); c.fill();
      c.restore();
    }
    c.restore();
    c.restore();

    // 星尘
    c.save(); c.globalCompositeOperation = "lighter";
    for (const s of stars) {
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.6 + s.ph));
      c.fillStyle = hexA(s.col, 0.45 * tw); c.shadowColor = s.col; c.shadowBlur = 6;
      c.beginPath(); c.arc(s.xf * geom.W, s.yf * geom.H, s.r * tw, 0, Math.PI * 2); c.fill();
    }
    c.restore();

    drawSpeakers(c, t, bass, fv);
    drawConfetti(c, t, fv);
    drawCrowd(c, t, energy, fv);
    drawFloorRings(c, t, bass, fv);
  }

  // 两侧音箱墙: 整墙 + 喇叭脉动 + EQ 灯柱
  function drawSpeakers(c, t, bass, fv) {
    const towerW = geom.W * 0.15, towerH = geom.H * 0.66, y0 = geom.H * 0.06;
    for (let side = 0; side < 2; side++) {
      const x = side === 0 ? -geom.W * 0.01 : geom.W - towerW + geom.W * 0.01;
      const col = side ? CYAN : PURPLE;
      c.save();
      c.fillStyle = "rgba(10,8,24,0.72)";
      roundRectPath(c, x, y0, towerW, towerH, 12); c.fill();
      c.strokeStyle = hexA(col, 0.35); c.lineWidth = 1.5; c.stroke();
      c.globalCompositeOperation = "lighter";
      for (let i = 0; i < 4; i++) {
        const wy = y0 + towerH * (0.12 + i * 0.25), wx = x + towerW / 2;
        const rr = towerW * (0.28 + bass * 0.12) * (1 + Math.sin(t * 4 + i) * 0.06);
        const gg = c.createRadialGradient(wx, wy, 2, wx, wy, rr * 1.8);
        gg.addColorStop(0, hexA(fv ? GOLD : col, 0.7)); gg.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = gg; c.beginPath(); c.arc(wx, wy, rr * 1.8, 0, Math.PI * 2); c.fill();
        c.strokeStyle = hexA("#ffffff", 0.5); c.lineWidth = 1.5;
        c.beginPath(); c.arc(wx, wy, rr, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.arc(wx, wy, rr * 0.4, 0, Math.PI * 2); c.stroke();
      }
      const ledX = side ? x - 7 : x + towerW + 7;
      for (let i = 0; i < 12; i++) {
        const ly = y0 + towerH * (i / 12);
        const on = Math.abs(Math.sin(t * 5 + i * 0.7 + side)) > 0.32;
        c.fillStyle = hexA(on ? (fv ? GOLD : [GREEN, GOLD, PINK, CYAN][i % 4]) : col, on ? 0.9 : 0.14);
        c.fillRect(ledX - 2, ly + 2, 4, towerH / 14);
      }
      c.restore();
    }
  }

  // 满屏钻石碎屑
  function drawConfetti(c, t, fv) {
    c.save(); c.globalCompositeOperation = "lighter";
    for (const d of confetti) {
      const x = d.xf * geom.W + Math.sin(t * 0.3 + d.ph) * 14;
      const y = ((d.yf - t * 0.015 * d.sp) % 1 + 1) % 1 * geom.H;
      const tw = 0.35 + 0.5 * Math.abs(Math.sin(t * 2 + d.ph));
      const col = fv ? GOLD : d.col, s = d.r * (0.7 + tw * 0.5);
      c.save(); c.translate(x, y); c.rotate(d.rot + t * 0.3);
      c.strokeStyle = hexA(col, 0.5 * tw + 0.15); c.lineWidth = 1.4;
      c.shadowColor = col; c.shadowBlur = 8;
      c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.62, 0); c.lineTo(0, s); c.lineTo(-s * 0.62, 0); c.closePath();
      c.fillStyle = hexA(col, 0.12 * tw); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(0, -s); c.lineTo(0, s); c.moveTo(-s * 0.62, 0); c.lineTo(s * 0.62, 0); c.stroke();
      c.restore();
    }
    c.restore();
  }

  function drawCrowd(c, t, energy, fv) {
    const base = geom.H * 0.99;
    c.save();
    c.fillStyle = "rgba(3,2,10,0.75)"; c.fillRect(0, geom.H * 0.90, geom.W, geom.H * 0.10);
    c.globalCompositeOperation = "lighter";
    for (const p of crowd) {
      const x = p.xf * geom.W;
      const h = geom.H * (0.02 + Math.abs(Math.sin(t * 3 + p.ph)) * (0.04 + energy * 0.03));
      const col = fv ? GOLD : p.col;
      c.strokeStyle = hexA(col, 0.85); c.lineWidth = 3; c.lineCap = "round";
      c.shadowColor = col; c.shadowBlur = 10;
      c.beginPath(); c.moveTo(x, base); c.lineTo(x, base - h); c.stroke();
      c.fillStyle = hexA(col, 0.6);
      c.beginPath(); c.arc(x, base - h, 2.6, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  // 舞池光环(企鹅脚下)
  function drawFloorRings(c, t, bass, fv) {
    c.save(); c.globalCompositeOperation = "lighter";
    const fy = geom.H * 0.88, col = fv ? GOLD : CYAN;
    for (let i = 0; i < 5; i++) {
      const rx = geom.W * (0.10 + i * 0.11) * (1 + Math.sin(t * 2 + i) * 0.03 + bass * 0.05);
      c.strokeStyle = hexA(i % 2 ? PINK : col, 0.16 * (1 - i / 6)); c.lineWidth = 2.4;
      c.beginPath(); c.ellipse(geom.W / 2, fy, rx, rx * 0.16, 0, 0, Math.PI * 2); c.stroke();
    }
    c.restore();
  }

  // ===== 企鹅吉祥物 =====
  function drawPenguin(c, t, bands, fv) {
    const bass = bands.bass || 0;
    const cx = geom.W * 0.5, baseY = geom.H * 0.87;
    const bob = Math.sin(t * 3) * 7 + bass * 12 + pengPulse * 6;
    const cy = baseY - bob;

    // 光环
    c.save(); c.globalCompositeOperation = "lighter";
    const auraR = geom.W * (0.34 + bass * 0.05 + pengPulse * 0.04);
    const aura = c.createRadialGradient(cx, cy - geom.H * 0.06, 10, cx, cy - geom.H * 0.06, auraR);
    aura.addColorStop(0, hexA(fv ? GOLD : PURPLE, 0.32 + pengPulse * 0.15));
    aura.addColorStop(0.5, hexA(BLUE, 0.12));
    aura.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = aura; c.beginPath(); c.arc(cx, cy - geom.H * 0.06, auraR, 0, Math.PI * 2); c.fill();
    c.restore();

    if (PENG) {
      const w = geom.W * (0.46 + pengPulse * 0.03);
      const h = w * (PENG.height / PENG.width);
      const tilt = Math.sin(t * 2) * 0.03 + (pengMood < 0 ? 0.05 : 0);
      c.save();
      c.translate(cx, cy);
      c.rotate(tilt);
      c.shadowColor = hexA(fv ? GOLD : PURPLE, 0.9); c.shadowBlur = 26 + pengPulse * 20;
      c.drawImage(PENG, -w / 2, -h + geom.H * 0.02, w, h);
      c.restore();
    } else {
      c.save(); c.globalCompositeOperation = "lighter";
      const r = geom.W * 0.14;
      const b = c.createRadialGradient(cx, cy - r, 4, cx, cy - r, r);
      b.addColorStop(0, "#ffffff"); b.addColorStop(1, PURPLE);
      c.fillStyle = b; c.beginPath(); c.arc(cx, cy - r, r, 0, Math.PI * 2); c.fill();
      c.restore();
      c.font = `${Math.round(geom.W * 0.16)}px system-ui`; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("🐧", cx, cy - r);
    }
  }

  // 企鹅周围的霓虹螺旋(海报氛围)
  function drawSwirl(c, t, fv) {
    const cx = geom.W * 0.5, cy = geom.H * 0.62;
    c.save(); c.globalCompositeOperation = "lighter"; c.lineCap = "round";
    for (let arc = 0; arc < 2; arc++) {
      const dir = arc ? -1 : 1, phase = t * 0.8 * dir + arc * Math.PI;
      const passes = [{ w: 16, a: 0.10 }, { w: 7, a: 0.22 }, { w: 2.5, a: 0.5 }];
      for (const ps of passes) {
        c.beginPath();
        for (let s = 0; s <= 1.001; s += 0.05) {
          const ang = phase + s * Math.PI * 2.2;
          const rad = geom.W * (0.14 + s * 0.24);
          const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad * 0.62;
          s === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        const col = fv ? GOLD : (arc ? CYAN : PINK);
        c.strokeStyle = hexA(col, ps.a); c.lineWidth = ps.w;
        c.shadowColor = col; c.shadowBlur = 16; c.stroke();
      }
    }
    c.restore();
  }

  function drawBadges(c, t, fv) {
    for (const b of badges) {
      const x = b.xf * geom.W, y = b.yf * geom.H + Math.sin(t * 1.6 + b.ph) * 8, r = b.r;
      c.save(); c.globalCompositeOperation = "lighter";
      const col = fv ? GOLD : b.col;
      c.strokeStyle = hexA(col, 0.75); c.lineWidth = 2.5; c.shadowColor = col; c.shadowBlur = 14;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 2; c.lineCap = "round";
      c.beginPath();
      for (let i = 0; i <= 12; i++) {
        const bx = x - r * 0.62 + (i / 12) * r * 1.24;
        const by = y + Math.sin(t * 6 + i * 0.9 + b.ph) * r * 0.42 * (i % 2 ? 1 : 0.6);
        i === 0 ? c.moveTo(bx, by) : c.lineTo(bx, by);
      }
      c.stroke();
      c.restore();
    }
  }

  function drawDecor(c, t) {
    c.save(); c.globalCompositeOperation = "lighter";
    for (const d of decor) {
      if (d._cut) continue;
      const el = t - d.t0;
      d.x = d.x0 + d.vx * el; d.y = dcY(d, el);
      if (d.y > geom.H * 1.1) continue;
      c.save(); c.globalAlpha = 0.55; c.translate(d.x, d.y); c.rotate(d.spin * el);
      drawShape(c, d.shape, d.size, d.col, t, d.t0 * 3, false);
      c.restore();
    }
    c.restore();
  }

  // ===== 音符(玻璃立体) =====
  function drawNote(c, x, y, n, t) {
    const base = n._gold ? 36 : 29;
    const a = base * (1 + Math.sin(t * 3 + n._bob) * 0.05);
    const dt = Math.abs(t - n.time);
    if (dt < CUT.good) {
      const k = 1 - dt / CUT.good;
      c.save(); c.globalCompositeOperation = "lighter";
      c.strokeStyle = hexA("#ffffff", 0.2 + k * 0.55); c.lineWidth = 2.5;
      c.beginPath(); c.arc(x, y, lerp(a + 40, a + 8, k), 0, Math.PI * 2); c.stroke();
      c.restore();
    }
    c.save(); c.translate(x, y); c.rotate(Math.sin(t * 1.3 + n._bob) * 0.08);
    drawShape(c, n._shape, a, n._col, t, n._spec, true);
    c.restore();
  }

  // 以原点为中心画水晶: 0玻璃立方(线框+♪) 1霓虹音符环 2水晶宝石(+♪)
  function drawShape(c, shape, a, col, t, spec, note) {
    c.globalCompositeOperation = "lighter";
    if (shape === 0) { glassCube(c, a, col, note); }
    else if (shape === 1) { noteRing(c, a, col, t, spec); }
    else { gemCrystal(c, a, col, t, spec, note); }
  }

  // 玻璃立方: 等距三面 + 线框三角面 + ♪(海报同款)
  function glassCube(c, a, col, note) {
    const s = a;
    const T = [0, -s * 1.12], R = [s * 0.92, -s * 0.55], L = [-s * 0.92, -s * 0.55], M = [0, s * 0.12];
    const Br = [s * 0.92, s * 0.42], Bl = [-s * 0.92, s * 0.42], B = [0, s * 1.06];
    const top = [T, R, M, L], rf = [R, Br, B, M], lf = [L, M, B, Bl];
    poly(c, top, hexA("#ffffff", 0.30), col, 0);
    poly(c, rf, hexA(col, 0.20), col, 0);
    poly(c, lf, hexA(col, 0.12), col, 0);
    // 外轮廓
    c.strokeStyle = hexA("#ffffff", 0.92); c.lineWidth = 2.2; c.shadowColor = col; c.shadowBlur = 18;
    path(c, [T, R, Br, B, Bl, L], true); c.stroke();
    // 内棱
    c.lineWidth = 1.6; c.strokeStyle = hexA("#ffffff", 0.7);
    seg(c, T, M); seg(c, R, M); seg(c, L, M); seg(c, B, M);
    // 三角面细分线
    c.lineWidth = 1; c.strokeStyle = hexA(col, 0.65); c.shadowBlur = 6;
    seg(c, R, B); seg(c, L, B);
    seg(c, mid(T, R), M); seg(c, mid(T, L), M); seg(c, mid(R, Br), M); seg(c, mid(L, Bl), M);
    c.shadowBlur = 0;
    if (note) noteGlyph(c, s * 0.62, col, [0, s * 0.35]);
    corner(c, T, col); corner(c, R, "#ffffff"); corner(c, L, col);
  }

  // 霓虹音符环: ♪ 在发光圆环里
  function noteRing(c, a, col, t, spec) {
    const R = a * 1.05;
    c.strokeStyle = hexA(col, 0.9); c.lineWidth = 3; c.shadowColor = col; c.shadowBlur = 20;
    c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = hexA("#ffffff", 0.55); c.lineWidth = 1.2;
    c.beginPath(); c.arc(0, 0, R * 0.8, 0, Math.PI * 2); c.stroke();
    const gl = c.createRadialGradient(0, 0, 2, 0, 0, R);
    gl.addColorStop(0, hexA(col, 0.35)); gl.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = gl; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
    noteGlyph(c, R * 1.15, col, [0, 2]);
  }

  // 水晶宝石: 多面钻石 + ♪
  function gemCrystal(c, a, col, t, spec, note) {
    const W = a, tableY = -a * 0.6, girdleY = -a * 0.18, botY = a * 1.15, tw = W * 0.52, gm = W * 0.34;
    c.shadowColor = col; c.shadowBlur = 26;
    c.beginPath();
    c.moveTo(-tw, tableY); c.lineTo(tw, tableY); c.lineTo(W, girdleY); c.lineTo(0, botY); c.lineTo(-W, girdleY); c.closePath();
    const rg = c.createRadialGradient(0, girdleY, 2, 0, girdleY, a * 1.5);
    rg.addColorStop(0, "#ffffff"); rg.addColorStop(0.4, col); rg.addColorStop(1, hexA(col, 0.5));
    c.fillStyle = rg; c.fill(); c.shadowBlur = 0;
    c.strokeStyle = hexA("#ffffff", 0.6); c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-W, girdleY); c.lineTo(W, girdleY);
    c.moveTo(-tw, tableY); c.lineTo(-gm, girdleY); c.moveTo(tw, tableY); c.lineTo(gm, girdleY);
    c.moveTo(-gm, girdleY); c.lineTo(0, botY); c.moveTo(gm, girdleY); c.lineTo(0, botY);
    c.moveTo(-W, girdleY); c.lineTo(0, botY); c.moveTo(W, girdleY); c.lineTo(0, botY);
    c.stroke();
    if (note) noteGlyph(c, a * 0.62, col, [0, girdleY + a * 0.2]);
  }

  function noteGlyph(c, size, col, at) {
    c.save();
    c.globalCompositeOperation = "source-over";
    c.fillStyle = "#ffffff"; c.shadowColor = col; c.shadowBlur = 10;
    c.font = `900 ${Math.round(size)}px system-ui`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("♪", at[0], at[1]);
    c.restore();
  }

  // ===== 霓虹螺旋刀光 =====
  function drawBlade(c, t, fv) {
    const pts = [];
    for (const p of trail) { const af = 1 - (t - p.t) / TRAIL_LIFE; if (af > 0) pts.push({ x: p.x, y: p.y, af }); }
    if (pts.length < 2) return;
    c.save(); c.globalCompositeOperation = "lighter"; c.lineCap = "round"; c.lineJoin = "round";
    const passes = [
      { w: 52, blur: 40, alpha: 0.24, white: false },
      { w: 28, blur: 30, alpha: 0.5, white: false },
      { w: 13, blur: 20, alpha: 0.85, white: false },
      { w: 4.5, blur: 12, alpha: 1.0, white: true },
    ];
    for (const pass of passes) {
      for (let i = 1; i < pts.length; i++) {
        const frac = i / (pts.length - 1), af = pts[i].af;
        const col = pass.white ? "#ffffff" : (fv ? GOLD : bladeCol(frac));
        c.strokeStyle = withA(col, pass.alpha * af);
        c.lineWidth = Math.max(1, pass.w * (0.3 + frac * 0.7) * af);
        c.shadowColor = pass.white ? (fv ? GOLD : CYAN) : col; c.shadowBlur = pass.blur;
        const aP = pts[i - 1], bP = pts[i], mx = (aP.x + bP.x) / 2, my = (aP.y + bP.y) / 2;
        c.beginPath();
        if (i === 1) c.moveTo(aP.x, aP.y); else { const pa = pts[i - 2]; c.moveTo((pa.x + aP.x) / 2, (pa.y + aP.y) / 2); }
        c.quadraticCurveTo(aP.x, aP.y, mx, my); c.stroke();
      }
    }
    const head = pts[pts.length - 1];
    const hg = c.createRadialGradient(head.x, head.y, 1, head.x, head.y, 24);
    hg.addColorStop(0, "#ffffff"); hg.addColorStop(0.4, withA(fv ? GOLD : CYAN, 0.8)); hg.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = hg; c.beginPath(); c.arc(head.x, head.y, 24, 0, Math.PI * 2); c.fill();
    for (let i = 1; i < pts.length; i += 2) {
      c.globalAlpha = pts[i].af; c.fillStyle = "#ffffff"; c.shadowColor = fv ? GOLD : CYAN; c.shadowBlur = 12;
      c.beginPath(); c.arc(pts[i].x, pts[i].y, 1.6 + pts[i].af * 1.8, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  function drawWeapon(c, t, fv) {
    if (trail.length < 2) return;
    const last = trail[trail.length - 1];
    if (t - last.t > 0.10) return;
    const prev = trail[trail.length - 2];
    const ang = Math.atan2(last.y - prev.y, last.x - prev.x);
    const glow = fv ? GOLD : CYAN, hilt = fv ? PINK : VIOLET, L = geom.H * 0.15, bw = 10;
    c.save(); c.translate(last.x, last.y); c.rotate(ang); c.globalCompositeOperation = "lighter";
    c.shadowColor = glow; c.shadowBlur = 28; c.fillStyle = hexA(glow, 0.5);
    c.beginPath(); c.moveTo(-L * 0.28, 0); c.lineTo(0, -bw); c.lineTo(L, 0); c.lineTo(0, bw); c.closePath(); c.fill();
    c.shadowBlur = 10; c.fillStyle = "#ffffff";
    c.beginPath(); c.moveTo(-L * 0.2, 0); c.lineTo(0, -bw * 0.4); c.lineTo(L * 0.96, 0); c.lineTo(0, bw * 0.4); c.closePath(); c.fill();
    c.shadowBlur = 0; c.fillStyle = hexA(hilt, 0.95);
    c.beginPath(); c.arc(-L * 0.3, 0, bw, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  // 海报式 FEVER 胶囊
  function drawFeverPill(c, t, fv) {
    const w = geom.W * 0.40, h = 26, x = (geom.W - w) / 2, y = geom.H * 0.94;
    c.save();
    c.fillStyle = "rgba(10,8,24,0.6)"; roundRectPath(c, x, y, w, h, h / 2); c.fill();
    c.strokeStyle = hexA(fv ? GOLD : VIOLET, 0.85); c.lineWidth = 2;
    c.shadowColor = fv ? GOLD : VIOLET; c.shadowBlur = fv ? 18 : 8;
    roundRectPath(c, x, y, w, h, h / 2); c.stroke(); c.shadowBlur = 0;
    const px = x + 8, pw = w - 78, py = y + h / 2 - 3;
    c.fillStyle = "rgba(255,255,255,0.10)"; roundRectPath(c, px, py, pw, 6, 3); c.fill();
    const p = fv ? 1 : fever;
    if (p > 0) {
      const g = c.createLinearGradient(px, 0, px + pw, 0);
      g.addColorStop(0, VIOLET); g.addColorStop(0.5, CYAN); g.addColorStop(1, GOLD);
      c.fillStyle = g; roundRectPath(c, px, py, pw * p, 6, 3); c.fill();
    }
    c.textAlign = "right"; c.textBaseline = "middle";
    c.font = "900 14px system-ui"; c.fillStyle = fv ? GOLD : "#eae2ff";
    c.shadowColor = fv ? GOLD : VIOLET; c.shadowBlur = 10;
    c.fillText(fv ? "★ FEVER" : "⌇ FEVER", x + w - 12, y + h / 2);
    c.restore();
  }

  function drawHint(c, t) {
    const w = geom.W * 0.7, h = 40, x = (geom.W - w) / 2, y = geom.H * 0.905 - h;
    c.save();
    c.globalAlpha = 0.5 + Math.sin(t * 4) * 0.16;
    c.fillStyle = "rgba(12,8,26,0.5)"; c.strokeStyle = hexA(CYAN, 0.5); c.lineWidth = 1.5;
    roundRectPath(c, x, y, w, h, 20); c.fill(); c.stroke();
    c.globalAlpha = 0.85 + Math.sin(t * 4) * 0.12;
    c.fillStyle = "#eaf2ff"; c.font = "800 15px system-ui"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("滑动屏幕 · 挥刀切开飞出的音符", geom.W / 2, y + h / 2);
    c.restore();
  }

  return { draw, update, auto, laneTap, tap, pointer, lanes: 2, floor: false };
}

// ---- 多边形/线段工具 ----
function poly(c, pts, fill, glow, blur) {
  c.save();
  c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath();
  if (blur) { c.shadowColor = glow; c.shadowBlur = blur; }
  c.fillStyle = fill; c.fill();
  c.restore();
}
function path(c, pts, close) {
  c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); if (close) c.closePath();
}
function seg(c, a, b) { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
function corner(c, p, col) {
  c.save(); c.globalCompositeOperation = "lighter";
  c.fillStyle = "#ffffff"; c.shadowColor = col; c.shadowBlur = 10;
  c.beginPath(); c.arc(p[0], p[1], 2.2, 0, Math.PI * 2); c.fill(); c.restore();
}

function bladeCol(f) {
  return f < 0.5 ? lerpHex(PINK, VIOLET, f / 0.5) : lerpHex(VIOLET, CYAN, (f - 0.5) / 0.5);
}
function lerpHex(a, b, f) {
  const pa = h2rgb(a), pb = h2rgb(b);
  return [Math.round(pa[0] + (pb[0] - pa[0]) * f), Math.round(pa[1] + (pb[1] - pa[1]) * f), Math.round(pa[2] + (pb[2] - pa[2]) * f)];
}
function h2rgb(h) { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function withA(col, a) { return Array.isArray(col) ? `rgba(${col[0]},${col[1]},${col[2]},${a})` : hexA(col, a); }

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let tt = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
  const cx = ax + tt * dx, cy = ay + tt * dy;
  return Math.hypot(px - cx, py - cy);
}
function roundRectPath(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
