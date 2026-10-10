import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AudioCtx, type AudioContextValue } from "../audio/context";
import type { RtWord } from "../content/model";
import { WordEntry } from "./WordEntry";

const audio = { resolve: () => null, rate: 1, setRate: () => undefined } as unknown as AudioContextValue;

const word = (over: Partial<RtWord>): RtWord => ({
  id: "w_vaak",
  lemma: "vaak",
  pos: "bw",
  article: null,
  plural: null,
  verbForms: null,
  separable: null,
  zh: "经常",
  en: "often",
  audio: { id: "w_vaak" },
  ...over,
});

const show = (w: RtWord) =>
  render(
    <AudioCtx.Provider value={audio}>
      <WordEntry word={w} showPastParticiple={false} />
    </AudioCtx.Provider>,
  );

describe("word entry", () => {
  it("shows the original word-list meanings that differ from ours", () => {
    const { container } = show(word({ zhNn: "常常", enNn: "frequently" }));
    expect(container.querySelector(".word-entry-nn")?.textContent).toBe("原词表常常 · frequently");
  });

  it("shows only the side an official list has (03 §7: null when a list lacks the word)", () => {
    const { container } = show(word({ zhNn: "常常", enNn: undefined }));
    expect(container.querySelector(".word-entry-nn")?.textContent).toBe("原词表常常");
  });

  it("shows nothing when neither list has the word", () => {
    const { container } = show(word({}));
    expect(container.querySelector(".word-entry-nn")).toBeNull();
    expect(screen.getByText("经常")).toBeTruthy();
  });
});
