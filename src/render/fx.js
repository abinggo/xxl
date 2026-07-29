// 特效: 粒子对象池 + 判定文字弹跳 (零分配帧循环, 复用对象)
export function createFx() {
  const MAX = 260;
  const pool = [];
  for (let i = 0; i < MAX; i++) pool.push({ active: false });
  const pops = []; // 判定文字

  function spawnBurst(x, y, color, n = 14, power = 1) {
    let made = 0;
    for (let i = 0; i < MAX && made < n; i++) {
      const p = pool[i];
      if (p.active) continue;
      const a = Math.random() * Math.PI * 2;
      const sp = (2 + Math.random() * 4) * power;
      p.active = true; p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - 1;
      p.life = 1; p.decay = 0.018 + Math.random() * 0.02;
      p.r = 2 + Math.random() * 3 * power; p.color = color;
      made++;
    }
  }

  function spawnPop(x, y, text, color) {
    pops.push({ x, y, text, color, life: 1 });
  }

  function update() {
    for (let i = 0; i < MAX; i++) {
      const p = pool[i];
      if (!p.active) continue;
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.vx *= 0.98;
      p.life -= p.decay;
      if (p.life <= 0) p.active = false;
    }
    for (let i = pops.length - 1; i >= 0; i--) {
      const q = pops[i];
      q.y -= 1.1; q.life -= 0.02;
      if (q.life <= 0) pops.splice(i, 1);
    }
  }

  function draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < MAX; i++) {
      const p = pool[i];
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.textAlign = "center";
    for (const q of pops) {
      ctx.globalAlpha = Math.max(0, q.life);
      const scale = 1 + (1 - q.life) * 0.4;
      ctx.font = `800 ${Math.round(22 * scale)}px system-ui, sans-serif`;
      ctx.fillStyle = q.color;
      ctx.shadowColor = q.color; ctx.shadowBlur = 16;
      ctx.fillText(q.text, q.x, q.y);
    }
    ctx.restore();
  }

  return { spawnBurst, spawnPop, update, draw };
}
