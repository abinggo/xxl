// 音频图与频谱分析
// 链路: [synth/sfx] -> master -> compressor -> analyser -> destination
// analyser 同时给渲染层提供实时频段能量, 实现"画面随音乐动"

let _audio = null;

export function getAudio() {
  if (_audio) return _audio;

  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();

  const master = ctx.createGain();
  master.gain.value = 0.9;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 24;
  comp.ratio.value = 3.5;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.8;

  master.connect(comp);
  comp.connect(analyser);
  analyser.connect(ctx.destination);

  const freqData = new Uint8Array(analyser.frequencyBinCount);

  // 采样频段能量, 归一化到 0..1, 内部带平滑
  const smooth = { bass: 0, mid: 0, treble: 0, energy: 0 };
  function bands() {
    analyser.getByteFrequencyData(freqData);
    const n = freqData.length;
    // 频率区间(基于 fftSize=1024, 采样率~44.1k, 每 bin ~43Hz)
    const bassEnd = 6;    // ~0-260Hz
    const midEnd = 60;    // ~260-2600Hz
    let b = 0, m = 0, t = 0;
    for (let i = 0; i < n; i++) {
      const v = freqData[i] / 255;
      if (i < bassEnd) b += v;
      else if (i < midEnd) m += v;
      else t += v;
    }
    b /= bassEnd;
    m /= (midEnd - bassEnd);
    t /= (n - midEnd);
    const e = (b * 0.6 + m * 0.3 + t * 0.1);
    // 指数平滑, 让律动顺滑
    smooth.bass += (b - smooth.bass) * 0.35;
    smooth.mid += (m - smooth.mid) * 0.35;
    smooth.treble += (t - smooth.treble) * 0.3;
    smooth.energy += (e - smooth.energy) * 0.3;
    return smooth;
  }

  _audio = { ctx, master, analyser, bands };
  return _audio;
}

// 浏览器要求用户手势后才能启动音频
export async function unlockAudio() {
  const { ctx } = getAudio();
  if (ctx.state === "suspended") await ctx.resume();
  return ctx;
}
