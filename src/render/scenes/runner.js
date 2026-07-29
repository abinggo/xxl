// 场景A · 跨栏闯关: 霓虹光环卡拍飞来, 点击让 IP 跳跃穿过(呼应节奏天国排队过环)
import { COLORS, approachTime } from "../config.js?v=1785345155";
import { hexA } from "../stage.js?v=1785345155";
import { drawHero, drawShadow, drawTapCue, clamp, lerp, easeOut } from "./base.js?v=1785345155";

export function createRunner(stage, { ip, meta }) {
  const { geom } = stage;
  const approach = approachTime(meta.beatDur);
  let recent = null; // {t, outcome, judge}

  function colorFor(j) { return j === "perfect" ? COLORS.perfect : j === "good" ? COLORS.good : COLORS.miss; }

  function resolve(ev, outcome, t) {
    recent = { t, outcome, judge: ev._judge };
    const x = geom.heroX, y = geom.floorY;
    if (outcome === "hit") {
      const c = colorFor(ev._judge);
      stage.fx.spawnBurst(x, y - 46, c, ev._judge === "perfect" ? 22 : 14, 1.3);
      stage.fx.spawnPop(x, y - 150, ev._judge.toUpperCase(), c);
      stage.shakeBy(ev._judge === "perfect" ? 4 : 2);
      if (ev._judge === "perfect") stage.flash(stage.colorA, 0.1);
    } else if (outcome === "miss") {
      stage.fx.spawnBurst(x, y - 20, COLORS.miss, 7, 0.8);
      stage.fx.spawnPop(x, y - 150, "MISS", COLORS.miss);
      stage.shakeBy(5);
    } else if (outcome === "avoid") {
      stage.fx.spawnPop(x + 60, y - 120, "稳!", COLORS.good);
    } else if (outcome === "traphit") {
      stage.fx.spawnBurst(x, y - 20, COLORS.trap, 12, 1);
      stage.fx.spawnPop(x, y - 150, "假动作!", COLORS.trap);
      stage.shakeBy(7);
    }
  }

  function draw(g) {
    const c = g.ctx;
    const t = g.t;
    const y = geom.floorY, hx = geom.heroX;

    // 进场光环(按 p 由远及近, 远的先画)
    const items = g.visible.filter((e) => !e._done).sort((a, b) => a.time - b.time).reverse();
    for (const ev of items) {
      const p = clamp((t - (ev.time - approach)) / approach, 0, 1.2);
      if (p < 0) continue;
      const x = lerp(g.W * 1.08, hx, p);
      const scale = lerp(0.5, 1, p);
      drawRing(c, x, y, scale, ev.action === "trap", t);
    }

    // 影子 + 角色
    drawShadow(c, hx, y + 2, 40 * (recentJump(t) ? 0.7 : 1));
    drawHero(c, { ip, x: hx, y, s: 44, t, pose: heroPose(t), jump: jumpAmt(t), tilt: 0 });

    // 出手提示(目标临近命中点时)
    const cue = tapCue(g, t);
    if (cue > 0) drawTapCue(c, hx, y - 60, cue);
  }

  // 最近的 go/hold 目标离命中点(p=1)的接近度 → 提示强度
  function tapCue(g, t) {
    let best = 0;
    for (const ev of g.visible) {
      if (ev._done || ev.action === "trap") continue;
      const p = clamp((t - (ev.time - approach)) / approach, 0, 1.3);
      const d = Math.abs(p - 1);
      if (d < 0.22) best = Math.max(best, 1 - d / 0.22);
    }
    return best;
  }

  function drawRing(c, x, y, scale, trap, t) {
    const rx = 40 * scale, ry = 52 * scale;
    c.save();
    c.translate(x, y - ry * 0.7);
    // 彩虹/霓虹环
    c.lineWidth = 8 * scale;
    if (trap) {
      c.strokeStyle = COLORS.trap; c.shadowColor = COLORS.trap; c.shadowBlur = 16;
      c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); c.stroke();
      // 禁止叉
      c.strokeStyle = "#fff"; c.lineWidth = 5 * scale;
      c.beginPath(); c.moveTo(-rx * 0.5, -ry * 0.5); c.lineTo(rx * 0.5, ry * 0.5);
      c.moveTo(rx * 0.5, -ry * 0.5); c.lineTo(-rx * 0.5, ry * 0.5); c.stroke();
    } else {
      const grad = c.createLinearGradient(-rx, -ry, rx, ry);
      grad.addColorStop(0, COLORS.cyan); grad.addColorStop(0.5, COLORS.violet); grad.addColorStop(1, COLORS.magenta);
      c.strokeStyle = grad; c.shadowColor = COLORS.violet; c.shadowBlur = 18;
      c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); c.stroke();
      c.globalCompositeOperation = "lighter";
      c.globalAlpha = 0.15; c.fillStyle = COLORS.violet;
      c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  function recentJump(t) { return recent && recent.outcome === "hit" && t - recent.t < 0.34; }
  function jumpAmt(t) {
    if (!recent) return 0;
    if (recent.outcome === "hit" && t - recent.t < 0.34) return clamp((t - recent.t) / 0.34, 0, 1);
    return 0;
  }
  function heroPose(t) {
    if (recent && (recent.outcome === "miss" || recent.outcome === "traphit") && t - recent.t < 0.4) return "fail";
    if (recent && recent.outcome === "hit" && t - recent.t < 0.34) return "jump";
    return "idle";
  }

  return { draw, resolve };
}
