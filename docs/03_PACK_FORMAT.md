# Naar Nederland 资料包格式（format_version 1）

> 版本 v1.0 草案 · 2026-10-08
> 生产者：DS（按 `04_DS_NN_PACK.md`）。使用者：Dutch Tutor 程序的导入功能和内容校验脚本。
> **资料包只存在用户电脑上，不进 GitHub 仓库。** 唯一进仓库的是 `index.json` 的副本 `nn-index.json`（只有目录摘要，不含课文）。

---

## 1. 目录结构

```
nn-pack/
  manifest.json                 # 资料包总信息
  index.json                    # 目录摘要（会复制进仓库，命名为 nn-index.json）
  words.json                    # 全部词条（第 21–65 课词表 + 发音课关键词）
  lessons/
    NN01.json … NN20.json       # 第 1–20 课（字母、发音、认读）
    NN21.json … NN65.json       # 正课
    TT1.json  TT2.json  TT3.json # 阶段测验 1–3（Tussentoets）
  audio/
    NN21/full.mp3               # 整课原版录音（复制自原始文件，改名）
    NN21/S00.mp3 S01.mp3 …      # 逐句切片
    NN05/K01.mp3 …              # 发音课关键词切片
    words/<word_id>.mp3         # 词的读音（原版切片或合成音）
    tts/<hash>.mp3              # 其他合成音（练习句等）
  qa/
    qa_report.md                # 质检报告（给人看）
    alignment/NN21.json …       # 对齐原始数据（调试用，程序不读）
```

- 所有文本用 UTF-8；JSON 缩进 2 格。
- 音频统一为 **MP3，单声道，44.1 kHz，128 kbps**。切片前后各留 0.15 秒，首尾加 10 毫秒淡入淡出，相邻切片不重叠。
- 文件名和 id 只用 ASCII 字母、数字、`_`、`-`。

## 2. manifest.json

```json
{
  "format_version": 1,
  "source": "Naar Nederland, werkboek herziene editie 2014 (pdf 2015) + handleiding zh/en + audio zh",
  "created_at": "2026-10-10T20:00:00+02:00",
  "producer": "DS",
  "lessons": ["NN01", "…", "NN65", "TT1", "TT2", "TT3"],
  "counts": { "lessons": 68, "sentences": 0, "words": 0, "exercises": 0, "audio_files": 0 },
  "tts_voices": { "default": "nl-NL-FennaNeural", "male": "nl-NL-MaartenNeural" }
}
```

## 3. lessons/NNxx.json（正课，第 21–65 课）

```json
{
  "id": "NN21",
  "nn_lesson": 21,
  "kind": "main",
  "title": { "nl": "…", "zh": "…", "en": "…" },
  "pdf_pages": [118, 121],
  "text_type": "dialogue",
  "audio_full": "audio/NN21/full.mp3",
  "sentences": [
    {
      "id": "NN21-S00",
      "role": "title",
      "nl": "Les 21. …",
      "zh": "第 21 课。……",
      "en": "Lesson 21. …",
      "speaker": null,
      "audio": "audio/NN21/S00.mp3",
      "start": 0.00, "end": 2.96, "duration": 2.96,
      "align_score": 0.98,
      "flags": []
    },
    {
      "id": "NN21-S01",
      "role": "line",
      "nl": "…",
      "zh": "…",
      "en": "…",
      "speaker": "A",
      "audio": "audio/NN21/S01.mp3",
      "start": 3.58, "end": 4.88, "duration": 1.30,
      "align_score": 0.97,
      "tokens": [ { "t": "…", "word_id": "w_dag" } ],
      "flags": []
    }
  ],
  "word_ids": ["w_wat", "w_naam", "…"],
  "exercises": [ ],
  "extras": [ ],
  "notes": ""
}
```

**字段说明**

- `text_type`：只允许三个值：`dialogue`（两人或多人对话）、`text`（一个人念的短文、叙述、信件、邮件等）、`mixed`（同一课里既有对话又有短文）。
- `role`：`title`（课题朗读）、`line`（课文句）、`extra`（课文之外录音里也有的内容，如数字表朗读）。
  - "词表朗读"（录音里单独念一串词，如数字表）：**每个词一条 `extra` 句子**，各自独立切片；同时把切片关联到对应词条，词条的 `audio` 用这个切片，`audio_source` 写 `nn:<句子id>`，这些词不再生成合成音。
