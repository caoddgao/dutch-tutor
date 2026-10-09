# 施工状态

> 每个施工会话开工先读、收工更新。≤ 100 行。

## 当前阶段

阶段 1 · 骨架（进行中）

## 已完成

- PR 1：Tauri 2 + React + TS + Vite 项目；CLAUDE.md、STATUS.md；CI（PR 检查）与发布流程（main → NSIS 预发布）。
- PR 2：设计规范（`src/styles/`：浅 / 深两套 CSS 变量、圆角、阴影、沉浸式深色区、发光播放按钮；
  Plus Jakarta Sans + Noto Sans SC 打包进程序；荷 / 中 / 英三套字号比例，荷兰语句子随窗口宽度自适应）；
  应用外壳（侧栏 6 项，≤ 960px 收成图标；顶栏 EN 开关）；各页空状态；设置状态层。
- PR 3：本地 SQLite（tauri-plugin-sql，`src-tauri/migrations/` 由插件在启动时按版本执行）；
  表：settings、lesson_progress、review_items、review_log、recordings、feedback、study_days；
  设置页（主题、三个字号 + 预览、英文开关、默认播放速度、版本号），保存到 SQLite，重启保留；
  浏览器里跑前端时退回 localStorage。迁移在单元测试里用 node:sqlite 实跑。Prettier 检查进 CI。

## 下一步

- 首页和课程地图静态版（假数据）。

## 待决问题

1. 数据目录：设计 §9 写的是 `%APPDATA%\DutchTutor\`。Tauri 的标准位置是 `%APPDATA%\nl.dutchtutor.app\`
   （数据库 `dutchtutor.db` 已放在这里，安卓上也能用同一套 API）。默认做法：资料包、录音也放在标准位置下
   的 `nn-pack\`、`recordings\`。如需坚持 `DutchTutor` 目录名，阶段 2 前告知。

## 已知问题

（暂无）
