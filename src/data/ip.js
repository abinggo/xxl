// TME 十周年 IP 家族(已确认映射)
export const IP = {
  redbird:  { name: "全民K歌", role: "麦霸主唱", color: "#ff5c5c", accent: "#ffd84d", emoji: "🐦" },
  reader:   { name: "懒人听书", role: "叙事者",   color: "#4dd39e", accent: "#22e1ff", emoji: "🎧" },
  kuwo:     { name: "酷我音乐", role: "活力担当", color: "#ff8a3d", accent: "#ffd84d", emoji: "🦊" },
  bluedog:  { name: "酷狗音乐", role: "电音节拍", color: "#3d9aff", accent: "#4dff9e", emoji: "🐶" },
  penguin:  { name: "QQ音乐",  role: "门面担当", color: "#22c3ff", accent: "#9a6bff", emoji: "🐧" },
  ximalaya: { name: "喜马拉雅", role: "彩蛋音频", color: "#ff3d9a", accent: "#ffd84d", emoji: "🐱" },
};

export function getIP(key) {
  return IP[key] || IP.penguin;
}