- `speaker`：对话中的说话人 `A` / `B` / `C`…；`text` 类型一律为 `null`。**判断方法**（不用听录音）：按 PDF 排版，课文里有以"-"或"–"开头的行就是对话（`dialogue`），不带破折号的行 = `A`，带破折号的行 = `B`；整课没有破折号的用 `text`。破折号规律明显不对（如三人对话）的课先用 `text` + `null`，在汇报里列出。只按录音里的声音区分，不需要真名。
- `start` / `end`：在 `full.mp3` 里的秒数，保留 2 位小数。
- `align_score`：0–1，对齐质量（见 `04` 的质检方法）。
- `tokens`：把句子拆成词（用阿拉伯数字写的号码、邮编等不列；多词固定表达按最长匹配记成一个 token），每个词指向 `words.json` 里的词条；标点不列。用于"点词看词条"和生词检查。
- `flags`：可多选：
  - `over_5s`：时长 > 5 秒
  - `low_align`：align_score < 0.90
  - `manual_fixed`：人工调整过时间点
  - `no_audio`：录音里没有这一句
- `word_ids`：本课词表里列出的词。**顺序**：按在本课课文（`sentences`）里第一次出现的先后；课文里没出现的词排在最后，按中文词表顺序。
- `zh` / `en`：DS 翻译，要求自然、准确，意思对齐荷兰语原句；不要逐词硬译。

## 4. 练习（`exercises` 数组里的元素）

每道原书练习一个对象，下面的 `items` 是其中的小题：

```json
{
  "id": "NN21-E1",
  "nn_number": 1,
  "type": "true_false",
  "instruction": { "nl": "Omcirkel het goede antwoord.", "zh": "圈出正确答案。", "en": "Circle the correct answer." },
  "items": [
    { "id": "NN21-E1-1", "prompt": "…", "options": ["waar", "niet waar"], "answer": "waar",
      "zh": "…", "en": "…", "audio": null }
  ],
  "skip": false,
  "skip_reason": null
}
```

| `type` | 原书形式 | items 字段 |
|---|---|---|
| `true_false` | waar – niet waar | `prompt`、`options`（固定两个）、`answer` |
| `choose_one` | 两个或多个里圈一个 | `prompt`（可含 `.....` 空位）、`options`、`answer` |
| `match` | 连线 | `left`（数组）、`right`（数组）、`pairs`（`[[0,2],[1,0],…]`） |
| `fill_choice` | 给定词库选词填空 | `bank`（词库，放在练习层）、每题 `prompt`（含 `.....`）、`answer` |
| `answer_oral` | "Geef antwoord" 口头回答 | `prompt`、`sample_answers`（数组）；程序做成 E6 题型 |
| `order` | 排序 | `tokens`（打乱前的正确顺序） |
| `other` | 以上都不是 | `raw`（原文），并设 `skip: true` |

- 书里已经填好、作示例的小题：**照样收进 `items`**，题干还原成带 `.....` 空位的形式，`answer` 取答案页的值，另加 `"example": true`（程序把它当作已答好的示范显示，不计分）。这样词库和答案页一一对应。
- 依赖图片才能做的练习：`skip: true`，`skip_reason: "needs_image"`。
- 带"EXTRA"或橙色星号的内容也要收录，**按星号实际标的范围打标记**：星号标整道练习 → 练习层加 `"extra": true`；星号只标其中一组小题 → 只在那些小题上加 `"extra": true`。这个标记只作记录，程序照常显示（用户属于高学历学习路线，额外练习都要做）。
- 答案取自书末的答案页；书里没有答案的题，DS 给出答案并加 `"answer_by": "DS"`。
- `zh` / `en`：小题题干的翻译，可选，建议填写。

## 4A. EXTRA 例句框（`extras` 数组）

书里没有编号、没有题目说明的橙色"EXTRA"方框，内容通常是一组展示语法规律的例句（如 Ik ben … / Jij bent … / Ben jij …?）。**不放进 `exercises`**，放在课的 `extras` 数组里，程序会把它们用作小贴士的例句：

```json
"extras": [
  { "id": "NN22-X1", "pdf_page": 121,
    "sentences": [
      { "id": "NN22-X1-1", "nl": "…", "zh": "…", "en": "…", "audio": "audio/tts/<hash>.mp3", "audio_source": "tts:nl-NL-FennaNeural" }
    ] }
]
```

- 每句都要有 `zh` / `en` 翻译；录音里有这句就切原版，没有就生成合成音。
- 每句也要生成 `tokens`（同课文句子）。

## 5. 第 1–20 课（`kind`: `phonics` 或 `reading`）

