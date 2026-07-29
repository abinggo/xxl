// 关卡A · 音符跳跃: 单键让 IP 沿霓虹音符圆盘不断往上跳(参考 音符跳跃.png)
// 输入: 单击/空格 = 起跳一次; 命中卡拍的音符盘 -> 弹起+爆光; trap=裂盘, 别点
import { COLORS } from "../config.js?v=1785348576";
import { hexA } from "../stage.js?v=1785348576";
import { drawHero, drawShadow, drawTapCue, clamp, lerp, easeOut } from "./base.js?v=1785348576";
import { judgeHit, WINDOWS } from "../../core/judge.js?v=1785348576";

export function createJump(stage, game) {
  const { geom } = stage;
  const approach = game.approach;
  const chart = game.chart;
  const cA = stage.colorA, cB = stage.colorB;
  let recent = null;       // {t, outcome, judge}
  let firstActive = 0;
  const ghosts = [];       // 起跳残影 {x,y,life,s}

  const laneX = () => geom.W * 0.5;
  const platformY = () => geom.H * 0.64;
  const spanY = () => geom.H * 0.60;
  const colorFor = (j) => j === "perfect" ? COLORS.perfect : j === "good" ? COLORS.good : COLORS.miss;

  // 事件在垂直通道上的坐标: p<=0 在底部, p=1 抵达角色平台, p>1 继续上升
  function posOf(ev, t) {
    const p = (t - (ev.time - approach)) / approach;
    const x = laneX() + Math.sin(p * 2.4) * geom.W * 0.05;
    const y = platformY() + (1 - p) * spanY();
    return { p, x, y };
  }

  // ---- 输入 ----
  function tap() {
    const t = game.inputTime();
    if (t < -0.2) return;
    let best = -1, bestD = Infinity;
    for (let i = firstActive; i < chart.length; i++) {
      const n = chart[i];
      if (n.time - t > WINDOWS.miss) break;
      if (n._done) continue;
      const d = Math.abs(n.time - t);
      if (d <= WINDOWS.miss && d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) { game.breakCombo(); stage.fx.spawnPop(laneX(), platformY() - 120, "空跳", "#8aa"); return; }
    resolveTap(chart[best], t);
  }

  function resolveTap(n, t) {
    n._done = true; n._rt = t;
    const x = laneX(), y = platformY();
    if (n.action === "trap") {
      n._judge = "miss"; recent = { t, outcome: "traphit" };
      game.judge("miss");
      stage.fx.spawnBurst(x, y, COLORS.trap, 20, 1.6);
      stage.fx.spawnPop(x, y - 150, "踩空!", COLORS.trap);
      stage.shakeBy(8); stage.flash(COLORS.trap, 0.18);
      return;
    }
    let j = judgeHit(n.time, t) || "miss";
    n._judge = j; recent = { t, outcome: j === "miss" ? "miss" : "hit", judge: j };
    game.judge(j);
    if (j === "miss") {
      stage.fx.spawnPop(x, y - 150, "MISS", COLORS.miss); stage.shakeBy(4);
    } else {
      const c = colorFor(j);
      launchFx(x, y, c, j === "perfect");
      stage.fx.spawnPop(x, y - 160, j.toUpperCase(), c);
      stage.shakeBy(j === "perfect" ? 4 : 2);
      if (j === "perfect") stage.flash(cA, 0.12);
    }
  }

  function launchFx(x, y, c, perfect) {
    stage.fx.spawnBurst(x, y, c, perfect ? 28 : 16, 1.6);
    stage.fx.spawnBurst(x, y, "#fff", 8, 1.1);
    for (let i = 0; i < 4; i++) ghosts.push({ x, y, life: 1, s: 44 });
  }

  function auto(t) {
    for (let i = firstActive; i < chart.length; i++) {
      const n = chart[i];
      if (n._done) continue;
      if (n.time > t) break;
      if (n.action === "trap") continue;
      resolveTap(n, n.time);
    }
  }

  // ---- 逐帧推进: 过期音符自动结算 ----
  function update(t) {
    while (firstActive < chart.length) {
      const n = chart[firstActive];
      if (n._done) { firstActive++; continue; }
      if (n.time < t - WINDOWS.miss) {
        n._done = true; n._rt = t;
        if (n.action === "trap") { n._judge = "perfect"; recent = { t, outcome: "avoid" }; game.judge("perfect", { silent: true }); stage.fx.spawnPop(laneX(), platformY() - 120, "稳!", COLORS.good); }
        else { n._judge = "miss"; recent = { t, outcome: "miss" }; game.judge("miss", { silent: true }); stage.fx.spawnPop(laneX(), platformY() - 150, "MISS", COLORS.miss); }
        firstActive++;
      } else break;
    }
    for (let i = ghosts.length - 1; i >= 0; i--) { ghosts[i].life -= 0.08; ghosts[i].y -= 6; if (ghosts[i].life <= 0) ghosts.splice(i, 1); }
  }

  // ---- 绘制 ----
  function draw(g) {
    const c = g.ctx, t = g.t;
    const x0 = laneX(), py = platformY();
    const bass = (g.bands && g.bands.bass) || 0;

    drawSpiral(c, x0, py, t, bass);          // 背景螺旋光带
    drawColumnGuide(c, x0, py, t);           // 通道竖光

    // 可见音符盘(远的先画)
    const vis = [];
    for (let i = firstActive; i < chart.length; i++) {
      const n = chart[i];
      const p = (t - (n.time - approach)) / approach;
      if (p > 1.7) continue;
      if (n.time - approach > t + 0.05) break;
      if (!n._done || p < 1.6) vis.push(n);
    }
    vis.sort((a, b) => b.time - a.time);
    for (const n of vis) {
      const { p, x, y } = posOf(n, t);
      if (p < -0.2) continue;
      const alpha = p > 1 ? clamp(1.6 - p, 0, 1) : 1;
      if (n._done && p <= 1.05) continue; // 已命中的近盘不再画
      drawDisc(c, x, y, n.action === "trap", t, alpha, lerp(0.55, 1, clamp(p, 0, 1)));
    }

    // 起跳残影
    for (const gh of ghosts) {
      drawHero(c, { ip: game.ip, x: gh.x, y: gh.y, s: gh.s, t, pose: "jump", jump: 0.5, alpha: gh.life * 0.4, glow: false });
    }

    // 当前脚下的盘 + 角色
    drawDisc(c, x0, py + 6, false, t, 1, 1.05, true);
    drawShadow(c, x0, py + 10, 42 * (jumpAmt(t) ? 0.6 : 1));
    drawHero(c, { ip: game.ip, x: x0, y: py, s: 46, t, pose: heroPose(t), jump: jumpAmt(t) });

    // 出手提示
    const cue = tapCue(t);
    if (cue > 0) drawTapCue(c, x0, py - 70, cue);
  }

  function drawSpiral(c, x, y, t, bass) {
    c.save();
    c.globalCompositeOperation = "lighter";
    c.lineWidth = 6;
    for (let s = 0; s < 2; s++) {
      const dir = s === 0 ? 1 : -1;
      c.strokeStyle = hexA(s === 0 ? COLORS.gold : cB, 0.5);
      c.beginPath();
      for (let i = 0; i <= 60; i++) {
        const u = i / 60;
        const ang = dir * (u * 7 + t * 1.6);
        const rad = (18 + u * geom.W * 0.16) * (1 + bass * 0.25);
        const px = x + Math.cos(ang) * rad;
        const py = y - u * spanY() * 0.9 + Math.sin(ang) * 10;
        i ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.stroke();
    }
    c.restore();
  }

  function drawColumnGuide(c, x, y, t) {
    c.save();
    c.globalCompositeOperation = "lighter";
    const g = c.createLinearGradient(x, y - spanY(), x, y + 40);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, hexA(cA, 0.12));
    c.fillStyle = g; c.fillRect(x - 90, y - spanY(), 180, spanY() + 40);
    c.restore();
  }

  function drawDisc(c, x, y, trap, t, alpha, scale, active) {
    const rx = 62 * scale, ry = 20 * scale;
    c.save();
    c.globalAlpha = alpha;
    c.translate(x, y);
    // 盘体
    c.save();
    c.globalCompositeOperation = "lighter";
    const grad = c.createRadialGradient(0, 0, 2, 0, 0, rx);
    if (trap) { grad.addColorStop(0, "#ffb0b0"); grad.addColorStop(1, hexA(COLORS.trap, 0)); }
    else { grad.addColorStop(0, "#ffffff"); grad.addColorStop(0.4, cA); grad.addColorStop(1, hexA(cB, 0)); }
    c.fillStyle = grad;
    c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    // 盘环
    c.lineWidth = 3 + (active ? 1.5 + Math.sin(t * 8) : 0);
    c.strokeStyle = trap ? COLORS.trap : hexA(COLORS.gold, 0.95);
    c.shadowColor = trap ? COLORS.trap : COLORS.gold; c.shadowBlur = 14;
    c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); c.stroke();
    c.shadowBlur = 0;
    // 符号
    c.fillStyle = trap ? "#fff" : "#3a1c00";
    c.font = `900 ${Math.round(22 * scale)}px system-ui`;
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(trap ? "✕" : "♪", 0, 0);
    c.restore();
  }

  function tapCue(t) {
    let best = 0;
    for (let i = firstActive; i < chart.length; i++) {
      const n = chart[i];
      if (n._done || n.action === "trap") continue;
      const p = (t - (n.time - approach)) / approach;
      const d = Math.abs(p - 1);
      if (d < 0.22) best = Math.max(best, 1 - d / 0.22);
      if (n.time - approach > t + 0.05) break;
    }
    return best;
  }

  function jumpAmt(t) {
    if (recent && recent.outcome === "hit" && t - recent.t < 0.36) return clamp((t - recent.t) / 0.36, 0, 1);
    return 0;
  }
  function heroPose(t) {
    if (recent && (recent.outcome === "miss" || recent.outcome === "traphit") && t - recent.t < 0.4) return "fail";
    if (recent && recent.outcome === "hit" && t - recent.t < 0.36) return "jump";
    return "idle";
  }

  return { draw, update, auto, tap, floor: false };
}
