// 特效: 粒子对象池(圆点/宝石碎片) + 冲击波环 + 判定文字弹跳
// 零分配帧循环, 复用对象。对外原语: spawnBurst / spawnShards / spawnRing / spawnPop
export function createFx() {
  const MAX = 480;
  const pool = [];
  for (let i = 0; i < MAX; i++) pool.push({ active: false });
  const pops = [];  // 判定文字
  const rings = []; // 冲击波环

  function alloc() {
    for (let i = 0; i < MAX; i++) if (!pool[i].active) return pool[i];
    return null;
  }

  // 圆点爆发(通用火花)
  function spawnBurst(x, y, color, n = 14, power = 1) {
    for (let k = 0; k < n; k++) {
      const p = alloc(); if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const sp = (2 + Math.random() * 4) * power;
      p.active = true; p.kind = "dot"; p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - 1;
      p.life = 1; p.decay = 0.018 + Math.random() * 0.02;
      p.r = 2 + Math.random() * 3 * power; p.color = color;
      p.rot = 0; p.vr = 0; p.grav = 0.12;
    }
  }

  // 宝石/水晶碎片: 旋转的发光菱形, 向外飞散 + 较强重力(切碎音符用)
  function spawnShards(x, y, color, n = 10, power = 1.4) {
    for (let k = 0; k < n; k++) {
      const p = alloc(); if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const sp = (3 + Math.random() * 6) * power;
      p.active = true; p.kind = "shard"; p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - 2;
      p.life = 1; p.decay = 0.012 + Math.random() * 0.014;
      p.r = 4 + Math.random() * 7 * power; p.color = color;
      p.rot = Math.random() * Math.PI; p.vr = (Math.random() - 0.5) * 0.5; p.grav = 0.26;
    }
  }

  // 切成两半: 沿切线方向裂开的两块半晶体, 向两侧飞散 + 旋转下坠(水果忍者式)
  function spawnHalves(x, y, color, ang, size = 22) {
    for (const side of [-1, 1]) {
      const p = alloc(); if (!p) break;
      const perp = ang + Math.PI / 2;
      const sp = 2.6 + Math.random() * 1.6;
      p.active = true; p.kind = "half"; p.x = x; p.y = y;
      p.vx = Math.cos(perp) * sp * side; p.vy = Math.sin(perp) * sp * side - 1.6;
      p.life = 1; p.decay = 0.016 + Math.random() * 0.008;
      p.r = size; p.color = color; p.rot = ang; p.vr = (Math.random() - 0.5) * 0.14;
      p.grav = 0.30; p.cut = ang; p.side = side;
    }
  }

  // 刀锋掉落的细碎屑: 极小、短命、略微向下坠落(挥刀时沿轨迹掉一串火星)
  function spawnEmber(x, y, color) {
    const p = alloc(); if (!p) return;
    const a = Math.random() * Math.PI * 2;
    const sp = 0.6 + Math.random() * 1.6;
    p.active = true; p.kind = "dot"; p.x = x; p.y = y;
    p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp + 0.5;   // 略向下
    p.life = 1; p.decay = 0.035 + Math.random() * 0.03;
    p.r = 1.1 + Math.random() * 1.6; p.color = color;
    p.rot = 0; p.vr = 0; p.grav = 0.16;
  }

  // 冲击波环: 从命中点向外扩散
  function spawnRing(x, y, color, power = 1) {
    rings.push({ x, y, r: 8, vr: 6 + 4 * power, life: 1, decay: 0.045, color, lw: 4 + 3 * power });
  }

  // 判定文字: opts.size 字号, opts.rise 上升速度, opts.decay 衰减
  function spawnPop(x, y, text, color, opts = {}) {
    pops.push({ x, y, text, color, life: 1, size: opts.size || 26, rise: opts.rise ?? 1.1, decay: opts.decay ?? 0.02 });
  }

  function update() {
    for (let i = 0; i < MAX; i++) {
      const p = pool[i];
      if (!p.active) continue;
      p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.vx *= 0.98;
      if (p.kind === "shard" || p.kind === "half") p.rot += p.vr;
      p.life -= p.decay;
      if (p.life <= 0) p.active = false;
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.r += r.vr; r.vr *= 0.93; r.life -= r.decay;
      if (r.life <= 0) rings.splice(i, 1);
    }
    for (let i = pops.length - 1; i >= 0; i--) {
      const q = pops[i];
      q.y -= q.rise; q.life -= q.decay;
      if (q.life <= 0) pops.splice(i, 1);
    }
  }

  function draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    // 冲击波环(数量少, 保留一点辉光)
    for (const r of rings) {
      ctx.globalAlpha = Math.max(0, r.life) * 0.85;
      ctx.strokeStyle = r.color; ctx.lineWidth = Math.max(1, r.lw * r.life);
      ctx.shadowColor = r.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    // 粒子: shadowBlur 极贵且这里数量可达数百 => 命中爆发时正是掉帧点。
    // 全部改为无 shadow, 用 "lighter" 叠加本身就自带发光观感, 帧率大幅回稳。
    for (let i = 0; i < MAX; i++) {
      const p = pool[i];
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, p.life);
      if (p.kind === "half") {
        // 半块晶体: 沿切线为直边的半多边形 + 亮切口
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.cut);
        const s = p.r * (0.65 + p.life * 0.35), dir = p.side;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(-s, 0); ctx.lineTo(-s * 0.5, dir * s); ctx.lineTo(s * 0.5, dir * s); ctx.lineTo(s, 0);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.stroke();
        ctx.restore();
      } else if (p.kind === "shard") {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        const s = p.r * (0.5 + p.life * 0.5);
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.lineTo(s * 0.66, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.66, 0);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    // 判定文字
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    for (const q of pops) {
      ctx.globalAlpha = Math.max(0, q.life);
      const scale = 1 + (1 - q.life) * 0.35;
      ctx.font = `900 ${Math.round(q.size * scale)}px system-ui, sans-serif`;
      ctx.lineWidth = 5; ctx.strokeStyle = "rgba(8,4,18,0.92)";
      ctx.shadowColor = "rgba(8,4,18,0.9)"; ctx.shadowBlur = 6;
      ctx.strokeText(q.text, q.x, q.y);
      ctx.shadowColor = q.color; ctx.shadowBlur = 14;
      ctx.fillStyle = q.color;
      ctx.fillText(q.text, q.x, q.y);
    }
    ctx.restore();
  }

  return { spawnBurst, spawnShards, spawnHalves, spawnEmber, spawnRing, spawnPop, update, draw };
}
