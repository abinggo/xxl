const STORAGE_KEY = "tme_rhythm_leaderboard_v1";
const PLAYER_ID = "local-player";
const PLAYER_NAME = "音浪玩家";

const BOTS = [
  { id: "aurora", name: "极光汽水", avatar: "🌌", scores: { riluo: [98240, .992, 126], huahai: [95480, .986, 118] } },
  { id: "momo", name: "桃桃节拍", avatar: "🍑", scores: { riluo: [94620, .981, 112], huahai: [97150, .990, 124] } },
  { id: "spark", name: "闪光小队长", avatar: "⚡", scores: { riluo: [91780, .973, 104], huahai: [93260, .978, 109] } },
  { id: "sakura", name: "樱花信号", avatar: "🌸", scores: { riluo: [88640, .965, 96], huahai: [90880, .971, 101] } },
  { id: "sunset", name: "落日飞车手", avatar: "🌅", scores: { riluo: [86420, .958, 91], huahai: [85190, .951, 88] } },
  { id: "blue", name: "蓝色耳机", avatar: "🎧", scores: { riluo: [82160, .944, 82], huahai: [83640, .947, 84] } },
  { id: "penguin", name: "企鹅冲冲冲", avatar: "🐧", scores: { riluo: [78930, .932, 76], huahai: [80420, .938, 79] } },
  { id: "note", name: "音符收藏家", avatar: "🎵", scores: { riluo: [74680, .918, 69], huahai: [76120, .924, 72] } },
];

function readLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch (e) { return {}; }
}

function writeLocal(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch (e) {}
}

export function recordLeaderboardScore(result) {
  if (!result?.song?.id) return;
  const data = readLocal();
  const songId = result.song.id;
  const prev = data[songId];
  if (!prev || result.score > prev.score) {
    data[songId] = {
      songId,
      songName: result.song.name,
      score: result.score,
      maxCombo: result.maxCombo,
      rank: result.rank,
      updatedAt: Date.now(),
    };
    writeLocal(data);
  }
}

export function getSongRanking(song) {
  const local = readLocal()[song.id];
  const rows = BOTS.map((bot) => {
    const raw = bot.scores[song.id] || seededBotScore(bot.id, song.id);
    return {
      id: bot.id, name: bot.name, avatar: bot.avatar,
      score: raw[0], rank: botRank(raw[0]), maxCombo: raw[2], isMe: false,
    };
  });
  rows.push({
    id: PLAYER_ID, name: PLAYER_NAME, avatar: "✨",
    score: local?.score || 0, rank: local?.rank || "A", maxCombo: local?.maxCombo || 0,
    isMe: true, hasScore: !!local,
  });
  rows.sort((a, b) => b.score - a.score);
  return rows.map((row, index) => ({ ...row, position: index + 1 }));
}

export function getOverallRanking(songs) {
  const local = readLocal();
  const songList = songs.filter((song) => song.id !== "custom");
  const rows = BOTS.map((bot) => {
    let total = 0;
    for (const song of songList) total += (bot.scores[song.id] || seededBotScore(bot.id, song.id))[0];
    return {
      id: bot.id, name: bot.name, avatar: bot.avatar, score: total,
      completed: songList.length, totalSongs: songList.length, isMe: false,
    };
  });
  const mine = songList.map((song) => local[song.id]).filter(Boolean);
  rows.push({
    id: PLAYER_ID, name: PLAYER_NAME, avatar: "✨",
    score: mine.reduce((sum, item) => sum + item.score, 0),
    completed: mine.length, totalSongs: songList.length, isMe: true, hasScore: mine.length > 0,
  });
  rows.sort((a, b) => b.score - a.score);
  return rows.map((row, index) => ({ ...row, position: index + 1 }));
}

function seededBotScore(botId, songId) {
  let seed = 0;
  const text = botId + songId;
  for (let i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
  return [68000 + seed % 25000, .90 + (seed % 90) / 1000, 60 + seed % 55];
}

function botRank(score) {
  return score >= 93000 ? "SSS" : score >= 85000 ? "SS" : "S";
}
