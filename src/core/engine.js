// 游戏主引擎: 串起 conductor / scorer / musicPlayer / 输入 / 渲染循环
import { getAudio } from "../audio/context.js";
import { createConductor } from "./conductor.js";
import { createScorer, judgeHit, WINDOWS } from "./judge.js";
import { playHitSfx } from "../audio/synth.js";
import { createRenderer } from "../render/renderer.js";
import { APPROACH } from "../render/config.js";

const LEAD_IN = 3.0; // 起手倒计时(秒)

export function createGame(canvas, { song, player, notes, duration, onComplete }) {
  const { bands } = getAudio();
  const conductor = createConductor();
  const scorer = createScorer(notes.length);
  const renderer = createRenderer(canvas, song);

  // 深拷贝音符 + 运行态
  const chart = notes.map((n) => ({ ...n, _done: false }));
  let firstActive = 0;
  let raf = 0, finished = false;
  let lastMilestone = 0;
  let autoplay = false;

  function setAutoplay(v) { autoplay = v; }
  function toggleAutoplay() { autoplay = !autoplay; return autoplay; }

  function resize() { renderer.resize(); }

  function start() {
    renderer.resize();
    const startAt = conductor.now() + LEAD_IN;
    conductor.setStart(startAt);
    player.start(startAt);
    loop();
  }

  function pressLane(lane) {
    if (finished) return;
    const t = conductor.inputTime();
    if (t < -0.2) return;
    let best = -1, bestD = Infinity;
    for (let i = firstActive; i < chart.length; i++) {
      const n = chart[i];
      if (n.time - t > WINDOWS.miss) break;
      if (n._done || n.lane !== lane) continue;
      const d = Math.abs(n.time - t);
      if (d <= WINDOWS.miss && d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) return;
    const n = chart[best];
    n._done = true;
    const j = judgeHit(n.time, t) || "miss";
    const res = scorer.add(j);
    renderer.feedback(lane, j);
    playHitSfx(j);
    checkMilestone(res.combo);
  }

  function checkMilestone(combo) {
    if (combo > 0 && combo % 50 === 0 && combo !== lastMilestone) {
      lastMilestone = combo;
      renderer.celebrate();
    }
  }

  function autoMiss(t) {
    while (firstActive < chart.length) {
      const n = chart[firstActive];
      if (n._done) { firstActive++; continue; }
      if (n.time < t - WINDOWS.miss) {
        n._done = true;
        scorer.add("miss");
        renderer.feedback(n.lane, "miss");
        firstActive++;
      } else break;
    }
  }

  function loop() {
    const t = conductor.time();
    const b = bands();

    // 自动演示: 到点精准命中
    if (autoplay && t >= 0) {
      for (let i = firstActive; i < chart.length; i++) {
        const n = chart[i];
        if (n._done) continue;
        if (n.time > t) break;
        n._done = true;
        const res = scorer.add("perfect");
        renderer.feedback(n.lane, "perfect");
        playHitSfx("perfect");
        checkMilestone(res.combo);
      }
    }

    if (t >= 0) autoMiss(t);

    // 可见音符窗口
    const visible = [];
    for (let i = firstActive; i < chart.length; i++) {
      const n = chart[i];
      if (n._done) continue;
      if (n.time - APPROACH > t) {
        if (n.time - APPROACH > t + 0.05) break; // 后面的还没进场
      }
      if (n.time - APPROACH <= t && n.time + 0.1 >= t) visible.push(n);
    }

    renderer.draw({
      time: t, notes: visible, scorer, bands: b,
      progress: duration ? t / duration : 0,
      characterCelebrate: scorer.combo >= 50 ? Math.min(1, (scorer.combo - 50) / 100) : 0,
      countdown: t < 0 ? Math.ceil(-t) : 0,
    });

    if (!finished && t > duration + 1.2) {
      finished = true;
      if (scorer.isFullCombo()) renderer.celebrate();
      cancelAnimationFrame(raf);
      onComplete({
        song, score: scorer.score, rank: scorer.rank(),
        maxCombo: scorer.maxCombo, counts: { ...scorer.counts },
        accuracy: scorer.accuracy(), fullCombo: scorer.isFullCombo(),
      });
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function destroy() {
    finished = true;
    cancelAnimationFrame(raf);
    player.stop();
  }

  return { start, pressLane, resize, destroy, setAutoplay, toggleAutoplay };
}
