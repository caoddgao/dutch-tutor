import type { AudioRef } from "../content/model";
import type { Trilingual } from "../content/packTypes";

/** Exercise codes of design §3.1 */
export type ExerciseCode = "E1" | "E2" | "E3" | "E4" | "E5" | "E6" | "E7" | "E8";

export const CODE_TITLE: Record<ExerciseCode, string> = {
  E1: "听句选意思",
  E2: "看句选意思",
  E3: "听词选拼写",
  E4: "看拼写选读音",
  E5: "补全句子（口头）",
  E6: "问答（口头）",
  E7: "词块排序",
  E8: "课本练习",
};

export interface Prompt {
  /** Dutch shown on screen (may contain a blank "....." ) */
  nl?: string;
  /** Meaning shown with the prompt (e.g. "看中文") */
  zh?: string;
  en?: string;
  audio?: AudioRef;
  /** Revealed after answering */
  revealNl?: string;
  revealZh?: string;
  revealEn?: string;
}

export interface Option {
  /** Dutch text */
  nl?: string;
  zh?: string;
  en?: string;
}

interface Base {
  id: string;
  code: ExerciseCode;
  /** Shown already answered, not scored (book examples) */
  example?: boolean;
}

export interface ChoiceQuestion extends Base {
  kind: "choice";
  prompt: Prompt;
  options: Option[];
  answer: number;
}

export interface AudioChoiceQuestion extends Base {
  kind: "audio-choice";
  /** The word shown */
  nl: string;
  zh?: string;
  options: AudioRef[];
  answer: number;
}

export interface OrderQuestion extends Base {
  kind: "order";
  /** Correct order */
  blocks: string[];
  /** Order in which the blocks are offered */
  shuffled: number[];
  zh?: string;
  en?: string;
  audio?: AudioRef;
}

export interface MatchQuestion extends Base {
  kind: "match";
  left: string[];
  right: string[];
  /** [leftIndex, rightIndex] */
  pairs: [number, number][];
}

export interface OralSampleView extends Trilingual {
  audio?: AudioRef;
}

export interface OralQuestion extends Base {
  kind: "oral";
  /** E5: the situation; E6: the question */
  prompt: OralSampleView;
  /** E5: start of the sentence to finish */
  start?: OralSampleView;
  samples: OralSampleView[];
}

export type Question = ChoiceQuestion | AudioChoiceQuestion | OrderQuestion | MatchQuestion | OralQuestion;

export interface ExerciseGroup {
  id: string;
  code: ExerciseCode;
  instruction?: Trilingual;
  questions: Question[];
}
