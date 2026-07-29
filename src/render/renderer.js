// 主渲染器: 舞台 / 判定圈 / 收缩节拍环 / HUD, 全部随音乐频谱律动
import { APPROACH, LANE_X, JUDGE_Y, TARGET_R, RING_EXTRA, COLORS } from "./config.js?v=1785335894";
import { createFx } from "./fx.js?v=1785335894";
import { createCharacter } from "./character.js?v=1785335894";

export function createRenderer(canvas, song) {
  const ctx = canvas.getContext("2d");
  const fx = createFx();
  const character = createCharacter(song.ip);
  let W = 0, H = 0, dpr = 1;
  let shake = 0;              // 镜头震动
  let bgCanvas = null;       // 离屏静态背景

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildBg();
  }

  function buildBg() {
    bgCanvas = document.createElement("canvas");
    bgCanvas.width = Math.round(W * dpr);
    bgCanvas.height = Math.round(H * dpr);
    const b = bgCanvas.getContext("2d");
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = b.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#140a2e");
    g.addColorStop(0.5, "#0a0616");
    g.addColorStop(1, "#05030d");
    b.fillStyle = g; b.fillRect(0, 0, W, H);
    // 透视地平线网格(舞台感)
    b.strokeStyle = "rgba(154,107,255,0.14)"; b.lineWidth = 1;
    const horizon = H * JUDGE_Y;
    for (let i = 1; i <= 8; i++) {
      const y = horizon + (H - horizon) * Math.pow(i / 8, 1.6);
      b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke();
    }
    for (let i = -6; i <= 6; i++) {
      const x = W / 2 + i * (W / 8);
      b.beginPath(); b.moveTo(W / 2 + i * 6, horizon); b.lineTo(x, H); b.stroke();
    }
  }

  // world: { time, notes(visible), scorer, bands, characterCelebrate }
  function draw(world) {
    const { time, notes, scorer, bands } = world;
    const energy = bands.energy || 0;
    const bass = bands.bass || 0;

    // 背景 + 律动光晕
    ctx.save();
    if (shake > 0.1) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake *= 0.85;
    }
    ctx.clearRect(-10, -10, W + 20, H + 20);
    ctx.drawImage(bgCanvas, 0, 0, W, H);

    // 顶部律动光带
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const topGlow = ctx.createRadialGradient(W / 2, H * 0.34, 10, W / 2, H * 0.34, W * (0.5 + energy * 0.4));
    topGlow.addColorStop(0, `rgba(154,107,255,${0.1 + energy * 0.25})`);
    topGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = topGlow; ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // 频谱底部律动条
    drawSpectrum(bands);

    // IP 角色舞台
    character.update(bands);
    character.draw(ctx, W / 2, H * 0.36, world.characterCelebrate || 0);

    // 判定圈(左右 lane)
    for (let l = 0; l < 2; l++) {
      const x = LANE_X[l] * W, y = JUDGE_Y * H;
      const col = l === 0 ? COLORS.laneA : COLORS.laneB;
      ctx.save();
      ctx.strokeStyle = col; ctx.lineWidth = 3;
      ctx.globalAlpha = 0.5 + bass * 0.5;
      ctx.shadowColor = col; ctx.shadowBlur = 12 + bass * 20;
      ctx.beginPath(); ctx.arc(x, y, TARGET_R, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.12; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y, TARGET_R, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // 收缩节拍环 + 音符
    for (const n of notes) {
      const p = (time - (n.time - APPROACH)) / APPROACH; // 0->1 命中
      if (p < 0 || n._done) continue;
      const x = LANE_X[n.lane] * W, y = JUDGE_Y * H;
      const col = n.lane === 0 ? COLORS.laneA : COLORS.laneB;
      const r = TARGET_R + RING_EXTRA * (1 - p);
      const alpha = Math.min(1, p * 2);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = col; ctx.lineWidth = 3 + p * 2;
      ctx.shadowColor = col; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      // 音符核心
      ctx.globalAlpha = alpha;
      const core = ctx.createRadialGradient(x, y, 2, x, y, TARGET_R * 0.8);
      core.addColorStop(0, "#fff");
      core.addColorStop(1, col);
      ctx.fillStyle = core;
      const cr = n.type === "hold" ? TARGET_R * 0.5 : TARGET_R * 0.55;
      ctx.beginPath(); ctx.arc(x, y, cr, 0, Math.PI * 2); ctx.fill();
      // Hold 尾巴指示
      if (n.type === "hold") {
        ctx.globalAlpha = alpha * 0.6; ctx.strokeStyle = col; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 40); ctx.stroke();
      }
      ctx.restore();
    }

    fx.update();
    fx.draw(ctx);

    drawHUD(world);

    // 起手倒计时
    if (world.countdown > 0) {
      ctx.save();
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "900 110px system-ui, sans-serif";
      const g = ctx.createLinearGradient(0, H * 0.4, 0, H * 0.6);
      g.addColorStop(0, "#22e1ff"); g.addColorStop(1, "#ff3d9a");
      ctx.fillStyle = g; ctx.shadowColor = "#9a6bff"; ctx.shadowBlur = 30;
      ctx.globalAlpha = 0.9;
      ctx.fillText(String(world.countdown), W / 2, H * 0.5);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawSpectrum(bands) {
    const arr = [bands.bass, bands.bass, bands.mid, bands.mid, bands.mid, bands.treble, bands.treble];
    const n = arr.length, bw = W / n;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < n; i++) {
      const h = 6 + (arr[i] || 0) * 70;
      const grad = ctx.createLinearGradient(0, H - h, 0, H);
      grad.addColorStop(0, "rgba(34,225,255,0.5)");
      grad.addColorStop(1, "rgba(255,61,154,0.05)");
      ctx.fillStyle = grad;
      ctx.fillRect(i * bw + 2, H - h, bw - 4, h);
    }
    ctx.restore();
  }

  function drawHUD(world) {
    const { scorer } = world;
    ctx.save();
    ctx.textBaseline = "top";
    // 分数
    ctx.textAlign = "left";
    ctx.font = "800 15px system-ui, sans-serif";
    ctx.fillStyle = "rgba(243,240,255,0.6)";
    ctx.fillText("SCORE", 20, 40);
    ctx.font = "900 30px system-ui, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(String(scorer.score).padStart(6, "0"), 20, 56);

    // 进度条
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(20, 100, W - 40, 4);
    ctx.fillStyle = "#22e1ff";
    ctx.fillRect(20, 100, (W - 40) * Math.min(1, world.progress || 0), 4);

    // Combo
    if (scorer.combo > 1) {
      ctx.textAlign = "center";
      const pulse = 1 + Math.min(0.3, scorer.combo / 200);
      ctx.font = `900 ${Math.round(52 * pulse)}px system-ui, sans-serif`;
      const g = ctx.createLinearGradient(0, H * 0.5, 0, H * 0.6);
      g.addColorStop(0, "#ffd84d"); g.addColorStop(1, "#ff3d9a");
      ctx.fillStyle = g;
      ctx.shadowColor = "#ffd84d"; ctx.shadowBlur = 20;
      ctx.fillText(String(scorer.combo), W / 2, H * 0.52);
      ctx.shadowBlur = 0;
      ctx.font = "800 14px system-ui, sans-serif";
      ctx.fillStyle = "rgba(243,240,255,0.7)";
      ctx.fillText("COMBO", W / 2, H * 0.52 + 52 * pulse);
    }
    ctx.restore();
  }

  // 供引擎调用的反馈
  function feedback(lane, judgement) {
    const x = LANE_X[lane] * W, y = JUDGE_Y * H;
    const col = COLORS[judgement];
    if (judgement === "miss") {
      fx.spawnBurst(x, y, col, 6, 0.7);
      character.onMiss();
    } else {
      fx.spawnBurst(x, y, col, judgement === "perfect" ? 20 : 12, judgement === "perfect" ? 1.4 : 1);
      character.onHit(true);
      shake = judgement === "perfect" ? 4 : 2;
    }
    fx.spawnPop(x, y - 50, judgement.toUpperCase(), col);
  }

  function celebrate() {
    for (let i = 0; i < 5; i++) {
      fx.spawnBurst(W * (0.2 + Math.random() * 0.6), H * (0.3 + Math.random() * 0.3), ["#ffd84d", "#22e1ff", "#ff3d9a"][i % 3], 18, 1.5);
    }
  }

  return { resize, draw, feedback, celebrate, get width() { return W; }, get height() { return H; } };
}
