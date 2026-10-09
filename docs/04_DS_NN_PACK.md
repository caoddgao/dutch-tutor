# 给 DS 的工作指令：整理 Naar Nederland 资料包

> 版本 v1.0 · 2026-10-08
> 执行者：DS（DeepSeek，在用户的 Windows 电脑上，VS Code 里）
> 产出格式：严格按 `03_PACK_FORMAT.md`（format_version 1）。格式有疑问时停下来问用户，不要自己发明字段。

---

## 0. 背景（一段话）

用户在做一个自学荷兰语的桌面程序。A1 课程以官方免费教材 *Naar Nederland* 为主干，程序要逐句播放原版录音，并显示荷、中、英三语。你的任务是把用户已下载的教材 PDF 和录音，整理成程序能直接导入的"资料包"：课文逐句切好录音、配上中英翻译、练习转成结构化数据、两份官方词表合并成词条库。资料包只供用户个人学习，**只存在这台电脑上**。

## 1. 规矩

1. **原始资料只读**：`F:\Working_Projects\Dutch_Tutor_v2\NaarNederland\` 里的文件一律不改、不移动、不删除。
2. **工作目录**：`F:\Working_Projects\Dutch_Tutor_v2\NN_Pack\`（已建好，空）。VS Code 打开的项目根目录是 `F:\Working_Projects\Dutch_Tutor_v2`。脚本放在 `scripts\`，产出放在 `nn-pack\`，中间文件放在 `work\`。**不要读写老项目目录 `F:\Working_Projects\Dutch_Tutor\`。**
3. **不上传**：不推到任何 git 远程仓库，不上传到任何网站。
4. **安装软件前先问用户**（见第 2 步）。
5. 所有步骤记日志：`F:\Working_Projects\Dutch_Tutor_v2\NN_Pack\LOG.md`，只追加，每次一段：日期、做了什么、结果、问题。
6. **先试点，再全量**（第 9 步）。试点完成后必须停下来等用户确认。

## 2. 输入文件

| 文件 | 用途 |
|---|---|
| `nn-werkboek-2015-herzien-omslag-lowres.pdf` | 练习册，340 页，有文字层。PDF 页码 = 书上印的页码 + 2（例：书上第 116 页 = PDF 第 118 页，第 21 课从这里开始），请核实 |
| `chinees-handleiding-naar-nederland.pdf` | 中文说明书，28 页；第 18–28 页是第 21–65 课的荷中词表 |
| `engels-handleiding-naar-nederland.pdf` | 英文说明书，28 页；同样位置是荷英词表 |
| `ZH Audio\Naar Nederland ZH Instructie en 65 Taallessen\Les 01 .mp3` … `Les 65.mp3` | 每课一个录音。注意有的文件名里有多余空格（`Les 01 .mp3`、`Les 19 .mp3`） |
| `ZH Audio\…\ZH Instructie Chinees.mp3` | 中文使用说明，不需要 |
| `nn-werkboek-2015-herzien-omslag-lowres (1).pdf` | 与练习册完全相同的重复文件，忽略 |
| `ZH Audio\Naar Nederland Fotoboek\`、`nn-fotoboek-…pdf` | KNS 照片题，**不处理** |

练习册目录（书上页码）：第 1–20 课为字母、发音、认读；第 21–65 课为正课；第 35、45、55 课之后各有一次 Tussentoets（书上第 176、218、260 页）；书末有答案。

## 3. 环境（需用户同意后再安装）

已查明的现有条件：RTX 5090（32 GB）、CUDA 可用；ffmpeg 8.0.1 已在 PATH 中；Whisper large-v3 模型已下载在 `E:\program\bili2text\.cache\whisper\large-v3.pt`。

请**新建独立环境**，不要用 bili2text、ComfyUI 或旧 Dutch_Tutor 的环境：

```powershell
cd F:\Working_Projects\Dutch_Tutor_v2\NN_Pack
uv venv .venv --python 3.12
.\.venv\Scripts\activate
uv pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128
uv pip install stable-ts pymupdf rapidfuzz jsonschema requests
```

- 加载模型时直接指向已下载的文件，不要重新下载：
  `stable_whisper.load_model(r"E:\program\bili2text\.cache\whisper\large-v3.pt", device="cuda")`
  如果不接受路径，就用 `download_root=r"E:\program\bili2text\.cache\whisper"` 加模型名 `large-v3`。
- 验证：`torch.cuda.is_available()` 为 True；用第 21 课跑通一次对齐。出现 Triton 警告可以忽略。

## 4. 提取课文和练习（第 21–65 课）

1. 用 PyMuPDF 按课提取 PDF 页面的文字。同时把每页渲染成 PNG（`work\pages\`），用于人工核对排版。
2. **确定"录音里念的是哪些文字"**：先用 Whisper 转写该课录音（`language="nl"`、`word_timestamps=True`），拿转写结果去对照 PDF，找出录音对应的课文段落（通常是第一个练习"Luister naar de zinnen…"里的对话或短文，有时还有数字表等额外内容）。
3. 课文的最终文字**以 PDF 原文为准**（拼写、标点照抄）；转写只用来定位。录音开头念课题的部分作为 `S00`（`role: "title"`）。课文以外但录音里有的内容记为 `role: "extra"`。
4. 断句：一个句子一条；对话里一个人的一轮话如果有两句，拆成两条。
5. 练习：按 `03_PACK_FORMAT.md` §4 转成结构化数据，对照 PNG 检查。答案从书末答案页取。依赖图片的练习标 `skip`。
6. Tussentoets 1–3 同样处理，存为 `TT1`–`TT3`。

## 5. 录音逐句对齐与切分

1. 对每课：`model.align(audio, text, language="nl", original_split=True)`，其中 `text` 是第 4 步得到的句子，用换行连接，**包含标题句**。
2. 得到每句的 `start` / `end`。用 ffmpeg 切片：前后各留 0.15 秒（不越过相邻句的中点），加 10 毫秒淡入淡出；转成 MP3 单声道 44.1 kHz 128 kbps。整课原文件复制为 `full.mp3`。
3. **质检**：每个切片单独再用 Whisper 转写一次，与该句原文比较（rapidfuzz 的 `ratio`，比较前统一小写、去标点）：
   - `align_score` = 相似度 / 100
   - 低于 0.90 标 `low_align`，> 5 秒标 `over_5s`
4. 低于 0.90 的句子**人工处理**：听原音频、调时间点，标 `manual_fixed`。处理后仍不行的写进质检报告。
5. 质检报告 `qa\qa_report.md` 写清：每课句数、平均 align_score、各类标记的数量和句子 id、人工修改了哪些。

## 6. 第 1–20 课

1. 第 1–4 课（数字、钟点、颜色、人）和第 5–13 课（发音）：录音较长（6–16 分钟），里面混有说明和练习。
   - 转写时取词级时间戳，找出每课关键词（目录标题里的词，如第 7 课的 voet、doel、riem、wiel、huis、duim，以及页面上的其他示例词）**单独、清楚地念出的那一次**，切成 `K01`、`K02`…
   - 找不到干净片段的词，标 `no_audio`，后面用合成音补。
2. 第 14–19 课（情景小文）按正课的方法处理（`kind: "reading"`）。
3. 第 20 课（字母）：提取字母表及示例词，录音能切则切。
4. `sounds` 数组里只需要填 `grapheme` 和关键词关联；`note_zh` 留空。

## 7. 词表与词条

1. 用 PyMuPDF（或 `pdftotext` 不带 `-layout`）提取两份说明书第 18–28 页。原始文字是按栏输出的："荷兰语词"一行，后面跟着它的释义。按"Les NN"标题把词分到各课。
2. **核对**：同一课的荷中和荷英词表应该是同一批荷兰语词，按顺序一一对应。数量对不上的课逐个查清。粗略解析时，第 33、38、51、59 课的词数异常偏少，请重点检查。
3. 合并为词条（`03_PACK_FORMAT.md` §7）：
   - 词表列的是课文里的形式（如 `woont (wonen)`），合并到 lemma `wonen`，`woont` 记入 `forms_seen`
   - 补全词性、名词冠词和复数、动词形式、可分动词；固定表达单独成条
   - `zh_nn` / `en_nn` 照抄官方释义；`zh` / `en` 是整理后的释义
4. 给每课每个句子生成 `tokens`：每个词指向一个词条。课文里出现、但词表里没有的词（多半是更早课里学过的），也要映射到已有词条；实在没有的，新建词条并标 `"flags": ["not_in_nn_list"]`。
5. 第 1–20 课的关键词也建成词条。

## 8. 翻译与合成音

1. **翻译**：每个句子、练习小题、课题，都写 `zh`（简体）和 `en`。要求：
   - 意思准确，口语自然；人名地名保留原文
   - 礼貌形式体现出来：`u` 译"您"，`jij` / `je` 译"你"
   - 不加解释、不加括号注释
2. **合成音**（Azure，nl-NL）：
   - 密钥在用户电脑的环境变量 `AZURE_SPEECH_KEY` 和 `AZURE_SPEECH_REGION`（值为 `eastus`）中。**不要把密钥写进任何文件或日志。**
   - 需要合成的：所有 `audio` 为空、或标了 `no_audio` 的词条；`answer_oral` 题的题干；Tussentoets 里没有原版录音的听力题。
   - 声音用 `nl-NL-FennaNeural`。REST 接口，SSML 里设 `xml:lang="nl-NL"`。
   - **限速：每 3.2 秒最多 1 次请求**（免费层限制每 60 秒 20 次）。遇到 429 错误，等 60 秒再继续。
   - 缓存：文件名 = `sha1(voice + "|" + text)` 的前 16 位，存在 `audio\tts\`；词的读音另存一份到 `audio\words\<word_id>.mp3`。已存在的不重复生成。
   - 统一转成 MP3 单声道 44.1 kHz 128 kbps。

## 9. 试点 → 全量

### 9.1 试点（先做这些，做完停下）

- 第 21、22、23 课：课文、对齐切片、练习、翻译、这三课的词条和词的合成音
- 第 5 课：关键词切片
- `manifest.json`、`index.json`（只含这 4 课）、`qa_report.md`
- 用 jsonschema 按 `03_PACK_FORMAT.md` 自行写一个格式检查脚本，跑通

完成后给用户一份汇报（格式见第 10 步），**等用户把汇报转给审核会话确认后**，再开始全量。

### 9.2 全量

第 1–65 课 + TT1–TT3。每完成 10 课在 `LOG.md` 记一次进度。全部完成后重新生成 `manifest.json`、`index.json`、`qa_report.md`，再跑一次格式检查。

## 10. 汇报格式（试点和全量各一次）

```
## 资料包汇报（试点 / 全量）
- 范围：……
- 产出位置：F:\Working_Projects\Dutch_Tutor_v2\NN_Pack\nn-pack\
- 数量：课 x、句子 x、练习 x（跳过 x）、词条 x、音频文件 x
- 对齐：平均 align_score x；low_align x 句（已人工修 x，仍有问题 x）；over_5s x 句
- 词表核对：中英词表数量不一致的课及处理方式
- 合成音：生成 x 条，用时 x，是否遇到 429
- 格式检查：通过 / 失败（附错误）
- 不确定、需要决定的问题：……
- 附：NN21 的 lessons/NN21.json 全文；qa_report.md 全文
```
