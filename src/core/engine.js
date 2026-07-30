// 场景驱动引擎: 共享时钟/计分/舞台/特效/HUD/结算, 输入与判定下放给各 mode。
// mode 契约(全部可选, 引擎按需调用):
//   draw(world)            必需, 逐帧绘制"演员/玩法层"
//   update(t, bands)       逐帧推进(自动流逝过期音符等)
//   auto(t)                自动演示时命中(仅 ?auto=1)
//   tap(x, y)              单键/单击动作(音符跳跃)
//   laneTap(lane)          多轨动作(敲击工坊); mode.lanes 声明轨数
//   pointer(type, x, y)    指针滑动(节奏切割), type: down/move/up
import { getAudio } from "../audio/context.js?v=1785387344";
import { createConductor } from "./conductor.js?v=1785387344";
import { createScorer } from "./judge.js?v=1785387344";
import { playHitSfx } from "../audio/synth.js?v=1785387344";
import { createStage } from "../render/stage.js?v=1785387344";
import { createScene } from "../render/scenes/index.js?v=1785387344";
import { approachTime } from "../render/config.js?v=1785387344";

const LEAD_IN = 3.0;
const LANE_KEYS = { d: 0, f: 1, j: 2, k: 3, D: 0, F: 1, J: 2, K: 3 };
const TAP_KEYS = new Set([" ", "f", "j", "F", "J", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

export function createGame(canvas, { song, player, events, duration, meta, onComplete }) {
  const { bands, ctx } = getAudio();
  const conductor = createConductor();
  const stage = createStage(canvas, { song });
  const approach = approachTime(meta.beatDur);

  const chart = events.map((e) => ({ ...e, _done: false, _judge: null, _outcome: null, _rt: 0, lane: e.lane }));
  // 道具方块(炸弹/加速/冰冻)不计入总音符数, 也不参与判定统计/满连判定
  const scorer = createScorer(chart.filter((e) => !e.item).length);
  let raf = 0, finished = false, lastMilestone = 0, autoplay = false, paused = false;

  // ---- 提供给 mode 的上下文 ----
  const game = {
    stage, meta, song, ip: song.ip, chart, approach, duration, conductor,
    scorer, fx: stage.fx, sfx: playHitSfx,
    get t() { return conductor.time(); },
    inputTime: () => conductor.inputTime(),
    // 计分 + 音效 + 连击里程碑
    judge(j, opt = {}) {
      const res = scorer.add(j);
      if (!opt.silent) playHitSfx(j);
      if (j !== "miss" && !opt.noMilestone) checkMilestone(res.combo);
      return res;
    },
    breakCombo() { scorer.breakCombo(); },
    addScore(delta) { return scorer.addRaw(delta); },
    flash: (c, a) => stage.flash(c, a),
    shakeBy: (n) => stage.shakeBy(n),
    celebrate,
    pause: () => pause(),
    resume: () => resume(),
  };

  const mode = createScene(meta.scene, stage, game);

  function resize() { stage.resize(); }
  function setAutoplay(v) { autoplay = v; }
  function toggleAutoplay() { autoplay = !autoplay; return autoplay; }
  async function setPaused(next) {
    if (finished || paused === next) return paused;
    paused = next;
    if (paused) await ctx.suspend();
    else await ctx.resume();
    return paused;
  }
  function togglePause() { return setPaused(!paused); }

  function start() {
    stage.resize();
    const startAt = conductor.now() + LEAD_IN;
    conductor.setStart(startAt);
    player.start(startAt);
    loop();
  }

  // ---- 输入分发 ----
  function action(x, y) { if (!finished && !paused) mode.tap && mode.tap(x, y); }
  function key(k) {
    if (finished || paused) return;
    if (mode.laneTap && k in LANE_KEYS) { mode.laneTap(LANE_KEYS[k]); return; }
    if (TAP_KEYS.has(k)) mode.tap && mode.tap();
  }
  function pointer(type, x, y) {
    if (finished || paused) return;
    if (mode.pointer) { mode.pointer(type, x, y); return; }
    if (type === "down") mode.tap && mode.tap(x, y);
  }

  function checkMilestone(combo) {
    if (combo > 0 && combo % 25 === 0 && combo !== lastMilestone) { lastMilestone = combo; celebrate(); }
  }
  function celebrate() {
    for (let i = 0; i < 8; i++) {
      stage.fx.spawnBurst(stage.width * (0.15 + Math.random() * 0.7), stage.height * (0.2 + Math.random() * 0.35),
        ["#ffd84d", "#22e1ff", "#ff3d9a", "#5be08a"][i % 4], 16, 1.6);
    }
    stage.flash("#ffd84d", 0.14);
  }

  // 暂停: 停止逐帧循环 + suspend 音频(冻结 ctx.currentTime => conductor 时钟一并冻结)
  function pause() {
    if (finished || paused) return;
    paused = true;
    cancelAnimationFrame(raf);
    try { getAudio().ctx.suspend(); } catch (e) {}
  }
  // 恢复: resume 音频后重启循环(时钟从冻结处连续, 音符不跳拍)
  function resume() {
    if (!paused) return;
    paused = false;
    try {
      const p = getAudio().ctx.resume();
      if (p && p.then) p.then(() => loop(), () => loop()); else loop();
    } catch (e) { loop(); }
  }

  function loop() {
    const t = conductor.time();
    const b = bands();

    if (autoplay && t >= 0 && mode.auto) mode.auto(t);
    if (t >= 0 && mode.update) mode.update(t, b);

    let countText = null, countAlpha = 1;
    if (t < -0.05) { countText = String(Math.min(3, Math.ceil(-t))); countAlpha = 0.9; }
    else if (t < 0.45) { countText = "GO!"; countAlpha = Math.max(0, 1 - t / 0.45); }

    const world = {
      t, bands: b, scorer, bpm: meta.bpm, best: song.best || 0,
      levelLabel: song.levelLabel, sceneName: song.sceneName,
      duration, progress: duration ? t / duration : 0, rankProgress: scorer.rankProgress,
      approach, W: stage.width, H: stage.height, ctx: canvas.getContext("2d"),
      countText, countAlpha, floor: mode.floor !== false,
    };

    stage.begin(world);
    mode.draw(world);
    stage.fxLayer();
    stage.hud(world);
    stage.overlay(world);

    if (!finished && t > duration + 1.6) {
      finished = true;
      if (scorer.isFullCombo()) celebrate();
      cancelAnimationFrame(raf);
      onComplete({
        song, score: scorer.score, rank: scorer.rank(),
        maxCombo: scorer.maxCombo, counts: { ...scorer.counts },
        fullCombo: scorer.isFullCombo(),
      });
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function destroy() {
    finished = true;
    cancelAnimationFrame(raf);
    player.stop();
    if (paused) { paused = false; ctx.resume().catch(() => {}); }
    mode.destroy && mode.destroy();
  }

  return {
    start, resize, destroy, setAutoplay, toggleAutoplay, action, key, pointer,
    setPaused, togglePause,
    get paused() { return paused; },
  };
}
