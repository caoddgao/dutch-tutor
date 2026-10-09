# Dutch Tutor

面向中文母语者的荷兰语 A1 自学桌面程序：Tauri 2 + React + TypeScript + Vite，本地 SQLite，离线可用。
目前只出 Windows 11 x64 安装包，但不用任何 Windows 专属 API（以后要出安卓版）。

## 开工先读

1. `docs/STATUS.md` —— 当前阶段、已完成、下一步、待决问题、已知问题。收工时更新它（≤ 100 行），不另写报告文件。
2. `docs/01_DESIGN.md` 是合同；`docs/02_PLAN.md` 是施工计划；`docs/03_PACK_FORMAT.md` 是资料包格式。

## 规矩（02_PLAN.md §0.2）

1. 每个任务一个分支 → 开 PR → CI 全绿后自己合并到 `main`（用 merge commit）。不 force push，不改历史。
2. 不降低检查标准求通过，不为了通过而改测试。
3. 设计说明是合同。发现行不通，写进 `STATUS.md` 的"待决问题"，停下等决定，不擅自改设计。
   设计没写、又需要用户决定的小事：写进"待决问题"，选最合理的默认做法继续。
4. 密钥只放 GitHub Secrets（`AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION`）和用户本机，绝不进代码、日志、提交。
5. Naar Nederland 的课文、练习、录音不进仓库；只放 `nn-index.json` 和我们自编的假资料包。
6. 界面以效果图为准；新页面先做静态版给用户看，再接功能。
7. 界面文字全部中文（荷兰语内容除外），不出现任何开发者视角的说明文字。

## 常用命令

```bash
npm ci                 # 安装依赖
npm run dev            # 只跑前端（浏览器，设置存 localStorage）
npm run tauri dev      # 桌面窗口（需要 Rust；Linux 需 webkit2gtk-4.1）
npm run typecheck      # 类型检查
npm run lint           # ESLint
npm test               # Vitest 单元测试
npm run build          # 前端构建到 dist/
cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings
```

## 代码地图

- `src/` 前端；`src/styles/` 设计规范（CSS 变量，浅 / 深两套主题）；`src/pages/` 各页面。
- `src-tauri/` Rust 外壳；`src-tauri/migrations/` SQLite 迁移（只追加，不改已发布的）。
- `scripts/version.mjs` 发布版本号（0.1.x，按已有 tag 递增）。
- CI：`.github/workflows/ci.yml`（每个 PR）、`release.yml`（合并到 main → NSIS 预发布）。
