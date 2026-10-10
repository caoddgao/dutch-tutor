# 审核会话交接手册

> 给"审核 / 设计会话"（claude.ai 里与用户对话、链接用户电脑的那个会话）用。新开审核会话时先读本文件 + `docs/STATUS.md`。
> 最后更新：2026-10-11（第一个审核会话交接）。

## 1. 用户与分工

- 用户：老旦，中文交流，不懂编程，荷兰语零基础，目标是荷兰境内的融入考试（A1 打基础）。在意 token 用量：回答只答所问，不要长篇。
- 写文档或规格之前先和用户讨论并得到确认。给用户的提示词要能**直接粘贴进新窗口**（自带上下文，不依赖旧对话）。

| 角色 | 在哪 | 做什么 |
|---|---|---|
| 用户 | — | 拍板；试用安装包；把各方报告贴给审核会话 |
| 云端施工会话 | GitHub 仓库 `caoddgao/dutch-tutor` | 写代码和我们自己的内容；分支 → PR → CI 绿 → 自己合并；读 `CLAUDE.md`、`STATUS.md` |
| DS（DeepSeek，VS Code） | 用户电脑 `F:\Working_Projects\Dutch_Tutor_v2\` | 整理 Naar Nederland 资料包（`docs/04_DS_NN_PACK.md`），不碰仓库 |
| 审核会话 | claude.ai | 审核施工总结和 DS 汇报、截图对照效果图、修订 03/04 文档、给下一阶段写开工提示词 |

## 2. 关键文件

- 仓库：`docs/01_DESIGN.md`（合同）、`02_PLAN.md`（阶段 1–5 + 试用点 T1–T3）、`03_PACK_FORMAT.md`（资料包格式）、`04_DS_NN_PACK.md`（DS 指令）、`STATUS.md`（施工现状，施工会话维护）。
- 用户电脑（连接文件夹 `F:\Working_Projects`）：
  - `Dutch_Tutor_v2\NaarNederland\`：原始教材（PDF、录音），只读
  - `Dutch_Tutor_v2\NN_Pack\`：DS 工作目录；`nn-pack\` 是资料包，`LOG.md`、`REPORT_full.md` 是 DS 的日志和汇报，`nn-index.json` 是要进仓库的目录摘要
  - `Dutch_Tutor_v2\docs\`：四份文档的本机副本（正本在 GitHub）
  - `Dutch_Tutor\`：旧项目，已封存，不碰
- 效果图：claude.ai 画布"Dutch Tutor UI 风格对比"，下排 A+C 风格为采用方案。

## 3. 已定的主要决定（不要推翻）

- 只做 A1，Windows 11 桌面版（Tauri 2 + React + SQLite），以后出安卓版；离线可用。
- A1 主干 = Naar Nederland：正课沿用 NN 课号 21–65，发音入门 P01–P10 对应 NN 1–13/20，3 次阶段测验 + 结业模拟考。KNS 不做，常识揉进课文。
- 三语（荷 / 中 / 英，英文可关）；词典式词条（词性、de/het、复数、动词变位）；不锁课；复习单独入口（R1 看荷选义、R2 只听选义、R3 看中英开口说）；不考打字。
- 语法：中途介入，只用"小贴士"讲解，不出语法题。
- 音频优先级：真人录音（用户儿子，录音模式）> NN 原版切片 > Azure 合成音（FennaNeural）。
- UI：A+C 风格（浅色 + 深色沉浸局部），另有深色主题；字号自适应 + 设置里可调。
- 资料包只在用户电脑上，不进仓库；仓库只放 `nn-index.json` 和自编假资料包。NN 原文不由审核会话抄进仓库。
- 练习：课本练习全收 + 自动题 ≤ 9 道（一课 15–25 小题）。
- 数据目录 `%APPDATA%\nl.dutchtutor.app\`；不做代码签名；连续天数 = 有学习记录的自然日。
- Azure：用户本机环境变量 `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION=eastus`；GitHub Secrets 同名（已修好）。F0 限速 20 次/分钟。发音评分支持 nl-NL（无韵律、无音素名）。

## 4. 当前进度（2026-10-11）

- 阶段 1、2 已完成并审核通过；最新安装包 v0.1.10。下一步是 **T1 试用**（清单在 `STATUS.md`），然后阶段 3。
- DS 全量资料包已完成（68 课、1755 句、1605 词条），审核会话用 `npm run validate -- --pack` 查出两处问题，**DS 正在修**：
  ① fill_choice 第二组词库缺失（52 题）→ 03 §4 新增小题级 `bank`；② `’s`、VS、OK、OV-chipkaart 等 14 处缺词条。
  另：`zh_nn/en_nn` 为 null 由程序放宽（已记入 STATUS 已知问题，阶段 3 开工先改）。
- DS 修完后：审核会话复查 → 通过后，用户装 v0.1.10、导入 `nn-pack` 做 T1 → 把 `NN_Pack\nn-index.json` 放进仓库 `content/a1/nn-index.json`（审核会话可直接提交）→ 写阶段 3 开工提示词。

## 5. 审核方法

- **复查资料包**：在用户电脑上把 `nn-pack` 的 JSON 打包（音频只要文件清单），拉到云端，按清单造空的音频文件，然后在仓库里跑
  `npm run validate -- --pack <目录> --report x.md`。注意 schema 报错会挡住后面的规则检查，可临时修补副本再跑一遍看全貌。
- **对照效果图**：`npm run dev`（浏览器开发模式，用假资料包 + 内存 SQLite）+ Playwright 截图（`/opt/pw-browsers/chromium`），浅 / 深各一张。
- 审核结论写进 `STATUS.md` 的"已定事项"，设计变化同步改 `01/03/04`。

## 6. 踩过的坑

- **同步文档到用户电脑**：`device_commit_files` 用同一个暂存文件名时会传旧版本。每次复制成**新文件名**再提交，提交后用 `sha256sum` 在用户电脑上核对。不要和复制命令并行调用。
- 推送前先 `git pull --rebase`，施工会话随时在合并。
- 用户电脑上不能删文件（权限），需要删的交给 DS。
- GitHub GraphQL 不可用，用 `gh api repos/...`。
- DS 常停下来问问题：给答案时顺带写"以后同类情况按此规则，不用再问"，并把规则补进 03/04。
- 给施工会话的提示词要说明"新窗口、先读 STATUS.md"，不要依赖旧会话上下文。