```json
{
  "id": "NN07",
  "nn_lesson": 7,
  "kind": "phonics",
  "title": { "nl": "…", "zh": "…", "en": "…" },
  "pdf_pages": [46, 56],
  "audio_full": "audio/NN07/full.mp3",
  "sounds": [
    { "grapheme": "oe", "keywords": ["K01", "K02"], "note_zh": "类似汉语 'u'，比如……" }
  ],
  "keywords": [
    { "id": "NN07-K01", "nl": "…", "word_id": "w_…", "audio": "audio/NN07/K01.mp3",
      "start": 12.30, "end": 13.10, "align_score": 0.95, "flags": [] }
  ],
  "sentences": [],
  "exercises": []
}
```

- 发音课**也收练习**：放在 `exercises`，题型同 §4；另增一个题型 `listen_choose`（听一个词、从几个写法里选）：每题 `audio`（从原版录音切出，切不出就用合成音）、`options`、`answer`。录音里成句朗读的内容照常放进 `sentences`。
- 遇到任何套不进现有题型的练习：`type: "other"` + `skip: true`，在汇报里列出，不要停下来问。
- `kind: "reading"` 用于第 14–19 课这类情景小文，结构同正课（有 `sentences`）。
- `sounds` 按**课文要练的音（写法）**分组：每个不同的元音/辅音写法一条，`keywords` 列出含这个音的关键词。例：第 5 课 mes、bel → `e`；kam、bal → `a`；kip、lip → `i`。课标题里的辅音不单独成组，除非这一课专门练这个辅音（如 g/ch、sch）。
- `note_zh` 是发音要点，可以先空着；P 课的发音说明最终由施工会话写，DS 不必写。

## 6. 阶段测验 TT1–TT3

结构同正课，`kind: "test"`，只有 `exercises`；有录音的题在题目上挂 `audio`。

## 7. words.json

```json
[
  {
    "id": "w_wonen",
    "lemma": "wonen",
    "pos": "ww",
    "article": null,
    "plural": null,
    "verb_forms": { "ik": "woon", "jij": "woont", "hij": "woont", "wij": "wonen", "pp": "gewoond", "aux": "hebben" },
    "separable": null,
    "forms_seen": ["woont", "woon"],
    "zh": "居住，住",
    "en": "to live, to reside",
    "zh_nn": "住",
    "en_nn": "live",
    "first_lesson": "NN21",
    "lessons": ["NN21", "NN28"],
    "audio": "audio/words/w_wonen.mp3",
    "audio_source": "tts:nl-NL-FennaNeural",
    "flags": []
  }
]
```

- `pos` 取值：`zn` 名词 · `ww` 动词 · `bn` 形容词 · `bw` 副词 · `vnw` 代词 · `lidw` 冠词 · `vz` 介词 · `vw` 连词 · `telw` 数词 · `tw` 感叹词 · `eigen` 专有名词 · `uitdr` 固定表达。
- 名词：`article` 必填（`de` / `het` / `de/het`），`plural` 尽量填。
- 动词：`verb_forms` 填齐；`separable` 写拆开的形式，如 `"op|bellen"`。
- `zh_nn` / `en_nn`：两份官方词表的**原始释义**，照抄；`zh` / `en`：DS 整理后的释义，可以和原始的一样。
- NN 词表按"课文里出现的形式"列词（如 `woont (wonen)`）。整理时**合并到同一个 lemma**，原形式记进 `forms_seen`。
- 固定表达（如 `tot ziens`、`even denken`）单独成条，`pos: "uitdr"`。
- `audio_source`：`nn:NN21-S05`（从原版句子里切出的，仅在词单独朗读、切得干净时使用）或 `tts:<voice>`。

## 8. index.json（会进仓库，不含课文）

```json
{
  "format_version": 1,
  "lessons": [
    {
      "id": "NN21", "kind": "main",
      "title": { "nl": "…", "zh": "…", "en": "…" },
      "sentence_count": 20, "new_word_count": 60,
      "total_seconds": 95.7, "max_sentence_seconds": 3.1, "over_5s_count": 0,
      "exercise_count": 6, "skipped_exercises": 0,
      "new_lemmas": ["wat", "naam", "…"]
    }
  ]
}
```

- `new_word_count` / `new_lemmas` 只算 `first_lesson` 就是本课的词（以前课里出现过的不算新词，但仍留在 `word_ids` 里）。
- `new_lemmas` 只列词的原形，供施工会话编排课程、写补充内容时避开或复用。

## 9. 版本规则

- 改了格式就把 `format_version` 加 1，程序拒绝导入不认识的版本。
- 只更新内容、不改格式时，重新生成 `manifest.json` 的 `created_at` 即可。程序按这个时间判断是否需要重新导入。
