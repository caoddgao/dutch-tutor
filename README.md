# Dutch Tutor

面向中文母语者的荷兰语自学桌面程序（Windows 11），先做 A1，A2–B2 预留。
A1 以官方免费教材 *Naar Nederland* 为主干：逐句原版录音、荷 / 中 / 英三语、词典式词条、不锁课、独立复习入口。

- 技术：Tauri 2 + React + TypeScript + Vite，本地 SQLite，离线可用；可选 Azure 发音评分。
- 安装包：由 GitHub Actions 自动构建，在 Releases 下载。

## 文档

| 文件 | 内容 |
|---|---|
| [docs/01_DESIGN.md](docs/01_DESIGN.md) | A1 设计说明（合同） |
| [docs/02_PLAN.md](docs/02_PLAN.md) | 施工计划：阶段 1–5、验收、试用点 |
| [docs/03_PACK_FORMAT.md](docs/03_PACK_FORMAT.md) | Naar Nederland 资料包格式 |
| [docs/04_DS_NN_PACK.md](docs/04_DS_NN_PACK.md) | 资料包整理指令（在用户本机执行） |

Naar Nederland 的课文、练习和录音不进本仓库，只存在用户本机的资料包里。

## 状态

施工尚未开始。当前状态见 `docs/STATUS.md`（阶段 1 开工时建立）。
