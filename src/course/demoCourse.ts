// Demo data for the static home page and course map (stage 1). Replaced by real content in stage 2.
import type { CourseSection, LessonStatus, LessonSummary } from "./types";

function lesson(
  id: string,
  kind: LessonSummary["kind"],
  code: string,
  nl: string,
  zh: string,
  en: string,
  status: LessonStatus,
  progress: number,
): LessonSummary {
  return { id, kind, code, title: { nl, zh, en }, status, progress };
}

export const DEMO_SECTIONS: CourseSection[] = [
  {
    id: "phonics",
    title: "发音入门",
    lessons: [
      lesson("P01", "phonics", "P01", "a · aa", "短音 a 和长音 aa", "Short a and long aa", "mastered", 1),
      lesson("P02", "phonics", "P02", "e · ee", "短音 e 和长音 ee", "Short e and long ee", "mastered", 1),
      lesson("P03", "phonics", "P03", "o · oo", "短音 o 和长音 oo", "Short o and long oo", "mastered", 1),
      lesson("P04", "phonics", "P04", "u · uu", "短音 u 和长音 uu", "Short u and long uu", "mastered", 1),
      lesson("P05", "phonics", "P05", "i · ie", "短音 i 和长音 ie", "Short i and long ie", "studied", 0.7),
      lesson("P06", "phonics", "P06", "oe · eu", "oe 和 eu", "oe and eu", "studied", 0.55),
      lesson("P07", "phonics", "P07", "ui · ou · au", "ui、ou 和 au", "ui, ou and au", "studied", 0.4),
      lesson("P08", "phonics", "P08", "ei · ij", "ei 和 ij", "ei and ij", "studied", 0.35),
      lesson("P09", "phonics", "P09", "g · ch · sch", "g、ch 和 sch", "g, ch and sch", "studied", 0.3),
      lesson("P10", "phonics", "P10", "r · l · w", "r、l 和 w", "r, l and w", "studied", 0.2),
    ],
  },
  {
    id: "main",
    title: "正课",
    lessons: [
      lesson("NN21", "main", "第 21 课", "Wat is uw naam?", "您叫什么名字？", "What is your name?", "studied", 0.6),
      lesson("NN22", "main", "第 22 课", "Hoe gaat het?", "你好吗？", "How are you?", "studied", 0.35),
      lesson("NN23", "main", "第 23 课", "Waar woont u?", "您住在哪里？", "Where do you live?", "new", 0.45),
      lesson("NN24", "main", "第 24 课", "Mijn familie", "我的家人", "My family", "new", 0),
      lesson("NN25", "main", "第 25 课", "Hoe laat is het?", "现在几点？", "What time is it?", "new", 0),
      lesson("NN26", "main", "第 26 课", "Boodschappen doen", "买东西", "Doing the shopping", "new", 0),
      lesson("NN27", "main", "第 27 课", "Bij de dokter", "看医生", "At the doctor's", "new", 0),
      lesson("NN28", "main", "第 28 课", "Het weer", "天气", "The weather", "new", 0),
      lesson("NN29", "main", "第 29 课", "Mijn werk", "我的工作", "My work", "new", 0),
      lesson("NN30", "main", "第 30 课", "Op het station", "在火车站", "At the station", "new", 0),
    ],
  },
  {
    id: "tests",
    title: "阶段测验",
    lessons: [
      lesson("TT1", "test", "测验 1", "Tussentoets 1", "第 21–35 课", "Lessons 21–35", "new", 0),
      lesson("TT2", "test", "测验 2", "Tussentoets 2", "第 36–45 课", "Lessons 36–45", "new", 0),
      lesson("TT3", "test", "测验 3", "Tussentoets 3", "第 46–55 课", "Lessons 46–55", "new", 0),
    ],
  },
];

/** Where the learner left off. */
export const DEMO_CONTINUE = {
  lessonId: "NN23",
  stepLabel: "第 2 步 · 逐句学",
  position: 9,
  total: 20,
};

export const DEMO_STATS = {
  reviewsDueToday: 18,
  sentencesLearned: 126,
  streakDays: 5,
};
