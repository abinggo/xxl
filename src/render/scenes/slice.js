// 场景C · 音浪切片: 音符宝石抛物线飞来, 点击卡拍一刀劈开; 炸弹是陷阱, 别切
import { COLORS, approachTime } from "../config.js?v=1785387344";
import { hexA } from "../stage.js?v=1785387344";
import { drawHero, drawShadow, drawTapCue, clamp, lerp, easeOut } from "./base.js?v=1785387344";

export function createSlice(stage, { ip, meta }) {
  const { geom } = stage;
  const approach = approachTime(meta.beatDur);
  let recent = null, slash = null; // slash: {t, judge}

  function sliceY() { return geom.floorY - geom.H * 0.20; }
  function colorFor(j) { return j === "perfect" ? COLORS.perfect : j === "good" ? COLORS.good : COLORS.miss; }

  function resolve(ev, outcome, t) {
    recent = { t, outcome, judge: ev._judge };
    const x = geom.actionX, y = sliceY();
    if (outcome === "hit") {
      const c = colorFor(ev._judge);
      slash = { t, judge: ev._judge };
      stage.fx.spawnBurst(x, y, c, ev._judge === "perfect" ? 26 : 16, 1.5);
      stage.fx.spawnBurst(x, y, "#fff", 8, 1.1);
      stage.fx.spawnPop(x, y - 60, ev._judge.toUpperCase(), c);
      stage.shakeBy(ev._judge === "perfect" ? 4 : 2);
      if (ev._judge === "perfect") stage.flash(stage.colorA, 0.1);
    } else if (outcome === "miss") {
      stage.fx.spawnPop(x, y - 40, "MISS", COLORS.miss); stage.shakeBy(3);
    } else if (outcome === "avoid") {
      stage.fx.spawnPop(x, y - 40, "收刀!", COLORS.good);
    } else if (outcome === "traphit") {
      slash = { t, judge: "miss" };
      stage.fx.spawnBurst(x, y, COLORS.trap, 22, 1.6);
      stage.fx.spawnPop(x, y - 40, "💥 别切炸弹!", COLORS.trap);
      stage.shakeBy(9); stage.flash(COLORS.trap, 0.2);
    }
  }

  function draw(g) {
    const c = g.ctx, t = g.t;
    const sy = sliceY(), ax = geom.actionX, hx = geom.heroX, y = geom.floorY;

    // 切割基准线
    c.save();
    c.globalCompositeOperation = "lighter";
    c.strokeStyle = hexA(stage.colorA, 0.25); c.lineWidth = 2; c.setLineDash([6, 8]);
    c.beginPath(); c.moveTo(ax - 120, sy); c.lineTo(ax + 30, sy); c.stroke();
    c.restore();

    // 飞行物
    for (const ev of g.visible) {
      if (ev._done) continue;
      const p = clamp((t - (ev.time - approach)) / approach, 0, 1);
      if (p <= 0) continue;
      const x = lerp(g.W * 1.08, ax, p);
      const yy = lerp(y - 10, sy, p) - Math.sin(p * Math.PI) * geom.H * 0.12;
      if (ev.action === "trap") drawBomb(c, x, yy, t);
      else drawGem(c, x, yy, t, ev.action === "hold");
    }

    // 刀光
    if (slash && t - slash.t < 0.16) {
      const a = 1 - (t - slash.t) / 0.16;
      c.save(); c.globalCompositeOperation = "lighter";
      c.strokeStyle = hexA(colorFor(slash.judge), a); c.lineWidth = 6;
      c.shadowColor = "#fff"; c.shadowBlur = 20;
      c.beginPath(); c.moveTo(ax - 70, sy + 60); c.lineTo(ax + 60, sy - 70); c.stroke();
      c.restore();
    }

    drawShadow(c, hx, y + 2, 40);
    drawHero(c, { ip, x: hx, y, s: 44, t, pose: "slice", arm: armAmt(t), tool: "blade" });

    // 出手提示(宝石飞到切割线时)
    let cue = 0;
    for (const ev of g.visible) {
      if (ev._done || ev.action === "trap") continue;
      const p = clamp((t - (ev.time - approach)) / approach, 0, 1.3);
      const d = Math.abs(p - 1);
      if (d < 0.22) cue = Math.max(cue, 1 - d / 0.22);
    }
    if (cue > 0) drawTapCue(c, ax, sy, cue);
  }

  function drawGem(c, x, y, t, hold) {
    const r = hold ? 24 : 20;
    c.save(); c.translate(x, y); c.rotate(t * 3);
    c.globalCompositeOperation = "lighter";
    const g = c.createRadialGradient(0, 0, 2, 0, 0, r * 1.3);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.5, stage.colorA); g.addColorStop(1, stage.colorB);
    c.fillStyle = g; c.shadowColor = stage.colorB; c.shadowBlur = 16;
    c.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const px = Math.cos(a) * r, py = Math.sin(a) * r; i ? c.lineTo(px, py) : c.moveTo(px, py); }
    c.closePath(); c.fill();
    c.restore();
    // 音符符号
    c.save(); c.translate(x, y);
    c.fillStyle = "#20143a"; c.font = `700 ${Math.round(r * 1.1)}px system-ui`;
    c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("♪", 0, 1);
    c.restore();
  }

  function drawBomb(c, x, y, t) {
    c.save(); c.translate(x, y); c.rotate(Math.sin(t * 4) * 0.2);
    const g = c.createRadialGradient(-5, -5, 3, 0, 0, 20);
    g.addColorStop(0, "#5a5f70"); g.addColorStop(1, "#15171f");
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 18, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#caa14a"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(6, -14); c.quadraticCurveTo(16, -22, 11, -30); c.stroke();
    c.fillStyle = COLORS.trap; c.shadowColor = COLORS.gold; c.shadowBlur = 10;
    c.beginPath(); c.arc(11, -31, 3.5, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0; c.fillStyle = "#fff"; c.font = "700 15px system-ui";
    c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("✕", 0, 1);
    c.restore();
  }

  function armAmt(t) {
    if (recent && (recent.outcome === "hit" || recent.outcome === "traphit") && t - recent.t < 0.16)
      return clamp((t - recent.t) / 0.16, 0, 1);
    return 0;
  }

  return { draw, resolve };
}
