// 节拍切击(全屏切击) — 还原海报: 企鹅吉祥物(耳机+红围巾)在霓虹舞台中央起舞, 玻璃质感的
// 立体水晶方块(等距三面 + 线框三角面 + ♪)从下方成群抛物线飞出, 手指/鼠标滑动 => 粉紫青
// 螺旋刀光划过即切开, 命中: 玻璃碎成两半 + 棱面碎晶 + 冲击环 + 相机冲击 + PERFECT 金字。
// 背景: 两侧音箱墙 + 人群荧光棒 + 舞池光环 + 满屏钻石碎屑 + 扫射光束。桌面 F/J 切最近音符。
import { COLORS } from "../config.js?v=1785345155";
import { hexA } from "../stage.js?v=1785345155";
import { clamp, lerp } from "./base.js?v=1785345155";

const PURPLE = "#a855ff", VIOLET = "#7b3cff", BLUE = "#2f7bff", CYAN = "#22e1ff";
const PINK = "#ff4fd8", GREEN = "#5be08a", GOLD = "#ffd84d";
const PALETTE = [PURPLE, BLUE, CYAN, PINK, VIOLET];
const CUT = { perfect: 0.09, good: 0.22 };
const MISS_AFTER = 0.26;
const TRAIL_LIFE = 0.5;
const FREEZE_DUR = 1.5;                             // 冰冻: 音符停止下落的秒数
const ICE = "#bff4ff", RED = "#ff2d4d", ORANGE = "#ff8a3d";

// 花海主题(切花)配色 + 障碍色
const F_PINK = "#ff5fae", F_ROSE = "#ff9ad0", F_MAG = "#c86bff", F_GOLD = "#ffd24d", F_MINT = "#8fe9d0";
const F_PALETTE = [F_PINK, F_ROSE, F_MAG, "#ff77c2", F_GOLD];
const SPIKE = "#7a2fd6";                            // 带刺障碍(花海里替代炸弹)

// 日落大道主题(切音符)暖色盘: 金/橙/琥珀/落日红
const S_GOLD = "#ffd24d", S_ORANGE = "#ff9a3c", S_AMBER = "#ffb347", S_RED = "#ff5e3a";
const S_PALETTE = [S_GOLD, S_ORANGE, S_AMBER, "#ffcf5c", S_RED];

// 企鹅吉祥物贴图(抠图立绘), 加载完成前回退为发光徽章
let PENG = null;
{ const im = new Image(); im.onload = () => { PENG = im; }; im.src = "./assets/ip/penguin_hero.png"; }
// 花海舞台底图(切花场景背景), 加载完成前回退为粉色渐变
let FLORAL = null;
{ const im = new Image(); im.onload = () => { FLORAL = im; }; im.src = "./assets/bg/huahai_stage.png"; }
// 日落大道舞台底图(落日公路), 加载完成前回退为暖色渐变
let SUNSET = null;
{ const im = new Image(); im.onload = () => { SUNSET = im; }; im.src = "./assets/bg/riluo_stage.png"; }

// 主题背景视频: 整段视频(已烤入企鹅 + 全部动效)作为循环背景铺满播放。
// 全画面直接 drawImage(video) => GPU 直出、无像素回读, 成本极低; 同一时刻只解码当前主题那一个。
function makeBgVideo(src) {
  const v = document.createElement("video");
  v.src = src; v.loop = true; v.muted = true; v.playsInline = true; v.preload = "auto";
  let ready = false;
  v.addEventListener("loadeddata", () => { ready = true; });
  return {
    el: v,
    get ready() { return ready && v.readyState >= 2 && v.videoWidth > 0; },
    play() { if (v.paused) v.play().catch(() => {}); },
    pause() { if (!v.paused) v.pause(); },
  };
}
let sunsetBg = null, flowerBg = null;
const getSunsetBg = () => sunsetBg || (sunsetBg = makeBgVideo("./assets/video/riluo_bg.mp4"));
const getFlowerBg = () => flowerBg || (flowerBg = makeBgVideo("./assets/video/huahai_bg.mp4"));
// 视频 cover-fit 铺满画面(居中裁剪); 未就绪返回 false 以便回退静态底图
function drawVideoCover(c, v, W, H) {
  const vw = v.videoWidth, vh = v.videoHeight;
  if (!vw || !vh) return false;
  const scale = Math.max(W / vw, H / vh);
  const w = vw * scale, h = vh * scale;
  c.drawImage(v, (W - w) / 2, (H - h) / 2, w, h);
  return true;
}

