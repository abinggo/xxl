// 关卡B · 敲击工坊: 节奏大师式 4 轨下落钉子, 落到判定线按对应键/点该列一锤夯平
// (参考 敲击工坊.png, 酷狗蓝狗) 输入: d/f/j/k 或点击某一列; 炸弹别敲
import { COLORS } from "../config.js?v=1785336948";
import { hexA, roundRect } from "../stage.js?v=1785336948";
import { drawHero, drawShadow, clamp, lerp, easeOut } from "./base.js?v=1785336948";
import { judgeHit, WINDOWS } from "../../core/judge.js?v=1785336948";

const LANES = 4;
const LANE_ORDER = [0, 2, 1, 3, 1, 0, 3, 2, 0, 1, 2, 3]; // 事件轨位分布

export function createWhackShop(stage, game) {
  const { geom } = stage;
  const approach = game.approach;
  const chart = game.chart;
  const cA = stage.colorA, cB = stage.colorB;
  let firstActive = 0;
  let smash = null;        // {t, lane, judge}
  let heroArm = null;      // {t}
  // 分配轨位
  chart.forEach((n, i) => { if (n.lane == null) n.lane = LANE_ORDER[i % LANE_ORDER.length]; });

  const topY = () => geom.H * 0.12;
  const hitY = () => geom.H * 0.80;
  const laneW = () => Math.min(96, geom.W * 0.15);
  const laneCX = (lane) => geom.W * 0.5 + (lane - (LANES - 1) / 2) * laneW();
  const colorFor = (j) => j === "perfect" ? COLORS.perfect : j === "good" ? COLORS.good : COLORS.miss;

  // ---- 输入 ----
  function laneTap(lane) {
    const t = game.inputTime();
    if (t < -0.2) return;
    let best = -1, bestD = Infinity;
    for (let i = firstActive; i < chart.length; i++) {
      const n = chart[i];
      if (n.time - t > WINDOWS.miss) break;
      if (n._done || n.lane !== lane) continue;
      const d = Math.abs(n.time - t);
      if (d <= WINDOWS.miss && d < bestD) { bestD = d; best = i; }
    }
    heroArm = { t: game.t };
    if (best < 0) { game.breakCombo(); popLane(lane, "空", "#8aa"); return; }
    resolve(chart[best], t);
  }

  function pointer(type, x) {
    if (type !== "down") return;
    // x -> 最近的轨
    let lane = 0, bd = Infinity;
    for (let l = 0; l < LANES; l++) { const d = Math.abs(x - laneCX(l)); if (d < bd) { bd = d; lane = l; } }
    laneTap(lane);
  }

  function resolve(n, t) {
    n._done = true; n._rt = t;
    const x = laneCX(n.lane), y = hitY();
    if (n.action === "trap") {
      n._judge = "miss"; smash = { t: game.t, lane: n.lane, judge: "miss" };
      game.judge("miss");
      stage.fx.spawnBurst(x, y, COLORS.trap, 24, 1.8);
      popLane(n.lane, "💥 炸了!", COLORS.trap);
      stage.shakeBy(10); stage.flash(COLORS.trap, 0.2);
      return;
    }
    let j = judgeHit(n.time, t) || "miss";
    n._judge = j; smash = { t: game.t, lane: n.lane, judge: j };
    game.judge(j);
    if (j === "miss") { popLane(n.lane, "MISS", COLORS.miss); stage.shakeBy(3); return; }
    const c = colorFor(j);
    stage.fx.spawnBurst(x, y, c, j === "perfect" ? 24 : 14, 1.5);
    stage.fx.spawnBurst(x, y, "#fff", 8, 1.1);
    popLane(n.lane, j.toUpperCase(), c);
    stage.shakeBy(j === "perfect" ? 5 : 3);
    if (j === "perfect") stage.flash(cA, 0.12);
  }

  function popLane(lane, text, color) { stage.fx.spawnPop(laneCX(lane), hitY() - 70, text, color); }

  function auto(t) {
    for (let i = firstActive; i < chart.length; i++) {
      const n = chart[i];
      if (n._done) continue;
      if (n.time > t) break;
      if (n.action === "trap") continue;
      resolve(n, n.time);
    }
  }

  function update(t) {
    while (firstActive < chart.length) {
      const n = chart[firstActive];
      if (n._done) { firstActive++; continue; }
      if (n.time < t - WINDOWS.miss) {
        n._done = true; n._rt = t;
        if (n.action === "trap") { n._judge = "perfect"; game.judge("perfect", { silent: true }); }
        else { n._judge = "miss"; game.judge("miss", { silent: true }); popLane(n.lane, "MISS", COLORS.miss); }
        firstActive++;
      } else break;
    }
  }

  // ---- 绘制 ----
  function draw(g) {
    const c = g.ctx, t = g.t;
    const hy = hitY(), ty = topY();

    drawHighway(c, t, g.bands);

    // 下落的钉子/炸弹(远的先画)
    const vis = [];
    for (let i = firstActive; i < chart.length; i++) {
      const n = chart[i];
      const p = (t - (n.time - approach)) / approach;
      if (n.time - approach > t + 0.05) break;
      if (n._done || p > 1.15) continue;
      vis.push({ n, p });
    }
    vis.sort((a, b) => a.p - b.p);
    for (const { n, p } of vis) {
      if (p < -0.1) continue;
      const x = laneCX(n.lane);
      const y = lerp(ty, hy, clamp(p, 0, 1.1));
      const sc = lerp(0.5, 1, clamp(p, 0, 1));
      if (n.action === "trap") drawBomb(c, x, y, sc, t);
      else drawNail(c, x, y, sc, t);
    }

    drawHitBar(c, t);

    // 砸锤特效
    if (smash && t - smash.t < 0.18) drawSmash(c, smash, t);

    // 酷狗蓝狗(左侧, 挥锤反应)
    const hx = geom.W * 0.12, hyy = geom.H * 0.66;
    drawShadow(c, hx, hyy + 8, 40);
    drawHero(c, { ip: game.ip, x: hx, y: hyy, s: 50, t, pose: "whack", arm: armAmt(t) });
  }

  function drawHighway(c, t, bands) {
    const ty = topY(), hy = hitY();
    c.save();
    // 每条轨道
    for (let l = 0; l < LANES; l++) {
      const x = laneCX(l), w = laneW() * 0.92;
      const g = c.createLinearGradient(0, ty, 0, hy);
      g.addColorStop(0, "rgba(255,255,255,0.02)");
      g.addColorStop(1, hexA(l % 2 ? cB : cA, 0.10));
      c.fillStyle = g; c.fillRect(x - w / 2, ty, w, hy - ty);
      c.strokeStyle = hexA(cA, 0.18); c.lineWidth = 1;
      c.strokeRect(x - w / 2, ty, w, hy - ty);
    }
    // 流动箭头(节奏引导)
    c.globalCompositeOperation = "lighter";
    const beat = ((t / (60 / (game.meta.bpm || 128) * 2)) % 1);
    for (let l = 0; l < LANES; l++) {
      const x = laneCX(l);
      for (let k = 0; k < 4; k++) {
        const u = ((k + beat) / 4);
        const y = lerp(ty, hy, u);
        c.globalAlpha = 0.12 * (1 - u) + 0.04;
        c.fillStyle = cA;
        c.beginPath(); c.moveTo(x - 10, y); c.lineTo(x + 10, y); c.lineTo(x, y + 12); c.closePath(); c.fill();
      }
    }
    c.globalAlpha = 1;
    c.restore();
  }

  function drawHitBar(c, t) {
    const hy = hitY();
    c.save();
    c.globalCompositeOperation = "lighter";
    const g = c.createLinearGradient(0, hy - 16, 0, hy + 16);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.5, hexA(cB, 0.6)); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.fillRect(laneCX(0) - laneW(), hy - 16, laneW() * (LANES + 1), 32);
    c.restore();
    // 每轨判定圈
    for (let l = 0; l < LANES; l++) {
      const x = laneCX(l);
      c.save();
      c.strokeStyle = hexA(COLORS.gold, 0.8); c.lineWidth = 3;
      c.shadowColor = COLORS.gold; c.shadowBlur = 10;
      c.beginPath(); c.arc(x, hy, 26, 0, Math.PI * 2); c.stroke();
      c.restore();
      // 键位提示
      c.save();
      c.fillStyle = "rgba(255,255,255,0.6)"; c.font = "700 12px system-ui";
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(["D", "F", "J", "K"][l], x, hy);
      c.restore();
    }
  }

  function drawNail(c, x, y, sc, t) {
    c.save(); c.translate(x, y);
    // 机器人钉体(酷狗绿眼小机器人)
    const r = 22 * sc;
    const g = c.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, "#eaf6ff"); g.addColorStop(1, "#b9c7e6");
    c.fillStyle = g; c.strokeStyle = hexA(cB, 0.7); c.lineWidth = 2;
    roundRect(c, -r * 0.8, -r, r * 1.6, r * 1.9, r * 0.7); c.fill(); c.stroke();
    // 绿眼
    c.fillStyle = "#39ff9e"; c.shadowColor = "#39ff9e"; c.shadowBlur = 10;
    c.font = `900 ${Math.round(r * 1.0)}px system-ui`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("^^", 0, -r * 0.05);
    c.restore();
  }

  function drawBomb(c, x, y, sc, t) {
    c.save(); c.translate(x, y); c.rotate(Math.sin(t * 5) * 0.15);
    const r = 20 * sc;
    const g = c.createRadialGradient(-5, -5, 3, 0, 0, r);
    g.addColorStop(0, "#5a5f70"); g.addColorStop(1, "#16181f");
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#caa14a"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(6, -r + 2); c.quadraticCurveTo(18, -r - 6, 12, -r - 14); c.stroke();
    c.fillStyle = COLORS.trap; c.shadowColor = COLORS.gold; c.shadowBlur = 10;
    c.beginPath(); c.arc(12, -r - 15, 3.5, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0; c.fillStyle = "#fff"; c.font = `900 ${Math.round(r * 0.8)}px system-ui`;
    c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("✕", 0, 1);
    c.restore();
  }

  function drawSmash(c, sm, t) {
    const x = laneCX(sm.lane), y = hitY();
    const p = clamp((t - sm.t) / 0.18, 0, 1);
    // 冲击波
    c.save(); c.globalCompositeOperation = "lighter";
    const col = colorFor(sm.judge);
    c.strokeStyle = hexA(col, 1 - p); c.lineWidth = 5;
    c.beginPath(); c.arc(x, y, 20 + p * 50, 0, Math.PI * 2); c.stroke();
    c.restore();
    // 锤子落下
    const drop = easeOut(p);
    c.save(); c.translate(x, y - 120 + drop * 96); c.rotate(-0.5 + drop * 0.5);
    c.fillStyle = "#cfd6e6"; roundRect(c, -34, -22, 68, 30, 8); c.fill();
    c.fillStyle = hexA(cB, 0.9); roundRect(c, -30, -18, 60, 22, 6); c.fill();
    c.fillStyle = "#8a94ad"; roundRect(c, -8, 6, 16, 60, 5); c.fill();
    c.fillStyle = COLORS.gold; c.font = "900 16px system-ui"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("★", 0, -6);
    c.restore();
  }

  function armAmt(t) { if (heroArm && t - heroArm.t < 0.18) return clamp((t - heroArm.t) / 0.18, 0, 1); return 0; }

  return { draw, update, auto, laneTap, pointer, lanes: LANES, floor: false };
}
