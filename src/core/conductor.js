// Conductor: 歌曲时间的唯一权威时钟
// 所有判定与渲染位置都基于 AudioContext.currentTime, 绝不用 Date.now / 帧数累加
import { getAudio } from "../audio/context.js?v=1785345155";

export function createConductor() {
  const { ctx } = getAudio();
  let startTime = 0;      // 音乐床开始的 ctx 时间
  let running = false;

  // 输入延迟补偿(秒): 玩家实际听到->按下有系统延迟, 判定时把输入时间减去它
  // 正值 = 认为玩家偏晚, 演示可现场微调
  let inputOffset = 0.00;

  return {
    setStart(t) { startTime = t; running = true; },
    stop() { running = false; },
    isRunning() { return running; },
    // 当前歌曲时间(秒)
    time() { return ctx.currentTime - startTime; },
    // 用于判定的输入时间(带延迟补偿)
    inputTime() { return ctx.currentTime - startTime - inputOffset; },
    setInputOffset(v) { inputOffset = v; },
    getInputOffset() { return inputOffset; },
    now() { return ctx.currentTime; },
  };
}
