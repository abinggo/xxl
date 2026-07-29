// TME 十周年 IP 家族(与素材/关卡映射)
//   penguin = QQ音乐 企鹅   -> 节奏切割(水果忍者)
//   redbird = 全民K歌 红鸟   -> 音符跳跃(单键上跳)
//   bluedog = 酷狗音乐 蓝狗   -> 敲击工坊(节奏大师)
export const IP = {
  penguin:  { name: "QQ音乐",  role: "门面担当", color: "#2fd0ff", accent: "#5be08a", emoji: "🐧", file: "penguin" },
  redbird:  { name: "全民K歌", role: "麦霸主唱", color: "#ff5c5c", accent: "#ffd84d", emoji: "🐦", file: "redbird" },
  bluedog:  { name: "酷狗音乐", role: "电音节拍", color: "#3d9aff", accent: "#4dff9e", emoji: "🐶", file: "bluedog" },
  // 备用
  reader:   { name: "懒人听书", role: "叙事者",   color: "#4dd39e", accent: "#22e1ff", emoji: "🎧" },
  kuwo:     { name: "酷我音乐", role: "活力担当", color: "#ff8a3d", accent: "#ffd84d", emoji: "🦊" },
  ximalaya: { name: "喜马拉雅", role: "彩蛋音频", color: "#ff3d9a", accent: "#ffd84d", emoji: "🐱" },
};

export function getIP(key) {
  return IP[key] || IP.penguin;
}

// 贴图后台预载: 加载 assets/ip/<file>.png, 抠掉暗色辉光背景 + 裁剪出紧致立绘,
// 结果存为 IP[key].sprite = { src: canvas, w, h }, 供 drawHero 直接绘制。
// 加载/处理失败静默忽略 -> 角色回退到矢量绘制。
export function loadIPSprites() {
  for (const key of Object.keys(IP)) {
    const file = IP[key].file;
    if (!file) continue;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try { IP[key].sprite = processSprite(img); }
      catch (e) { /* 处理失败, 回退矢量 */ }
    };
    img.onerror = () => { /* 无素材, 回退矢量 */ };
    img.src = `./assets/ip/${file}.png`;
  }
}

// 抠底: 从四周边缘 flood-fill 蔓延, 把"暗到接近背景"的连通区域设为透明,
// 角色四周的亮辉光会自然截停蔓延(保留一圈辉光看起来更炫)。再裁剪非透明包围盒。
function processSprite(img) {
  const W = img.naturalWidth, H = img.naturalHeight;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  c.drawImage(img, 0, 0);
  const id = c.getImageData(0, 0, W, H);
  const d = id.data;

  const DARK = 46;                 // 通道最大值低于此判为暗背景
  const isDark = (i) => {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    return Math.max(r, g, b) < DARK;
  };

  const removed = new Uint8Array(W * H);
  const stack = [];
  // 播种: 所有边缘暗像素
  for (let x = 0; x < W; x++) { seed(x, 0); seed(x, H - 1); }
  for (let y = 0; y < H; y++) { seed(0, y); seed(W - 1, y); }
  function seed(x, y) {
    const p = y * W + x;
    if (!removed[p] && isDark(p * 4)) { removed[p] = 1; stack.push(p); }
  }
  while (stack.length) {
    const p = stack.pop();
    const x = p % W, y = (p / W) | 0;
    if (x > 0)     tryPush(p - 1);
    if (x < W - 1) tryPush(p + 1);
    if (y > 0)     tryPush(p - W);
    if (y < H - 1) tryPush(p + W);
  }
  function tryPush(p) {
    if (removed[p]) return;
    if (isDark(p * 4)) { removed[p] = 1; stack.push(p); }
  }

  // 应用透明 + 记录包围盒 + 边缘羽化
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const a = p * 4 + 3;
      if (removed[p]) { d[a] = 0; continue; }
      // 与被移除区相邻的保留像素 -> 半透明羽化, 软化硬边
      const edge = (x > 0 && removed[p - 1]) || (x < W - 1 && removed[p + 1]) ||
                   (y > 0 && removed[p - W]) || (y < H - 1 && removed[p + W]);
      if (edge) d[a] = Math.min(d[a], 150);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  c.putImageData(id, 0, 0);

  if (maxX <= minX || maxY <= minY) return { src: cv, w: W, h: H };
  // 裁剪到紧致包围盒(留一点边距容纳辉光)
  const pad = Math.round(Math.min(W, H) * 0.02);
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(W - 1, maxX + pad); maxY = Math.min(H - 1, maxY + pad);
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const out = document.createElement("canvas");
  out.width = cw; out.height = ch;
  out.getContext("2d").drawImage(cv, minX, minY, cw, ch, 0, 0, cw, ch);
  return { src: out, w: cw, h: ch };
}
