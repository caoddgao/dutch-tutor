# 施工状态

> 每个施工会话开工先读、收工更新。≤ 100 行。

## 当前阶段

阶段 1 · 骨架 —— 代码全部完成，等用户在 Windows 11 上装机验收。下一步进入阶段 2 · 学习引擎。

## 已完成（阶段 1）

- PR 1：Tauri 2 + React + TS + Vite 项目；CLAUDE.md、STATUS.md；CI（每个 PR）与发布流程
  （合并到 main → windows-latest 打 NSIS → 预发布 `v0.1.x`，版本号按已有 tag 递增）。
- PR 2：设计规范（`src/styles/`：浅 / 深两套 CSS 变量、圆角、阴影、沉浸式深色区、发光播放按钮；
  Plus Jakarta Sans + Noto Sans SC 打包进程序；荷 / 中 / 英三套字号比例，荷兰语句子随窗口宽度自适应）；
  应用外壳（侧栏 6 项，≤ 960px 收成图标；顶栏 EN 开关）；复习 / 发音练习 / 模拟考试空状态。
- PR 3：本地 SQLite（tauri-plugin-sql，`src-tauri/migrations/` 由插件在启动时按版本执行）；
  表：settings、lesson_progress、review_items、review_log、recordings、feedback、study_days；
  设置页（主题、三个字号 + 预览、英文开关、默认播放速度、版本号），存 SQLite，重启保留；
  浏览器里跑前端时退回 localStorage。迁移在单元测试里用 node:sqlite 实跑。Prettier 检查进 CI。
- PR 4：首页（深色"继续学习"卡、今日复习、已学句子 / 连续天数、课程地图入口）和课程地图
  （A1–B2 标签、不锁课说明、发音入门 / 正课 / 阶段测验三区、状态标签、进度条、推荐卡橙色边框），
  都用 `src/course/demoCourse.ts` 的假数据。"推荐"= 课程顺序里第一个"未学"的课（`recommendNext`）。

## 验收（02_PLAN 阶段 1）

- [ ] 安装包在 Windows 11 上安装、打开，开始菜单有图标 —— 需用户实机确认（CI 只能证明能打包）。
- [x] 浅色 / 深色 / 跟随系统切换；字号滑块即时生效（单元测试 + 截图检查）。
- [x] 设置存 SQLite、重启保留：在 Linux 上用真实 Tauri 程序（Xvfb）点选后重启验证过；迁移在启动时执行。
- [ ] 首页、课程地图静态版与效果图一致 —— 施工会话看不到 claude.ai 上的效果图，按任务书描述实现，需用户 / 审核会话对照。

## 下一步（阶段 2 · 学习引擎，见 02_PLAN.md）

1. `content/` 结构 + JSON Schema + 内容校验脚本（§11 规则 1–7），校验进 CI。
2. 资料包读取层和导入流程（先做一个自编的假资料包，格式按 03_PACK_FORMAT.md）。
3. 音频层、上课页六步流程、练习 E1–E4 / E7 / E8、复习 R1–R3、课程地图接真实数据。
   接真实数据时：首页和课程地图把 `demoCourse.ts` 换成从 SQLite + 内容数据算出的结果，删掉假数据。

## 已定事项（审核会话 2026-10-09）

1. 数据目录用 Tauri 标准位置 `%APPDATA%\nl.dutchtutor.app\`（资料包 `nn-pack\`、录音 `recordings\` 都放这里）；01_DESIGN §9 已同步改。
2. 不做代码签名，接受 SmartScreen 首次提示。
3. "连续天数"按"有学习或复习记录的自然日"连续计算，漏一天归零。
4. 首页、课程地图、设置页与效果图对照通过（浅 / 深两套）。

## 待决问题

（无）

## 已知问题

- 首页"接着学"按钮在阶段 1 不跳转（上课页阶段 2 才有）；课程卡暂不可点。
