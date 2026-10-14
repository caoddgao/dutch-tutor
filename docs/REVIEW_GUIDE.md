# 审核会话交接手册

> 给"审核 / 设计会话"（claude.ai 里与用户对话、链接用户电脑的那个会话）用。新开审核会话时先读本文件 + `docs/STATUS.md`。
> 最后更新：2026-10-14 凌晨（第三个审核会话交接）。

## 1. 用户与分工

- 用户：老旦，中文交流，不懂编程，荷兰语零基础，目标是荷兰境内的融入考试（A1 打基础）。在意 token 用量：回答只答所问，不要长篇。
- 写文档或规格之前先和用户讨论并得到确认。给用户的提示词要能**直接粘贴进新窗口**（自带上下文，不依赖旧对话）。

| 角色 | 在哪 | 做什么 |
|---|---|---|
| 用户 | — | 拍板；试用安装包；把各方报告贴给审核会话 |
| 云端施工会话（Claude / Codex 轮流，同一时间只有一个） | GitHub 仓库 `caoddgao/dutch-tutor` | 写代码和我们自己的内容；分支 → PR → CI 绿 → 自己合并；读 `CLAUDE.md`（Codex 经 `AGENTS.md`）、`STATUS.md`；随时可能中断，规矩见 CLAUDE.md 第 8 条 |
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

## 4. 当前进度（2026-10-14 凌晨）

- 阶段 1–4 完成并审核通过（P01–P10、NN21–65、小贴士 G01–G20、E9），见 STATUS 已定事项 22、23。
- 阶段 5 分四个子批（STATUS 已定事项 24）：5-1 阶段测验 + 结业模拟考已合并（PR #42，已定事项 25）；
  **5-2 录音模式已交给 Codex 施工**（含导出录音稿、`docs/RECORDING_GUIDE.md`，01 §5.5）→ 5-3 Azure 发音评分 → 5-4 备份、报错导出、打磨。
  正式版 v1.0.0 等审核和 T3 后由用户决定。
- 真资料包 `nn-pack` 是 DS 最终版（68 课：NN01–65 + TT1–TT3）；2026-10-14 审核会话已在用户电脑上去掉 NN61–65 英文课题的 "Lesson 61." 前缀，
  仓库 `content/a1/nn-index.json` 同步（与资料包 index 内容一致）。DS 目前没有任务。
- 施工方 Claude / Codex 轮流。审核会话有推送权限，小修正直接在施工分支或新分支上改、触发合成音、收尾合并（如 PR #39、#42）。

## 5. 审核方法

- **复查资料包 / 用真资料包跑完整校验**：在用户电脑上把 `nn-pack` 的 JSON 打包（音频只要文件清单），拉到云端，按清单造空的
  音频文件，然后在仓库里跑 `npm run validate -- --pack <目录> --report x.md`（报告里有课文原句，不进仓库）。这样用户不用在自己电脑上
  装 Node 跑校验。schema 报错会挡住后面的规则检查，可临时修补副本再跑一遍看全貌。
- **复查施工结果**：`gh api repos/caoddgao/dutch-tutor/pulls?state=all`、`.../actions/runs` 看 PR 和 CI；可以直接 fetch 施工分支在
  合并前先测。STATUS 的"待决问题"由审核会话回答，结论写进"已定事项"并清空待决。
- **复查发音 / 荷兰语内容**：逐条核对 `note_zh` 和短句的荷兰语、中文翻译是否准确。
- **对照效果图**：`npm run dev`（浏览器开发模式，用假资料包 + 内存 SQLite）+ Playwright 截图（`/opt/pw-browsers/chromium`），浅 / 深各一张。
- 审核结论写进 `STATUS.md` 的"已定事项"，设计变化同步改 `01/03/04`。

