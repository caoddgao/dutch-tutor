import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDictionary, buildLesson } from "../content/model";
import type { PackLesson, PackWord } from "../content/packTypes";
import { fixtureContent, FIXTURE_PACK_DIR } from "../test/services";
import { examRecordingItems, lessonRecordingItems, packRecordingItems } from "./catalog";
import { transcriptHtml } from "./transcript";

const readPack = (id: string): PackLesson =>
  JSON.parse(readFileSync(join(FIXTURE_PACK_DIR, "lessons", `${id}.json`), "utf8"));
const words = JSON.parse(readFileSync(join(FIXTURE_PACK_DIR, "words.json"), "utf8")) as PackWord[];

describe("recording catalog", () => {
  it("includes original lines, added lines, oral prompts and answers, and words under their playback IDs", () => {
    const bundle = fixtureContent();
    const dict = buildDictionary(bundle, words);
    const pack = readPack("NN21");
    const lesson = buildLesson(bundle, dict, "NN21", { own: bundle.lessons.NN21, pack })!;
    const items = lessonRecordingItems(lesson, bundle);
    const ids = items.map((item) => item.id);
    expect(ids).toContain("NN21-S00");
    expect(ids).toContain("NN21-S09"); // original line without audio must still be recordable
    expect(ids).toContain("NN21-A01");
    expect(ids).toContain("NN21-O1-1-C");
    expect(ids).toContain("NN21-O1-1-B");
    expect(ids).toContain("NN21-O1-1-A1");
    expect(ids).toContain("NN21-O2-1-Q");
    expect(ids).toContain("NN21-E6-1");
    expect(ids).toContain("w_brood");
    expect(new Set(ids).size).toBe(ids.length);
    expect(items.find((item) => item.id === "NN21-S09")?.origin).toBe("book");
    expect(items.find((item) => item.id === "NN21-A01")?.origin).toBe("own");
  });

  it("keeps early original lessons accessible and lists mock exam speech", () => {
    const bundle = fixtureContent();
    const dict = buildDictionary(bundle, words);
    const early = packRecordingItems(readPack("NN05"), dict, bundle);
    expect(early.some((item) => item.id.startsWith("NN05-S"))).toBe(true);
    expect(examRecordingItems(bundle)).toEqual([]);
  });

  it("escapes imported book text when making a local printable transcript", () => {
    const html = transcriptHtml("<第 1 课>", [
      { id: "x", nl: "Ik <ben> & jij", zh: "我 < 你", kind: "sentence", origin: "book", audio: { id: "x" } },
    ]);
    expect(html).toContain("&lt;第 1 课&gt;");
    expect(html).toContain("Ik &lt;ben&gt; &amp; jij");
    expect(html).toContain("原书 · 句子");
    expect(html).not.toContain("Ik <ben>");
  });
});
