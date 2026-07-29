# TME · 节奏派对 🎵

腾讯音乐 24h AI 黑客松 · 音乐节奏小游戏 Demo

灵感取自《节奏天国》的极简卡点玩法，融合 TME 十周年 IP 家族。核心不是"看音符下落"，而是"听着音乐卡点"，IP 角色随节拍表演、为你打 call。纯 Web 实现，零框架、零构建、手机模拟器外壳。

## 快速开始

```bash
cd ~/Desktop/tme-rhythm-game
python3 -m http.server 8123
# 浏览器打开 http://localhost:8123
```

- `http://localhost:8123/?auto=1` —— 自动演示模式（AI 自动满连击，路演展示用）

## 操作

| 操作 | 键盘 | 触屏/鼠标 |
|------|------|-----------|
| 左轨出手 | `F` 或 `←` | 点屏幕左半 |
| 右轨出手 | `J` 或 `→` | 点屏幕右半 |
| 切换自动演示 | `A` | — |

## 玩法链路

选曲 → 选难度(EASY/NORMAL/HARD) → 3 秒倒计时 → 跟着音乐卡点 → 结算(评级 S/A/B/C + 准确率 + 连击) → 分享海报 / 再来一次

## 核心设计

- **音画同源 · 100% 卡准**：内置曲目由 Web Audio 实时合成，谱面从同一套节拍网格派生，音频用"两个时钟"前瞻调度器（AudioContext 精确时钟）驱动，与判定共用同一时间轴 —— 天然零漂移。
- **两轨极简操作**：只有左右两键，Tap 卡点，上手零门槛。
- **画面随音乐动**：AnalyserNode FFT 拆低/中/高频，驱动频谱、脉冲、角色跳动、镜头抖动。
- **自选音乐（亮点）**：上传任意 mp3/m4a/wav，能量包络 onset 检测自动生成谱面，直接播放原音频。
- **版权安全**：内置曲为原创合成音乐，规避版权问题且保证完美同步；真实热门歌曲走"上传→自动生成"通道。

## 内置曲目

| 曲目 | 曲风 | BPM | IP |
|------|------|-----|-----|
| 霓虹脉冲 | Future Bass | 128 | 🐧 QQ音乐 |
| 午夜留声 | City Pop | 94 | 🐦 全民K歌 |
| 赛博狂潮 | Hard EDM | 150 | 🐕 酷狗 |

## 技术栈

HTML5 Canvas + Web Audio API + 原生 JS ES Modules。无依赖、无打包步骤。

```
index.html            手机外壳(刘海/状态栏) + 视口
src/
  audio/    context 音频图 / synth 合成器+前瞻调度 / decoded 解码播放
  core/     conductor 时钟 / judge 判定评分 / engine 主循环 / generator 自动谱面
  data/     tracks 内置曲目+谱面 / ip IP 家族 / notes 音高
  render/   renderer 主渲染 / fx 粒子池 / character IP 角色 / config
  ui/       songselect 选曲 / result 结算+海报
  main.js   屏幕路由与输入
```

## 后续可拓展

在线排行榜 / 好友对战 / 每日挑战 / 更多 IP 与曲目 / 打包为 App（当前已是移动端布局，套壳即可）。
