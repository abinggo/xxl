// 乐理辅助: 音名 -> 频率
const A4 = 440;
const NAMES = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };

// "A4" / "C#3" -> midi
export function midi(name) {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error("bad note: " + name);
  return NAMES[m[1]] + (parseInt(m[2], 10) + 1) * 12;
}
export function freq(name) {
  return A4 * Math.pow(2, (midi(name) - 69) / 12);
}
