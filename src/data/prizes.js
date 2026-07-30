const STORAGE_KEY = "tme_rhythm_prizes_v1";
const MAX_PRIZES = 100;

export function getPrizes() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (e) {
    return [];
  }
}
export function savePrizeBatch(prizes) {
  if (!Array.isArray(prizes) || !prizes.length) return [];
  const now = Date.now();
  const saved = prizes.map((prize, index) => ({
    ...prize,
    id: prize.id || `${prize.songId || "song"}-${now}-${index}`,
    collectedAt: prize.collectedAt || now + index,
  }));
  try {
    const next = [...saved, ...getPrizes()].slice(0, MAX_PRIZES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {}
  return saved;
}
