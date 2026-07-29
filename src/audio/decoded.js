// 自选音频播放器: 把已解码的 AudioBuffer 接入 master(经 analyser), 与合成床同一接口
import { getAudio } from "./context.js?v=1785334738";

export function createBufferPlayer(audioBuffer) {
  const { ctx, master } = getAudio();
  let src = null;
  let startTime = 0;

  function start(at) {
    startTime = at;
    src = ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(master);
    src.start(at);
  }
  function stop() { if (src) { try { src.stop(); } catch (e) {} } }
  function getStartTime() { return startTime; }
  return { start, stop, getStartTime };
}