- **写开工提示词**：Claude、Codex 都能直接用；同时给出"进行中"的清单（施工方开工时写进 STATUS）。
- **Codex 的能力（2026-10-12 试用）**：能经 GitHub 连接逐项提交到分支、开草稿 PR、转正式、合并；不能 `git push`、
  不能触发工作流。需要合成音时由审核会话 `gh workflow run tts.yml --ref <分支>` 代为触发，再让 Codex 合并 tts/update 的 PR 继续。
- **通用接手提示词**（施工被中断后，任何一方接手都贴这段）：

  ```
  你是 Dutch Tutor 项目的施工方（新窗口，不依赖旧对话）。仓库 caoddgao/dutch-tutor。
  先读 CLAUDE.md 和 docs/STATUS.md。
  "进行中"一节有内容：上一位施工被中断了。把"施工者"改成你自己，切到那里写的分支，看最近的提交和清单，
  先跑 typecheck / test / validate 确认现状，再从第一个没打勾的项继续，按规矩第 8 条勤保存、勤上传。
  "进行中"为空：等我给具体任务。
  ```

## 6. 踩过的坑

- **同步文档到用户电脑**：`device_commit_files` 用同一个暂存文件名时会传旧版本。每次复制成**新文件名**再提交，提交后用 `sha256sum` 在用户电脑上核对。不要和复制命令并行调用。
- 推送前先 `git pull --rebase`，施工会话随时在合并。
- 用户电脑上不能删文件（权限）。
- GitHub GraphQL 不可用，用 `gh api repos/...`（`gh pr list` 也会失败）。
- **Codex 会用旧快照整份覆盖文件**：3a 时它的提交冲掉了审核会话刚写进 01 的几行（已恢复，AGENTS.md 已加规则）。审核会话在施工进行中
  尽量不改施工方会动的文件；每次审核顺带 `git log -p` 看一眼 docs/ 有没有被意外改回。
- **拆分课的生词**：课题（如 NN42 "Op bezoek"）不算教过；拆分课 a 部分只能用 a 部分课文里出现的词。分词会把"动词 … op + 名词"误认成可分动词
  （bellen op mijn mobiel → opbellen），遇到就换说法。
- **每个新审核会话要重新把真资料包拉到云端**（方法见 §5，云端临时目录不跨会话）。
- 合成音工作流开的 PR（`tts/update`）CI 显示 failure 但没有任何 job，是 GitHub 不给 Actions 开的 PR 跑 CI 的正常现象，看合并后的分支 CI 即可。
- 我们在用户电脑上留下的临时文件删不掉：当场把完整路径告诉用户，由用户自己删；不交给 DS，也不记进 STATUS。
- 改了 03/04 要同步到用户电脑 `Dutch_Tutor_v2\docs\`（DS 读本机副本），用新文件名提交后在电脑上 cp 覆盖并核对 sha256。
- DS 常停下来问问题：给答案时顺带写"以后同类情况按此规则，不用再问"，并把规则补进 03/04。
- 给施工会话的提示词要说明"新窗口、先读 STATUS.md"，不要依赖旧会话上下文。
- **合成音工作流的日志看不到**（日志存放地址被云端代理拦截）。"Content check" 失败多半是我们写的句子超过 5 秒：两句式情景提示
  （"U … . U … ."）约 50 字以上就可能超，改成一句再触发。
- **草稿 PR 不能直接合并**：用 `gh api -X POST repos/caoddgao/dutch-tutor/pulls/<n>/ccr/ready_for_review` 转正式，再 `PUT .../merge`。
- 施工方合并前要过 `npm run format:check`（prettier）；审核会话改了 JSON / Markdown 后先 `npx prettier --write <文件>`。
- 截图：Playwright 用 `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`，`headless: false` + `args: ['--headless=new']`（旧 headless 已移除）。
- 无资料包校验只认 nn-index 里第 21 课起的新词和 own 词：eten、komen、maken、tafel、koffie 等 NN01–20 的词会报"找不到词条"，自编内容避开或补 own 词。