export function createCut(stage, game) {
  const { geom } = stage;
  const chart = game.chart;
  const RISE = Math.max(1.3, game.approach * 1.9);   // 更长滞空 => 同时更多音符在空中

  // ---- 主题: sunset(切音符) / flower(切花) / neon(切水晶, 已下线保留兜底) ----
  const theme = (game.meta && game.meta.theme) || "sunset";
  const flower = theme === "flower";
  const sunset = theme === "sunset";
  const PAL = flower ? F_PALETTE : sunset ? S_PALETTE : PALETTE;   // 音符/碎屑取色盘
  const ACCENT = flower ? F_MAG : sunset ? S_ORANGE : PURPLE;      // 企鹅光环主色
  const COOL = flower ? F_MAG : sunset ? S_GOLD : CYAN;            // 刀光/高光冷色

  const trail = [];
  let prevPt = null, autoPt = null;
  let firstActive = 0, recent = null, lastScore = 0, lastPopT = -1;
  let fever = 0, feverT = -1, feverFlashT = -1;
  let freezeOff = 0, freezeUntil = -1, freezeFlashT = -1, lastFrameT = -1; // 冰冻: 累积偏移冻结音符时间线
  const NT = () => game.t - freezeOff;               // 音符时间线(冰冻期间停住), 视觉/刀光仍用 game.t
  let pengPulse = 0, pengMood = 1;
  let lastDecor = -999;
  const decor = [];                                  // 背景飞舞装饰水晶(可被顺带切碎, 不计分)

  // 满屏钻石碎屑(缓慢漂移 + 闪烁)
  const confetti = [];
  for (let i = 0; i < 54; i++) confetti.push({
    xf: ((i * 61) % 100) / 100, yf: ((i * 143) % 100) / 100,
    r: 4 + (i % 4) * 3, ph: i * 0.6, sp: 0.4 + (i % 5) * 0.12,
    col: PAL[i % PAL.length], rot: i * 0.9,
  });
  // 星尘
  const stars = [];
  for (let i = 0; i < 80; i++) stars.push({
    xf: ((i * 73) % 100) / 100, yf: ((i * 137) % 100) / 100,
    r: 0.6 + (i % 3) * 0.7, ph: i * 0.7, col: PAL[i % PAL.length],
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
    n._gold = !n.item && i % 7 === 3;
    n._col = n.item ? (n.item === "bomb" ? RED : n.item === "bonus" ? GOLD : CYAN)
                    : (n._gold ? GOLD : PAL[i % PAL.length]);
    n._shape = n._gold ? 0 : i % 3;                  // neon:0方块1环2宝石 / flower:0樱花1水晶花2莲花
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
    const t = NT();
    const ang = Math.atan2(by - ay, bx - ax);
    // 划过即切: 只要音符已经出现在屏幕上(还没掉出/还没判 miss), 划到就切开得分,
    // 不用等它的判定光圈收拢。卡在拍点(perfect 窗)给 PERFECT, 其余算 GOOD。
    for (let i = firstActive; i < chart.length; i++) {
      const n = chart[i];
      if (n._done) continue;
      const p = notePos(n, t);
      if (p.el < 0) break;                             // 后面的音符更晚, 都还没起飞 => 结束扫描
      if (p.y > geom.H * 1.12) continue;               // 已掉出屏幕
      if (segDist(p.x, p.y, ax, ay, bx, by) <= noteRadius(n)) {
        resolveHit(n, Math.abs(t - n.time) <= CUT.perfect ? "perfect" : "good", ang);
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
    const t = NT();
    // 键盘/点击: 切当前屏幕上"最该切"的那颗(离拍点最近的已出现音符), 同样不必等光圈
    let best = null, bestDt = Infinity;
    for (let i = firstActive; i < chart.length; i++) {
      const n = chart[i];
      if (n._done) continue;
      const p = notePos(n, t);
      if (p.el < 0) break;                             // 还没出现, 后面更晚 => 结束
      if (p.y > geom.H * 1.12) continue;               // 已掉出屏幕
      const dt = Math.abs(t - n.time);
      if (dt < bestDt) { bestDt = dt; best = n; }
    }
    if (best) {
      const p = notePos(best, t);
      const ang = -0.7 + Math.sin(best._bob) * 0.5;
      synthBlade(p.x, p.y, ang);
      resolveHit(best, bestDt <= CUT.perfect ? "perfect" : "good", ang);
    }
  }

  function laneTap() { sliceNearest(); }
  function tap() { sliceNearest(); }

  let bladeAcc = 0;                                  // 掉屑节流: 累积挥动距离
  function pointer(type, x, y) {
    const t = game.t;
    if (type === "down") { trail.length = 0; trail.push({ x, y, t }); prevPt = { x, y }; bladeAcc = 0; sliceSeg(x - 1, y, x + 1, y); return; }
    if (type === "move") {
      const p = prevPt || { x, y };
      sliceSeg(p.x, p.y, x, y);
      // 沿刀锋掉落细碎屑: 每挥过一小段距离掉 1 粒(节流, 不刷爆粒子池)
      bladeAcc += Math.hypot(x - p.x, y - p.y);
      if (bladeAcc >= 20) {
        bladeAcc = 0;
        stage.fx.spawnEmber(x, y, feverOn() ? GOLD : (flower ? F_PINK : COOL));
      }
      trail.push({ x, y, t }); if (trail.length > 22) trail.shift();
      prevPt = { x, y };
      return;
    }
    if (type === "up") { prevPt = null; }
  }

  function synthBlade(x, y, ang) {
    const t = game.t, L = 88;
    for (let k = -1; k <= 1; k++) trail.push({ x: x + Math.cos(ang) * L * k, y: y + Math.sin(ang) * L * k, t });
    if (trail.length > 22) trail.splice(0, trail.length - 22);
  }

  function resolveHit(n, j, ang) {
    const t = game.t;
    n._done = true; n._rt = t; n._judge = j;
    const { x, y } = notePos(n, NT());
    if (n.item) { resolveItem(n, x, y, ang); return; }
    recent = { t, j };
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

  // 隐藏道具命中: 炸弹扣分断连 / 加速加分 / 冰冻加分并暂停下落(均不计入判定统计)
  function resolveItem(n, x, y, ang) {
    const t = game.t;
    if (n.item === "bomb") {
      game.addScore(-150); game.breakCombo();
      recent = { t, j: "miss" }; pengMood = -1; fever = clamp(fever - 0.3, 0, 1);
      stage.fx.spawnShards(x, y, RED, 22, 2.6); stage.fx.spawnShards(x, y, ORANGE, 10, 2.0);
      stage.fx.spawnBurst(x, y, RED, 16, 2.2); stage.fx.spawnBurst(x, y, ORANGE, 8, 1.8);
      stage.fx.spawnRing(x, y, RED, 2.4); stage.fx.spawnRing(x, y, "#ffffff", 1.6);
      stage.shakeBy(11); stage.flash(RED, 0.28);
      if (navigator.vibrate) navigator.vibrate([18, 26, 18]);
      stage.fx.spawnPop(x, y - geom.H * 0.05, "BOMB!", "#ff5d6d", { size: 30, rise: 0.9, decay: 0.03 });
      stage.fx.spawnPop(x, y - geom.H * 0.01, "-150", "#ff8a8a", { size: 20, rise: 0.9, decay: 0.035 });
    } else if (n.item === "bonus") {
      game.addScore(250); recent = { t, j: "perfect" }; pengPulse = 1; pengMood = 1;
      fever = clamp(fever + 0.18, 0, 1);
      stage.fx.spawnHalves(x, y, GOLD, ang, 34);
      stage.fx.spawnShards(x, y, GOLD, 24, 2.6); stage.fx.spawnShards(x, y, "#ffffff", 6, 1.8);
      stage.fx.spawnBurst(x, y, GOLD, 18, 2.4); stage.fx.spawnRing(x, y, GOLD, 2.4); stage.fx.spawnRing(x, y, "#fff6c8", 1.6);
      stage.shakeBy(6); stage.flash(GOLD, 0.20);
      if (navigator.vibrate) navigator.vibrate(18);
      stage.fx.spawnPop(x, y - geom.H * 0.05, "BONUS", GOLD, { size: 30, rise: 1.0, decay: 0.03 });
      stage.fx.spawnPop(x, y - geom.H * 0.01, "+250", GOLD, { size: 20, rise: 1.0, decay: 0.035 });
    } else { // freeze
      game.addScore(80); recent = { t, j: "perfect" }; pengPulse = 1;
      triggerFreeze();
      stage.fx.spawnHalves(x, y, CYAN, ang, 32);
      stage.fx.spawnShards(x, y, ICE, 22, 2.2); stage.fx.spawnShards(x, y, CYAN, 12, 1.8);
      stage.fx.spawnBurst(x, y, CYAN, 16, 2.0); stage.fx.spawnRing(x, y, CYAN, 2.6); stage.fx.spawnRing(x, y, "#ffffff", 1.6);
      stage.shakeBy(5); stage.flash(ICE, 0.24);
      if (navigator.vibrate) navigator.vibrate(14);
      stage.fx.spawnPop(x, y - geom.H * 0.05, "FREEZE", CYAN, { size: 30, rise: 1.0, decay: 0.03 });
      stage.fx.spawnPop(x, y - geom.H * 0.01, "+80", CYAN, { size: 20, rise: 1.0, decay: 0.035 });
    }
    lastPopT = t;
  }

  function triggerFreeze() { freezeUntil = game.t + FREEZE_DUR; freezeFlashT = game.t; }

  // ---------- 自动演示 ----------
  function auto() {
    const t = NT();
    for (let i = firstActive; i < chart.length; i++) {
      const n = chart[i];
      if (n._done) continue;
      if (n.item === "bomb") continue;               // 自动演示: 主动躲开炸弹
      if (t >= n.time) {
        const p = notePos(n, t);
        if (autoPt) { for (let k = 1; k <= 3; k++) trail.push({ x: lerp(autoPt.x, p.x, k / 3), y: lerp(autoPt.y, p.y, k / 3), t }); }
        else trail.push({ x: p.x, y: p.y, t });
        if (trail.length > 22) trail.splice(0, trail.length - 22);
        const ang = autoPt ? Math.atan2(p.y - autoPt.y, p.x - autoPt.x) : -0.6;
        autoPt = { x: p.x, y: p.y };
        resolveHit(n, Math.abs(t - n.time) <= CUT.perfect ? "perfect" : "good", ang);
      }
    }
  }

  // ---------- 每帧推进 ----------
  function update(t) {
    // 冰冻: 期间把流逝时间累进偏移量, 使音符时间线(nt)停住 => 音符不下落;
    // 解冻后偏移量缓慢追回归零(音符略微加速), 自愈与音乐的对齐, 避免整曲永久错拍
    const dt = lastFrameT >= 0 ? Math.max(0, t - lastFrameT) : 0;
    if (freezeUntil > 0 && t < freezeUntil) freezeOff += dt;
    else if (freezeOff > 0) freezeOff = Math.max(0, freezeOff - dt * 0.6);
    lastFrameT = t;
    const nt = NT();

    while (firstActive < chart.length) {
      const n = chart[firstActive];
      if (n._done) { firstActive++; continue; }
      if (nt - n.time > MISS_AFTER) {
        if (n.item) { n._done = true; firstActive++; continue; } // 漏掉道具无惩罚(躲炸弹是对的)
        n._done = true; n._judge = "miss"; recent = { t, j: "miss" };
        game.judge("miss", { silent: true });
        pengMood = -1;
        if (t - lastPopT > 0.12) {
          const p = notePos(n, nt);
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

    if (!flower && t >= 0 && t - lastDecor > 0.28) {   // 花海用飘落花瓣代替飞舞水晶
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
      col: PAL[(Math.abs(rnd * 5) | 0) % PAL.length],
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
    if (!flower && !sunset) drawSwirl(c, t, fv);      // 花海/日落不要中央螺旋光晕(还原干净底图)
    if (!flower && !sunset) drawBadges(c, t, fv);
    drawDecor(c, t);

    const ntNow = t - freezeOff;
    for (let i = firstActive; i < chart.length; i++) {
      const n = chart[i];
      if (n._done) continue;
      const p = notePos(n, ntNow);
      if (p.el < 0 || p.el > 2 * RISE || p.y > geom.H * 1.1) continue;
      drawNote(c, p.x, p.y, n, t);
    }

    // 企鹅(骑行/跳舞视频)画在音符之上 => 位于最上层, 不被音符遮挡
    drawPenguin(c, t, bands, fv);

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

    if (freezeUntil > 0 && t < freezeUntil) drawFreezeOverlay(c, t);
    drawFeverPill(c, t, fv);
    if (t < 5.5 && !recent) drawHint(c, t);
  }

  // 冰冻全屏罩: 冰蓝渐晕 + 顶部 ❄ 横幅(提示"音符已冻结")
  function drawFreezeOverlay(c, t) {
    const remain = freezeUntil - t;
    const fade = clamp(Math.min(remain, 0.3) / 0.3, 0, 1) * clamp((FREEZE_DUR - remain) / 0.2, 0.2, 1);
    c.save();
    const vg = c.createRadialGradient(geom.W / 2, geom.H / 2, geom.H * 0.18, geom.W / 2, geom.H / 2, geom.H * 0.62);
    vg.addColorStop(0, "rgba(120,230,255,0)");
    vg.addColorStop(1, hexA(CYAN, 0.20 * fade));
    c.fillStyle = vg; c.fillRect(0, 0, geom.W, geom.H);
    c.globalCompositeOperation = "lighter";
    c.fillStyle = hexA(ICE, 0.05 * fade); c.fillRect(0, 0, geom.W, geom.H);
    c.globalCompositeOperation = "source-over";
    const pulse = 0.5 + 0.5 * Math.sin(t * 6);
    c.textAlign = "center"; c.textBaseline = "middle";
    c.font = `900 30px system-ui`;
    c.fillStyle = "#eaffff"; c.shadowColor = CYAN; c.shadowBlur = 20 + pulse * 12; c.globalAlpha = fade;
    c.fillText("❄ FREEZE ❄", geom.W / 2, geom.H * 0.17);
    c.restore();
  }

  // ===== 背景: 霓虹 Live 舞台 / 花海樱花舞台 =====
  function drawBackground(c, t, bands, fv) {
    if (flower) { drawFlowerBg(c, t, bands, fv); return; }
    if (sunset) { drawSunsetBg(c, t, bands, fv); return; }
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
    for (const s of stars) {                          // 80 颗星每帧, 去掉 shadowBlur(lighter 自带辉光)
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.6 + s.ph));
      c.fillStyle = hexA(s.col, 0.5 * tw);
      c.beginPath(); c.arc(s.xf * geom.W, s.yf * geom.H, s.r * tw, 0, Math.PI * 2); c.fill();
    }
    c.restore();

    drawSpeakers(c, t, bass, fv);
    drawConfetti(c, t, fv);
    drawCrowd(c, t, energy, fv);
    drawFloorRings(c, t, bass, fv);
  }

  // ===== 背景: 花海 —— 循环播放整段背景视频(已含跳舞企鹅 + 飘花/暖阳/光环动效) =====
  function drawFlowerBg(c, t, bands, fv) {
    const bass = bands.bass || 0;
    const bg = getFlowerBg(); bg.play(); if (sunsetBg) sunsetBg.pause();
    let drew = false;
    if (bg.ready) drew = drawVideoCover(c, bg.el, geom.W, geom.H);
    if (!drew) {                                        // 视频未就绪: 回退静态底图 + 矢量飘花/光环
      if (FLORAL && FLORAL.width) {
        const scale = Math.max(geom.W / FLORAL.width, geom.H / FLORAL.height);
        const w = FLORAL.width * scale, h = FLORAL.height * scale;
        c.drawImage(FLORAL, (geom.W - w) / 2, (geom.H - h) / 2, w, h);
      } else {
        const g = c.createLinearGradient(0, 0, 0, geom.H);
        g.addColorStop(0, "#ffe0f0"); g.addColorStop(0.5, "#ff9ec9"); g.addColorStop(1, "#c86bff");
        c.fillStyle = g; c.fillRect(0, 0, geom.W, geom.H);
      }
      c.save(); c.globalCompositeOperation = "lighter";
      const sy = geom.H * 0.2, sr = geom.W * (0.62 + bass * 0.25);
      const sun = c.createRadialGradient(geom.W / 2, sy, 10, geom.W / 2, sy, sr);
      sun.addColorStop(0, hexA(fv ? F_GOLD : "#fff2c8", 0.32 + bass * 0.2));
      sun.addColorStop(0.5, hexA(F_ROSE, 0.10));
      sun.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = sun; c.fillRect(0, 0, geom.W, geom.H);
      c.restore();
      drawPetals(c, t, fv);
      drawFlowerRings(c, t, bass, fv);
    }
    // 轻压暗上半玩区: 让花朵音符/HUD 更清晰(不破坏粉色基调)
    const dk = c.createLinearGradient(0, 0, 0, geom.H * 0.62);
    dk.addColorStop(0, "rgba(58,12,58,0.22)");
    dk.addColorStop(1, "rgba(58,12,58,0)");
    c.fillStyle = dk; c.fillRect(0, 0, geom.W, geom.H * 0.62);
  }

  // 飘落樱花花瓣(复用碎屑分布, 缓慢下落 + 旋转 + 闪烁)
  function drawPetals(c, t, fv) {
    c.save(); c.globalCompositeOperation = "source-over";  // 明亮背景上用正常混合, 花瓣才有粉色
    for (const d of confetti) {
      const x = d.xf * geom.W + Math.sin(t * 0.5 + d.ph) * 28;
      const y = ((d.yf + t * 0.03 * d.sp) % 1) * geom.H;
      const tw = 0.5 + 0.5 * Math.abs(Math.sin(t * 2 + d.ph));
      const s = d.r * (1.1 + tw * 0.5), col = fv ? F_GOLD : d.col;
      c.save(); c.translate(x, y); c.rotate(d.rot + t * (0.5 + d.sp));
      petal(c, s, col, 0.45 * tw + 0.3);
      c.restore();
    }
    c.restore();
  }

  // 粉色舞池光环(企鹅脚下)
  function drawFlowerRings(c, t, bass, fv) {
    c.save(); c.globalCompositeOperation = "lighter";
    const fy = geom.H * 0.9, col = fv ? F_GOLD : F_PINK;
    for (let i = 0; i < 5; i++) {
      const rx = geom.W * (0.12 + i * 0.11) * (1 + Math.sin(t * 2 + i) * 0.03 + bass * 0.05);
      c.strokeStyle = hexA(i % 2 ? F_MAG : col, 0.18 * (1 - i / 6)); c.lineWidth = 2.4;
      c.beginPath(); c.ellipse(geom.W / 2, fy, rx, rx * 0.16, 0, 0, Math.PI * 2); c.stroke();
    }
    c.restore();
  }

  // ===== 背景: 日落大道 —— 循环播放整段背景视频(已含骑行企鹅 + 落日/光环动效) =====
  function drawSunsetBg(c, t, bands, fv) {
    const bg = getSunsetBg(); bg.play(); if (flowerBg) flowerBg.pause();
    let drew = false;
    if (bg.ready) drew = drawVideoCover(c, bg.el, geom.W, geom.H);
    if (!drew) {                                        // 视频未就绪: 回退静态底图 + 矢量速度线
      if (SUNSET && SUNSET.width) {
        const scale = Math.max(geom.W / SUNSET.width, geom.H / SUNSET.height);
        const w = SUNSET.width * scale, h = SUNSET.height * scale;
        c.drawImage(SUNSET, (geom.W - w) / 2, (geom.H - h) / 2, w, h);
      } else {
        const g = c.createLinearGradient(0, 0, 0, geom.H);
        g.addColorStop(0, "#3a2a6a"); g.addColorStop(0.5, "#ff8a4c"); g.addColorStop(1, "#ffd24d");
        c.fillStyle = g; c.fillRect(0, 0, geom.W, geom.H);
      }
      drawRoadRush(c, t, fv);
    }
    // 极轻压暗上半区, 让金色音符/HUD 更清晰(视频与静态都加)
    const dk = c.createLinearGradient(0, 0, 0, geom.H * 0.55);
    dk.addColorStop(0, "rgba(20,6,36,0.22)");
    dk.addColorStop(1, "rgba(20,6,36,0)");
    c.fillStyle = dk; c.fillRect(0, 0, geom.W, geom.H * 0.55);
  }

  // 日落: 公路速度线 — 光尘从落日灭点沿透视向观者两侧加速奔涌, 制造"向前骑"的动感
  function drawRoadRush(c, t, fv) {
    const vpx = geom.W * 0.5, vpy = geom.H * 0.46;     // 落日/地平线灭点
    c.save(); c.globalCompositeOperation = "lighter"; c.lineCap = "round";
    const rays = 9;
    for (let i = 0; i < rays; i++) {
      const spread = i / (rays - 1) - 0.5;             // -0.5..0.5
      const ex = vpx + spread * geom.W * 2.4;
      const ey = geom.H * 1.05;
      for (let k = 0; k < 2; k++) {
        const prog = (t * 0.85 + i * 0.11 + k * 0.5) % 1;
        const p = prog * prog;                         // 近处加速(透视)
        const p2 = Math.min(1, p + 0.09);
        const a = Math.sin(prog * Math.PI) * (fv ? 0.6 : 0.42);
        c.strokeStyle = hexA(i % 2 ? S_GOLD : S_ORANGE, a);
        c.lineWidth = 1 + p * 5;
        c.beginPath();
        c.moveTo(lerp(vpx, ex, p), lerp(vpy, ey, p));
        c.lineTo(lerp(vpx, ex, p2), lerp(vpy, ey, p2));
        c.stroke();
      }
    }
    c.restore();
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
      const col = fv ? GOLD : d.col, s = d.r * (0.7 + tw * 0.5);   // 54 片碎屑每帧, 去 shadowBlur
      c.save(); c.translate(x, y); c.rotate(d.rot + t * 0.3);
      c.strokeStyle = hexA(col, 0.55 * tw + 0.18); c.lineWidth = 1.4;
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
      const col = fv ? GOLD : p.col;                  // 48 根荧光棒每帧, 去 shadowBlur
      c.strokeStyle = hexA(col, 0.9); c.lineWidth = 3; c.lineCap = "round";
      c.beginPath(); c.moveTo(x, base); c.lineTo(x, base - h); c.stroke();
      c.fillStyle = hexA(col, 0.7);
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
    // 日落/花海: 企鹅已烤入背景视频中, 这里不再叠加
    if (sunset || flower) return;
    const bass = bands.bass || 0;

    const cx = geom.W * 0.5, baseY = geom.H * 0.87;
    const bob = Math.sin(t * 3) * 7 + bass * 12 + pengPulse * 6;
    const cy = baseY - bob;

    // 光环(花海保留柔和暖光垫底; 中央螺旋已在别处去掉)
    c.save(); c.globalCompositeOperation = "lighter";
    const auraR = geom.W * (0.28 + bass * 0.05 + pengPulse * 0.04);
    const aura = c.createRadialGradient(cx, cy - geom.H * 0.04, 10, cx, cy - geom.H * 0.04, auraR);
    aura.addColorStop(0, hexA(fv ? GOLD : ACCENT, 0.26 + pengPulse * 0.15));
    aura.addColorStop(0.5, hexA(flower ? F_ROSE : BLUE, 0.10));
    aura.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = aura; c.beginPath(); c.arc(cx, cy - geom.H * 0.04, auraR, 0, Math.PI * 2); c.fill();
    c.restore();

    const offX = 0, up = 0, tilt = Math.sin(t * 2) * 0.03 + (pengMood < 0 ? 0.05 : 0);
    const sx = 1, sy = 1;

    if (PENG) {
      const w = geom.W * (0.368 + pengPulse * 0.024);           // 80% 大小
      const h = w * (PENG.height / PENG.width);
      c.save();
      c.translate(cx + offX, cy - up);
      c.rotate(tilt);
      c.scale(sx, sy);
      c.shadowColor = hexA(fv ? GOLD : ACCENT, 0.9); c.shadowBlur = 22 + pengPulse * 18;
      c.drawImage(PENG, -w / 2, -h + geom.H * 0.02, w, h);
      c.restore();
    } else {
      c.save(); c.globalCompositeOperation = "lighter";
      const r = geom.W * 0.11;
      const b = c.createRadialGradient(cx, cy - r, 4, cx, cy - r, r);
      b.addColorStop(0, "#ffffff"); b.addColorStop(1, PURPLE);
      c.fillStyle = b; c.beginPath(); c.arc(cx, cy - r, r, 0, Math.PI * 2); c.fill();
      c.restore();
      c.font = `${Math.round(geom.W * 0.13)}px system-ui`; c.textAlign = "center"; c.textBaseline = "middle";
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
        const col = fv ? GOLD : (flower ? (arc ? F_MAG : F_PINK) : sunset ? (arc ? S_ORANGE : S_GOLD) : (arc ? CYAN : PINK));
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
    if (n.item) { drawItemNote(c, x, y, n, t); return; }
    const base = n._gold ? 36 : 29;
    const a = base * (1 + Math.sin(t * 3 + n._bob) * 0.05);
    const dt = Math.abs(NT() - n.time);
    if (dt < CUT.good) {
      const k = 1 - dt / CUT.good;
      c.save(); c.globalCompositeOperation = "lighter";
      // 日落: 光圈用暖金、更淡更细, 不再是突兀的大白圈
      if (sunset) { c.strokeStyle = hexA(S_GOLD, 0.05 + k * 0.24); c.lineWidth = 1.5; }
      else { c.strokeStyle = hexA("#ffffff", 0.2 + k * 0.55); c.lineWidth = 2.5; }
      c.beginPath(); c.arc(x, y, lerp(a + 40, a + 8, k), 0, Math.PI * 2); c.stroke();
      c.restore();
    }
    c.save(); c.translate(x, y); c.rotate(Math.sin(t * 1.3 + n._bob) * 0.08);
    drawShape(c, n._shape, a, n._col, t, n._spec, true);
    c.restore();
  }

  // ===== 隐藏道具方块 =====
  function drawItemNote(c, x, y, n, t) {
    const a = 30 * (1 + Math.sin(t * 3 + n._bob) * 0.06);
    const dt = Math.abs(NT() - n.time);
    if (dt < CUT.good) {                              // 逼近判定的白环(提示时机)
      const k = 1 - dt / CUT.good;
      c.save(); c.globalCompositeOperation = "lighter";
      c.strokeStyle = hexA("#ffffff", 0.2 + k * 0.55); c.lineWidth = 2.5;
      c.beginPath(); c.arc(x, y, lerp(a + 40, a + 8, k), 0, Math.PI * 2); c.stroke();
      c.restore();
    }
    c.save(); c.translate(x, y); c.rotate(Math.sin(t * 1.3 + n._bob) * 0.06);
    if (n.item === "bomb") { flower ? drawSpikeBall(c, a, t, n._spec) : drawBomb(c, a, t, n._spec); } // 花海: 带刺障碍
    else if (n.item === "bonus") drawBonus(c, a, t, n._spec);
    else drawFreeze(c, a, t, n._spec);
    c.restore();
  }

  function drawBomb(c, a, t, spec) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 8 + spec);
    c.save(); c.globalCompositeOperation = "lighter";  // 危险红光晕(急促闪)
    const gg = c.createRadialGradient(0, 0, 2, 0, 0, a * 1.9);
    gg.addColorStop(0, hexA(RED, 0.45 + pulse * 0.3)); gg.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = gg; c.beginPath(); c.arc(0, 0, a * 1.9, 0, Math.PI * 2); c.fill();
    c.restore();
    const rg = c.createRadialGradient(-a * 0.32, -a * 0.32, 2, 0, 0, a);
    rg.addColorStop(0, "#585866"); rg.addColorStop(0.6, "#1b1b24"); rg.addColorStop(1, "#050508");
    c.fillStyle = rg; c.beginPath(); c.arc(0, 0, a, 0, Math.PI * 2); c.fill();
    c.strokeStyle = hexA(RED, 0.85); c.lineWidth = 2.2; c.shadowColor = RED; c.shadowBlur = 14; c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = hexA("#ffffff", 0.5);                // 高光点
    c.beginPath(); c.arc(-a * 0.34, -a * 0.34, a * 0.16, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#c98a3a"; c.lineWidth = 3; c.lineCap = "round";  // 引线
    c.beginPath(); c.moveTo(0, -a * 0.92); c.quadraticCurveTo(a * 0.5, -a * 1.4, a * 0.3, -a * 1.72); c.stroke();
    c.save(); c.globalCompositeOperation = "lighter";  // 火花
    const sr = a * 0.3 * (0.7 + pulse * 0.6);
    const sg = c.createRadialGradient(a * 0.3, -a * 1.72, 1, a * 0.3, -a * 1.72, sr * 2);
    sg.addColorStop(0, "#ffffff"); sg.addColorStop(0.4, GOLD); sg.addColorStop(1, "rgba(255,60,0,0)");
    c.fillStyle = sg; c.beginPath(); c.arc(a * 0.3, -a * 1.72, sr * 2, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  function drawBonus(c, a, t, spec) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 6 + spec);
    c.save(); c.globalCompositeOperation = "lighter";
    c.strokeStyle = hexA(GOLD, 0.5); c.lineWidth = 2; c.shadowColor = GOLD; c.shadowBlur = 16;  // 旋转光芒
    for (let i = 0; i < 8; i++) {
      const ang = t * 1.6 + i * Math.PI / 4, r0 = a * 1.05, r1 = a * (1.5 + pulse * 0.3);
      c.beginPath(); c.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0); c.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1); c.stroke();
    }
    const gg = c.createRadialGradient(0, 0, 2, 0, 0, a * 1.45);
    gg.addColorStop(0, hexA(GOLD, 0.6)); gg.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = gg; c.beginPath(); c.arc(0, 0, a * 1.45, 0, Math.PI * 2); c.fill();
    c.restore();
    const rg = c.createRadialGradient(-a * 0.3, -a * 0.3, 2, 0, 0, a);  // 金盘
    rg.addColorStop(0, "#fff7d6"); rg.addColorStop(0.5, GOLD); rg.addColorStop(1, "#c8901a");
    c.fillStyle = rg; c.beginPath(); c.arc(0, 0, a, 0, Math.PI * 2); c.fill();
    c.strokeStyle = hexA("#ffffff", 0.85); c.lineWidth = 2; c.stroke();
    itemGlyph(c, "⚡", a * 1.15, "#7a4a00");
  }

  function drawFreeze(c, a, t, spec) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 4 + spec);
    c.save(); c.globalCompositeOperation = "lighter";
    const gg = c.createRadialGradient(0, 0, 2, 0, 0, a * 1.7);
    gg.addColorStop(0, hexA(CYAN, 0.5 + pulse * 0.2)); gg.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = gg; c.beginPath(); c.arc(0, 0, a * 1.7, 0, Math.PI * 2); c.fill();
    c.restore();
    c.save(); c.rotate(t * 0.6);                        // 冰晶六边形
    c.beginPath();
    for (let i = 0; i < 6; i++) { const ang = i * Math.PI / 3, px = Math.cos(ang) * a, py = Math.sin(ang) * a; i ? c.lineTo(px, py) : c.moveTo(px, py); }
    c.closePath();
    const rg = c.createLinearGradient(-a, -a, a, a);
    rg.addColorStop(0, "#eaffff"); rg.addColorStop(0.5, hexA(CYAN, 0.75)); rg.addColorStop(1, hexA("#5ad6ff", 0.5));
    c.fillStyle = rg; c.shadowColor = CYAN; c.shadowBlur = 18; c.fill();
    c.strokeStyle = hexA("#ffffff", 0.85); c.lineWidth = 1.6; c.stroke();
    c.restore();
    itemGlyph(c, "❄", a * 1.1, "#0a5a70");
  }

  function itemGlyph(c, ch, size, shadow) {
    c.save(); c.globalCompositeOperation = "source-over";
    c.fillStyle = "#ffffff"; c.shadowColor = shadow; c.shadowBlur = 6;
    c.font = `${Math.round(size)}px system-ui`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(ch, 0, size * 0.06);
    c.restore();
  }

  // 以原点为中心画: neon => 水晶方块/音符环/宝石; flower => 樱花/水晶花/莲花
  function drawShape(c, shape, a, col, t, spec, note) {
    // 花海: 背景明亮, 用正常混合(否则 lighter 叠加会把花朵冲成白团); 霓虹保持发光叠加
    if (flower) { c.globalCompositeOperation = "source-over"; flowerShape(c, shape, a, col, t, spec); return; }
    if (sunset) { sunsetShape(c, shape, a, col); return; }   // 日落: 发光金色音符
    c.globalCompositeOperation = "lighter";
    if (shape === 0) { glassCube(c, a, col, note); }
    else if (shape === 1) { noteRing(c, a, col, t, spec); }
    else { gemCrystal(c, a, col, t, spec, note); }
  }

  // 日落: 立体发光音符(♪/♫/♩) — 暖金渐变 + 深描边(亮背景上清晰) + 光晕, 贴合海报满屏金色音符
  function sunsetShape(c, shape, a, col) {
    const glyph = ["♪", "♫", "♩"][shape] || "♪";
    // 暖金光晕(叠加发光)
    c.save(); c.globalCompositeOperation = "lighter";
    const R = a * 1.5;
    const gl = c.createRadialGradient(0, 0, 2, 0, 0, R);
    gl.addColorStop(0, hexA(col, 0.5)); gl.addColorStop(0.55, hexA(col, 0.16)); gl.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = gl; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
    c.restore();
    // 音符本体
    c.save(); c.globalCompositeOperation = "source-over";
    c.textAlign = "center"; c.textBaseline = "middle"; c.lineJoin = "round";
    c.font = `900 ${Math.round(a * 2.2)}px system-ui, sans-serif`;
    c.lineWidth = a * 0.3; c.strokeStyle = "rgba(86,28,4,0.92)";  // 深棕描边压住亮天空
    c.strokeText(glyph, 0, a * 0.08);
    const gg = c.createLinearGradient(0, -a, 0, a);
    gg.addColorStop(0, "#fff3c8"); gg.addColorStop(0.45, col); gg.addColorStop(1, "#ff6a1a");
    c.fillStyle = gg; c.fillText(glyph, 0, a * 0.08);
    c.restore();
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
    c.strokeStyle = hexA("#ffffff", 0.92); c.lineWidth = 2.2; c.shadowColor = col; c.shadowBlur = 10;
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
    c.strokeStyle = hexA(col, 0.9); c.lineWidth = 3; c.shadowColor = col; c.shadowBlur = 12;
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
    c.shadowColor = col; c.shadowBlur = 14;
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

  // ===== 霓虹螺旋刀光(更细的光刀 + 低开销发光) =====
  // 关键性能点: canvas 的 shadowBlur 极贵。原来 4 层大模糊 × 每段一次 => 主力掉帧源。
  // 现在只留 3 层, 且宽发光层不用 shadowBlur(靠 lighter 半透明叠加出光晕), 只有核心细带带一点点辉光。
  function drawBlade(c, t, fv) {
    const pts = [];
    for (const p of trail) { const af = 1 - (t - p.t) / TRAIL_LIFE; if (af > 0) pts.push({ x: p.x, y: p.y, af }); }
    if (pts.length < 2) return;
    c.save(); c.globalCompositeOperation = "lighter"; c.lineCap = "round"; c.lineJoin = "round";
    const passes = [
      { w: 16, blur: 0, alpha: 0.20, white: false },   // 外发光: 无 shadow, 纯叠加
      { w: 7,  blur: 0, alpha: 0.5,  white: false },   // 中层刀身
      { w: 2.6, blur: 6, alpha: 1.0, white: true },    // 白芯: 仅这层带一点辉光
    ];
    for (const pass of passes) {
      c.shadowBlur = pass.blur;                          // 每层设一次即可
      for (let i = 1; i < pts.length; i++) {
        const frac = i / (pts.length - 1), af = pts[i].af;
        const col = pass.white ? "#ffffff" : (fv ? GOLD : (flower ? fBladeCol(frac) : sunset ? sBladeCol(frac) : bladeCol(frac)));
        c.strokeStyle = withA(col, pass.alpha * af);
        c.lineWidth = Math.max(1, pass.w * (0.3 + frac * 0.7) * af);
        if (pass.blur) c.shadowColor = pass.white ? (fv ? GOLD : COOL) : col;
        const aP = pts[i - 1], bP = pts[i], mx = (aP.x + bP.x) / 2, my = (aP.y + bP.y) / 2;
        c.beginPath();
        if (i === 1) c.moveTo(aP.x, aP.y); else { const pa = pts[i - 2]; c.moveTo((pa.x + aP.x) / 2, (pa.y + aP.y) / 2); }
        c.quadraticCurveTo(aP.x, aP.y, mx, my); c.stroke();
      }
    }
    c.shadowBlur = 0;
    const head = pts[pts.length - 1];
    const hg = c.createRadialGradient(head.x, head.y, 1, head.x, head.y, 14);
    hg.addColorStop(0, "#ffffff"); hg.addColorStop(0.4, withA(fv ? GOLD : COOL, 0.8)); hg.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = hg; c.beginPath(); c.arc(head.x, head.y, 14, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  function drawWeapon(c, t, fv) {
    if (trail.length < 2) return;
    const last = trail[trail.length - 1];
    if (t - last.t > 0.10) return;
    const prev = trail[trail.length - 2];
    const ang = Math.atan2(last.y - prev.y, last.x - prev.x);
    const glow = fv ? GOLD : COOL, hilt = fv ? PINK : (flower ? F_PINK : sunset ? S_RED : VIOLET), L = geom.H * 0.095, bw = 6.5;
    c.save(); c.translate(last.x, last.y); c.rotate(ang); c.globalCompositeOperation = "lighter";
    c.shadowColor = glow; c.shadowBlur = 12; c.fillStyle = hexA(glow, 0.5);
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
    c.fillStyle = "rgba(12,8,26,0.5)"; c.strokeStyle = hexA(flower ? F_PINK : sunset ? S_GOLD : CYAN, 0.5); c.lineWidth = 1.5;
    roundRectPath(c, x, y, w, h, 20); c.fill(); c.stroke();
    c.globalAlpha = 0.85 + Math.sin(t * 4) * 0.12;
    c.fillStyle = "#eaf2ff"; c.font = "800 15px system-ui"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(flower ? "滑动屏幕 · 挥刀切开飞舞的花朵" : "滑动屏幕 · 挥刀切开飞出的音符", geom.W / 2, y + h / 2);
    c.restore();
  }

  // 离场: 暂停正在解码的背景视频, 避免后台持续耗 CPU/GPU
  function destroy() { if (sunsetBg) sunsetBg.pause(); if (flowerBg) flowerBg.pause(); }
  return { draw, update, auto, laneTap, tap, pointer, destroy, lanes: 2, floor: false };
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
  c.save(); c.globalCompositeOperation = "lighter";   // 高光点: 去 shadowBlur(每方块 3 个, 累积不划算)
  c.fillStyle = "#ffffff";
  c.beginPath(); c.arc(p[0], p[1], 2.4, 0, Math.PI * 2); c.fill(); c.restore();
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

function fBladeCol(f) {
  return f < 0.5 ? lerpHex(F_PINK, F_GOLD, f / 0.5) : lerpHex(F_GOLD, F_MAG, (f - 0.5) / 0.5);
}

// 日落刀光: 亮金 -> 琥珀 -> 落日红
function sBladeCol(f) {
  return f < 0.5 ? lerpHex("#fff2b0", S_AMBER, f / 0.5) : lerpHex(S_AMBER, S_RED, (f - 0.5) / 0.5);
}

// ================= 花海: 花朵音符 / 花瓣 / 带刺障碍 =================
// 以原点为中心画花朵: 0樱花(5瓣) 1水晶花(6菱瓣) 2莲花(双层8瓣)
function flowerShape(c, shape, a, col, t, spec) {
  c.save(); c.rotate(Math.sin(t * 1.1 + spec) * 0.12);
  if (shape === 1) crystalFlower(c, a, col);
  else if (shape === 2) lotusFlower(c, a, col);
  else sakura(c, a, col);
  c.restore();
}

function flowerGlow(c, R, col) {
  const gg = c.createRadialGradient(0, 0, 2, 0, 0, R);
  gg.addColorStop(0, hexA(col, 0.5)); gg.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = gg; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
}
function flowerCore(c, a, glow) {
  c.fillStyle = "#fff3b0"; c.shadowColor = glow || "#ffe680"; c.shadowBlur = 10;
  c.beginPath(); c.arc(0, 0, a * 0.22, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
}

function sakura(c, a, col) {
  const R = a * 1.12;
  flowerGlow(c, R * 1.25, col);
  for (let i = 0; i < 5; i++) {
    c.save(); c.rotate(i * Math.PI * 2 / 5);
    const w = R * 0.52;
    const grad = c.createLinearGradient(0, 0, 0, -R);
    grad.addColorStop(0, hexA(col, 0.35)); grad.addColorStop(0.6, hexA(col, 0.95)); grad.addColorStop(1, "#ffffff");
    c.fillStyle = grad; c.shadowColor = col; c.shadowBlur = 14;
    c.beginPath(); c.moveTo(0, 0);
    c.quadraticCurveTo(-w, -R * 0.55, -w * 0.4, -R * 0.98);
    c.quadraticCurveTo(0, -R * 0.82, w * 0.4, -R * 0.98);   // 樱花瓣尖端小缺口
    c.quadraticCurveTo(w, -R * 0.55, 0, 0); c.fill();
    c.strokeStyle = hexA("#ffffff", 0.7); c.lineWidth = 1.1; c.stroke();
    c.restore();
  }
  c.shadowBlur = 0; flowerCore(c, a);
}

function crystalFlower(c, a, col) {
  const R = a * 1.16;
  flowerGlow(c, R * 1.2, col);
  for (let i = 0; i < 6; i++) {
    c.save(); c.rotate(i * Math.PI * 2 / 6);
    c.beginPath();
    c.moveTo(0, 0); c.lineTo(-a * 0.3, -R * 0.55); c.lineTo(0, -R); c.lineTo(a * 0.3, -R * 0.55); c.closePath();
    const grad = c.createLinearGradient(0, 0, 0, -R);
    grad.addColorStop(0, hexA(col, 0.6)); grad.addColorStop(0.5, "#ffffff"); grad.addColorStop(1, hexA(col, 0.85));
    c.fillStyle = grad; c.shadowColor = col; c.shadowBlur = 14; c.fill();
    c.strokeStyle = hexA("#ffffff", 0.85); c.lineWidth = 1.1; c.stroke();
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -R); c.strokeStyle = hexA("#ffffff", 0.55); c.lineWidth = 0.8; c.stroke();
    c.restore();
  }
  c.shadowBlur = 0;
  c.fillStyle = "#ffffff"; c.shadowColor = col; c.shadowBlur = 12;
  c.beginPath(); c.arc(0, 0, a * 0.2, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
}

function lotusFlower(c, a, col) {
  const R = a * 1.12;
  flowerGlow(c, R * 1.3, col);
  petalRing(c, 8, R, a * 0.42, col, Math.PI / 8, 0.8);       // 外层
  petalRing(c, 8, R * 0.68, a * 0.32, col, 0, 1.0);          // 内层
  flowerCore(c, a);
}
function petalRing(c, n, R, w, col, off, aMul) {
  for (let i = 0; i < n; i++) {
    c.save(); c.rotate(off + i * Math.PI * 2 / n);
    const grad = c.createLinearGradient(0, 0, 0, -R);
    grad.addColorStop(0, hexA(col, 0.3 * aMul)); grad.addColorStop(0.7, hexA(col, 0.9 * aMul)); grad.addColorStop(1, "#ffffff");
    c.fillStyle = grad; c.shadowColor = col; c.shadowBlur = 10;
    c.beginPath(); c.moveTo(0, 0);
    c.quadraticCurveTo(-w, -R * 0.6, 0, -R); c.quadraticCurveTo(w, -R * 0.6, 0, 0); c.fill();
    c.strokeStyle = hexA("#ffffff", 0.5); c.lineWidth = 1; c.stroke();
    c.restore();
  }
  c.shadowBlur = 0;
}

// 单片花瓣(飘落装饰)
function petal(c, s, col, a) {
  c.fillStyle = hexA(col, a); c.shadowColor = col; c.shadowBlur = 8;
  c.beginPath();
  c.moveTo(0, -s);
  c.quadraticCurveTo(s * 0.9, -s * 0.2, 0, s);
  c.quadraticCurveTo(-s * 0.9, -s * 0.2, 0, -s);
  c.fill(); c.shadowBlur = 0;
}

// 带刺障碍(替代炸弹): 旋转紫色尖刺球 + "!" 警示
function drawSpikeBall(c, a, t, spec) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 7 + spec);
  c.save(); c.globalCompositeOperation = "lighter";
  const gg = c.createRadialGradient(0, 0, 2, 0, 0, a * 2);
  gg.addColorStop(0, hexA(SPIKE, 0.4 + pulse * 0.3)); gg.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = gg; c.beginPath(); c.arc(0, 0, a * 2, 0, Math.PI * 2); c.fill();
  c.restore();
  c.save(); c.rotate(t * 1.2 + spec);
  const spikes = 12, R = a, tip = a * 1.55;
  c.beginPath();
  for (let i = 0; i < spikes; i++) {
    const a0 = i * Math.PI * 2 / spikes, a1 = (i + 0.5) * Math.PI * 2 / spikes;
    c.lineTo(Math.cos(a0) * R, Math.sin(a0) * R);
    c.lineTo(Math.cos(a1) * tip, Math.sin(a1) * tip);
  }
  c.closePath();
  c.fillStyle = "#3a0d5c"; c.strokeStyle = hexA(SPIKE, 0.95); c.lineWidth = 2;
  c.shadowColor = SPIKE; c.shadowBlur = 14; c.fill(); c.stroke();
  c.restore();
  const rg = c.createRadialGradient(-a * 0.3, -a * 0.3, 2, 0, 0, a);
  rg.addColorStop(0, "#b06bff"); rg.addColorStop(0.6, "#6a1fb0"); rg.addColorStop(1, "#2a0842");
  c.fillStyle = rg; c.shadowBlur = 0; c.beginPath(); c.arc(0, 0, a * 0.86, 0, Math.PI * 2); c.fill();
  c.fillStyle = hexA("#ffffff", 0.5);
  c.beginPath(); c.arc(-a * 0.3, -a * 0.3, a * 0.14, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#ffffff"; c.font = `900 ${Math.round(a * 0.8)}px system-ui`;
  c.textAlign = "center"; c.textBaseline = "middle";
  c.shadowColor = SPIKE; c.shadowBlur = 6; c.fillText("!", 0, a * 0.04); c.shadowBlur = 0;
}

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
