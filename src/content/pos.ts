import type { Pos } from "./packTypes";

/** Part-of-speech badge: Dutch abbreviation + Chinese (design §6). */
export const POS_LABEL: Record<Pos, { abbr: string; zh: string }> = {
  zn: { abbr: "zn.", zh: "名词" },
  ww: { abbr: "ww.", zh: "动词" },
  bn: { abbr: "bn.", zh: "形容词" },
  bw: { abbr: "bw.", zh: "副词" },
  vnw: { abbr: "vnw.", zh: "代词" },
  lidw: { abbr: "lidw.", zh: "冠词" },
  vz: { abbr: "vz.", zh: "介词" },
  vw: { abbr: "vw.", zh: "连词" },
  telw: { abbr: "telw.", zh: "数词" },
  tw: { abbr: "tw.", zh: "感叹词" },
  eigen: { abbr: "eigen.", zh: "专有名词" },
  uitdr: { abbr: "uitdr.", zh: "固定表达" },
};
