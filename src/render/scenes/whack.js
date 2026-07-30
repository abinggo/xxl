// 场景B · 疯狂敲钉: 钉子卡拍从洞里冒头, 点击一锤夯平; 炸弹是陷阱, 别砸
import { COLORS, approachTime } from "../config.js?v=1785392993";
import { hexA, roundRect } from "../stage.js?v=1785392993";
import { drawHero, drawShadow, drawTapCue, clamp, lerp, easeOut } from "./base.js?v=1785392993";

export function createWhack(stage, { ip, meta }) {
  const { geom } = stage;
  const approach = approachTime(meta.beatDur);
  let recent = null;

  function colorFor(j) { return j === "perfect" ? COLORS.perfect : j === "good" ? COLORS.good : COLORS.miss; }

  function resolve(ev, outcome, t) {
    recent = { t, outcome, judge: ev._judge };
    const x = geom.actionX, y = geom.floorY;
    if (outcome === "hit") {
      const c = colorFor(ev._judge);
      stage.fx.spawnBurst(x, y - 6, c, ev._judge === "perfect" ? 22 : 14, 1.4);
      stage.fx.spawnPop(x, y - 130, ev._judge.toUpperCase(), c);
      stage.shakeBy(ev._judge === "perfect" ? 5 : 3);
      if (ev._judge === "perfect") stage.flash(stage.colorA, 0.12);
    } else if (outcome === "miss") {
      stage.fx.spawnPop(x, y - 130, "MISS", COLORS.miss);
      stage.shakeBy(3);
    } else if (outcome === "avoid") {
      stage.fx.spawnPop(x, y - 120, "忍住!", COLORS.good);
    } else if (outcome === "traphit") {
      stage.fx.spawnBurst(x, y - 30, COLORS.trap, 24, 1.8);
      stage.fx.spawnPop(x, y - 130, "💥 炸了!", COLORS.trap);
      stage.shakeBy(10); stage.flash(COLORS.trap, 0.22);
    }
  }

  function draw(g) {
    const c = g.ctx, t = g.t;
    const y = geom.floorY, ax = geom.actionX, hx = geom.heroX;

    // 装饰洞位
    for (const dx of [-geom.W * 0.16, geom.W * 0.16]) drawHole(c, ax + dx, y, 0.8);
    drawHole(c, ax, y, 1);

    // 冒头的钉子/炸弹
    for (const ev of g.visible) {
      if (ev._done) continue;
      const p = clamp((t - (ev.time - approach)) / approach, 0, 1);
      if (p <= 0) continue;
      const rise = easeOut(p) * 50;
      if (ev.action === "trap") drawBomb(c, ax, y, rise);
      else drawNail(c, ax, y, rise);
    }

    drawShadow(c, hx, y + 2, 40);
    drawHero(c, { ip, x: hx, y, s: 44, t, pose: "whack", arm: armAmt(t), tool: "hammer" });

    // 出手提示(钉子冒到位时)
    let cue = 0;
    for (const ev of g.visible) {
      if (ev._done || ev.action === "trap") continue;
      const p = clamp((t - (ev.time - approach)) / approach, 0, 1.3);
      const d = Math.abs(p - 1);
      if (d < 0.22) cue = Math.max(cue, 1 - d / 0.22);
    }
    if (cue > 0) drawTapCue(c, ax, y - 40, cue);
  }

  function drawHole(c, x, y, s) {
    c.save();
    c.fillStyle = "rgba(0,0,0,0.55)";
    c.beginPath(); c.ellipse(x, y, 34 * s, 12 * s, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = hexA(stage.colorA, 0.5); c.lineWidth = 2;
    c.beginPath(); c.ellipse(x, y, 34 * s, 12 * s, 0, 0, Math.PI * 2); c.stroke();
    c.restore();
  }

  function drawNail(c, x, y, rise) {
    c.save();
    c.beginPath(); c.ellipse(x, y, 34, 12, 0, Math.PI, Math.PI * 2); c.clip(); // 只露出洞口以上
    c.restore();
    c.save();
    // 钉身
    const g = c.createLinearGradient(x, y - rise, x, y);
    g.addColorStop(0, "#f6f8ff"); g.addColorStop(1, "#aeb8d4");
    c.fillStyle = g;
    roundRect(c, x - 14, y - rise, 28, rise + 8, 8); c.fill();
    // 钉帽
    c.fillStyle = "#dfe6f7"; c.strokeStyle = "#8a94ad"; c.lineWidth = 2;
    roundRect(c, x - 20, y - rise - 10, 40, 16, 7); c.fill(); c.stroke();
    // 表情
    c.fillStyle = "#20143a";
    c.beginPath(); c.arc(x - 7, y - rise + 4, 2.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + 7, y - rise + 4, 2.4, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  function drawBomb(c, x, y, rise) {
    c.save();
    c.translate(x, y - rise - 6);
    const g = c.createRadialGradient(-6, -6, 4, 0, 0, 22);
    g.addColorStop(0, "#5a5f70"); g.addColorStop(1, "#1a1c26");
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 20, 0, Math.PI * 2); c.fill();
    // 引线 + 火花
    c.strokeStyle = "#caa14a"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(6, -16); c.quadraticCurveTo(18, -26, 12, -34); c.stroke();
    c.fillStyle = COLORS.trap; c.shadowColor = COLORS.gold; c.shadowBlur = 12;
    c.beginPath(); c.arc(12, -36, 4, 0, Math.PI * 2); c.fill();
    // 警示脸
    c.shadowBlur = 0; c.fillStyle = "#fff";
    c.font = "700 16px system-ui"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("✕", 0, 1);
    c.restore();
  }

  function armAmt(t) {
    if (recent && recent.outcome === "hit" && t - recent.t < 0.16) return clamp((t - recent.t) / 0.16, 0, 1);
    if (recent && recent.outcome === "traphit" && t - recent.t < 0.16) return clamp((t - recent.t) / 0.16, 0, 1);
    // 平时举锤待命
    return 0;
  }

  return { draw, resolve };
}
