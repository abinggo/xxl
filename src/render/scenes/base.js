// 场景共享基座: IP 角色绘制(优先立绘贴图, 无则矢量回退) + 影子 + 缓动/提示工具
import { hexA, roundRect } from "../stage.js?v=1785339764";

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (x) => 1 - Math.pow(1 - x, 3);
export const easeIn = (x) => x * x * x;
export const easeOutBack = (x) => { const c = 2.2; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

// 地面/漂浮影子
export function drawShadow(ctx, x, y, r, alpha = 0.35) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// IP 角色: 立绘贴图(processSprite 产出 {src,w,h}) 优先, 无则圆润矢量角色
// opts: { ip, x, y(脚底), s(尺寸≈半身), t, pose, jump(0..1), squash(-1..1), tilt, flip(1/-1),
//         alpha, glow(bool), arm(0..1 矢量挥动) }
export function drawHero(ctx, opts) {
  const { ip, x, y, s = 46, t = 0 } = opts;
  const accent = ip?.accent || "#22e1ff";
  const pose = opts.pose || "idle";
  const flip = opts.flip || 1;
  const alpha = opts.alpha ?? 1;

  // 姿态 -> 形变
  let bob = Math.sin(t * 6) * 2;
  let sx = 1, sy = 1, yOff = 0, tilt = opts.tilt || 0, mouth = 0.5;
  let armR = -0.5, armL = -0.5;
  const jump = opts.jump || 0;

  if (pose === "jump") {
    yOff = -Math.sin(jump * Math.PI) * s * 1.9;
    sy = 1 + Math.sin(jump * Math.PI) * 0.16; sx = 2 - sy;
    armR = -1.5; armL = -1.5; mouth = 1; bob = 0;
  } else if (pose === "whack") {
    const p = opts.arm ?? 0;
    armR = lerp(-2.2, 0.5, easeOut(p)); armL = -0.3;
    sy = 1 - p * 0.12; sx = 1 + p * 0.12; mouth = p > 0.6 ? 1 : 0.4; bob = 0;
  } else if (pose === "slice") {
    const p = opts.arm ?? 0;
    armR = lerp(-2.4, 0.9, easeOut(p)); armL = -0.6; mouth = 0.8; bob = 0;
  } else if (pose === "fail") {
    tilt = 0.4; yOff = 4; sy = 0.9; sx = 1.1; mouth = -1; armR = 0.4; armL = 0.4;
  } else if (pose === "cheer") {
    yOff = -Math.abs(Math.sin(t * 10)) * 8; armR = -2.2; armL = -2.2; mouth = 1;
  }
  if (opts.squash) { sy *= 1 + opts.squash * 0.18; sx *= 1 - opts.squash * 0.14; }

  const sprite = ip?.sprite && ip.sprite.src ? ip.sprite : null;
  ctx.save();
  ctx.globalAlpha = alpha;

  if (sprite) {
    // ---- 立绘模式 ----
    const h = s * 3.05;
    const w = h * (sprite.w / sprite.h);
    ctx.translate(x, y + yOff + bob);
    ctx.rotate(tilt);
    ctx.scale(sx * flip, sy);
    // 身后辉光
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(0, -h * 0.5, s * 0.2, 0, -h * 0.5, h * 0.62);
    glow.addColorStop(0, hexA(accent, opts.glow === false ? 0.18 : 0.4));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, -h * 0.5, h * 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 立绘(脚底对齐 y)
    ctx.drawImage(sprite.src, -w / 2, -h, w, h);
    ctx.restore();
    return;
  }

  // ---- 矢量回退 ----
  const col = ip?.color || "#ffffff";
  const cx = x, cy = y - s * 0.9 + yOff + bob;
  ctx.translate(cx, cy); ctx.rotate(tilt); ctx.scale(sx * flip, sy);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(0, 0, s * 0.2, 0, 0, s * 1.3);
  glow.addColorStop(0, hexA(accent, 0.35)); glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, s * 1.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  drawArm(ctx, -s * 0.5, s * 0.1, armL, s, col, true);
  const bg = ctx.createLinearGradient(0, -s, 0, s);
  bg.addColorStop(0, "#ffffff"); bg.addColorStop(1, col);
  ctx.fillStyle = bg; ctx.strokeStyle = hexA("#000000", 0.18); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.8, s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(-s * 0.34, s * 0.96, s * 0.22, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(s * 0.34, s * 0.96, s * 0.22, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  const eyeY = -s * 0.12, ex = s * 0.28, er = s * 0.13;
  ctx.fillStyle = "#20143a";
  ctx.beginPath(); ctx.arc(-ex, eyeY, er, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(ex, eyeY, er, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(-ex + er * 0.3, eyeY - er * 0.3, er * 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(ex + er * 0.3, eyeY - er * 0.3, er * 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#20143a"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
  ctx.beginPath();
  if (mouth >= 0) ctx.arc(0, s * 0.18, s * (0.16 + mouth * 0.14), 0.1 * Math.PI, 0.9 * Math.PI);
  else ctx.arc(0, s * 0.34, s * 0.18, 1.15 * Math.PI, 1.85 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = hexA(accent, 0.5);
  ctx.beginPath(); ctx.arc(-s * 0.44, s * 0.06, s * 0.11, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.44, s * 0.06, s * 0.11, 0, Math.PI * 2); ctx.fill();
  drawArm(ctx, s * 0.5, s * 0.1, armR, s, col, false);
  ctx.restore();
}

// 出手提示: 目标进入判定窗口时画脉冲收缩环 + "!"(增强参与感)
export function drawTapCue(ctx, x, y, strength) {
  const k = clamp(strength, 0, 1);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const r = lerp(46, 20, k);
  ctx.strokeStyle = `rgba(255,216,77,${0.35 + k * 0.5})`; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  ctx.save();
  const s = 1 + k * 0.4;
  ctx.translate(x, y - 66); ctx.scale(s, s);
  ctx.font = "900 24px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = 5; ctx.strokeStyle = "rgba(8,4,18,0.9)"; ctx.strokeText("!", 0, 0);
  ctx.fillStyle = "#ffd84d"; ctx.shadowColor = "#ffd84d"; ctx.shadowBlur = 12; ctx.fillText("!", 0, 0);
  ctx.restore();
}

function drawArm(ctx, sx, sy, ang, s, col, back) {
  const len = s * 0.62;
  const ex = sx + Math.cos(ang) * len, ey = sy + Math.sin(ang) * len;
  ctx.save();
  ctx.strokeStyle = back ? shade(col, -14) : col;
  ctx.lineWidth = s * 0.16; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(ex, ey, s * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function shade(hex, d) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgb(${clamp(((n >> 16) & 255) + d, 0, 255)},${clamp(((n >> 8) & 255) + d, 0, 255)},${clamp((n & 255) + d, 0, 255)})`;
}
