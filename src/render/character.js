// IP 角色: 用发光徽章 + emoji 面部渲染, 随节拍律动, 命中打拍, 全连庆祝
// 不依赖外部美术资源, 干净且有辨识度
export function createCharacter(ip) {
  let bounce = 0;       // 随 bass 的律动
  let punch = 0;        // 命中冲击(0..1 衰减)
  let mood = 1;         // 1 正常, miss 时短暂下沉
  let sway = 0;

  function onHit(good = true) { punch = 1; mood = good ? 1 : -1; }
  function onMiss() { punch = 0.5; mood = -1; }

  function update(bands) {
    bounce += ((bands.bass || 0) - bounce) * 0.4;
    punch *= 0.88;
    mood += ((1) - mood) * 0.06;
    sway += 0.03;
  }

  function draw(ctx, cx, cy, celebrate = 0) {
    const base = 46;
    const scale = 1 + bounce * 0.18 + punch * 0.22 + celebrate * 0.15;
    const r = base * scale;
    const yOff = -bounce * 10 - punch * 8 + (mood < 0 ? 6 : 0) + Math.sin(sway) * 3;
    const y = cy + yOff;

    ctx.save();
    // 光环
    const glow = ctx.createRadialGradient(cx, y, r * 0.4, cx, y, r * 2.2);
    glow.addColorStop(0, hexA(ip.color, 0.55));
    glow.addColorStop(0.5, hexA(ip.accent, 0.22));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, y, r * 2.2, 0, Math.PI * 2); ctx.fill();

    // 律动光圈
    ctx.strokeStyle = hexA(ip.accent, 0.5 + bounce * 0.5);
    ctx.lineWidth = 2 + bounce * 3;
    ctx.beginPath(); ctx.arc(cx, y, r * 1.35, 0, Math.PI * 2); ctx.stroke();

    // 徽章主体
    const body = ctx.createLinearGradient(cx - r, y - r, cx + r, y + r);
    body.addColorStop(0, ip.color);
    body.addColorStop(1, ip.accent);
    ctx.fillStyle = body;
    ctx.shadowColor = ip.color; ctx.shadowBlur = 30;
    roundRectCircle(ctx, cx, y, r);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 面部 emoji
    ctx.font = `${Math.round(r * 1.05)}px system-ui, "Apple Color Emoji", sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(ip.emoji, cx, y + r * 0.04);
    ctx.restore();
  }

  return { onHit, onMiss, update, draw };
}

function roundRectCircle(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
}
function hexA(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
