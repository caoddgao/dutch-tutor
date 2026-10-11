import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PackBackend, PackInfo } from "../pack/backend";
import { ContentContext, type ContentContextValue, type PackStatus } from "./context";
import { buildCourseView, buildDictionary, buildLesson, packLessonsFor, type RtLesson } from "./model";
import type { ContentBundle } from "./ownTypes";
import { PACK_FORMAT_VERSION, type PackIndex, type PackLesson, type PackWord } from "./packTypes";
import { ttsKeyLookup } from "./ttsTexts";

interface Props {
  bundle: ContentBundle;
  backend: PackBackend;
  ttsUrls: Record<string, string>;
  children: ReactNode;
}

interface PackState {
  status: PackStatus;
  info: PackInfo | null;
  index: PackIndex | null;
  words: PackWord[];
  update: string | null;
}

const EMPTY: PackState = { status: "loading", info: null, index: null, words: [], update: null };

export function ContentProvider({ bundle, backend, ttsUrls, children }: Props) {
  const [pack, setPack] = useState<PackState>(EMPTY);
  const [generation, setGeneration] = useState(0);
  const lessonCache = useRef(new Map<string, Promise<PackLesson | null>>());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let info: PackInfo | null = null;
      try {
        info = await backend.info();
        if (!info.manifest) {
          if (!cancelled) setPack({ ...EMPTY, status: "none", info });
          return;
        }
        if (info.manifest.format_version !== PACK_FORMAT_VERSION) {
          if (!cancelled) setPack({ ...EMPTY, status: "outdated", info });
          return;
        }
        const [index, words] = await Promise.all([
          backend.readText("index.json").then((t) => JSON.parse(t) as PackIndex),
          backend.readText("words.json").then((t) => JSON.parse(t) as PackWord[]),
        ]);
        if (cancelled) return;
        setPack({ status: "ready", info, index, words, update: null });
        const installed = info;
        if (installed.source_dir) {
          backend
            .inspect(installed.source_dir)
            .then((m) => {
              if (!cancelled && m.created_at !== installed.manifest?.created_at)
                setPack((p) => ({ ...p, update: m.created_at }));
            })
            .catch(() => {
              // the original folder was moved or removed: nothing to compare with
            });
        }
      } catch (err) {
        console.error("pack load failed", err);
        // info stays when only the files are broken, so settings can still offer re-importing
        if (!cancelled) setPack({ ...EMPTY, status: "error", info });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backend, generation]);

  const dict = useMemo(() => buildDictionary(bundle, pack.words), [bundle, pack.words]);
  const course = useMemo(() => buildCourseView(bundle, pack.index), [bundle, pack.index]);
  const lookup = useMemo(() => ttsKeyLookup(bundle.tts), [bundle.tts]);

  const readPackLesson = useCallback(
    (id: string): Promise<PackLesson | null> => {
      if (pack.status !== "ready") return Promise.resolve(null);
      let p = lessonCache.current.get(id);
      if (!p) {
        p = backend
          .readText(`lessons/${id}.json`)
          .then((t) => JSON.parse(t) as PackLesson)
          .catch(() => null);
        lessonCache.current.set(id, p);
      }
      return p;
    },
    [backend, pack.status],
  );

  const loadLesson = useCallback(
    async (id: string): Promise<RtLesson | null> => {
      const need = packLessonsFor(bundle, id);
      const present = (ls: (PackLesson | null)[]) => ls.filter((l): l is PackLesson => !!l);
      const [main, reading, linked, tipPacks] = await Promise.all([
        need.main ? readPackLesson(need.main) : Promise.resolve(null),
        need.reading ? readPackLesson(need.reading) : Promise.resolve(null),
        Promise.all(need.linked.map(readPackLesson)).then(present),
        Promise.all(need.tipPacks.map(readPackLesson)).then(present),
      ]);
      return buildLesson(bundle, dict, id, {
        own: bundle.lessons[id],
        pack: main ?? undefined,
        linked,
        reading: reading ?? undefined,
        tipPacks,
      });
    },
    [bundle, dict, readPackLesson],
  );

  const importPack = useCallback(
    async (dir: string) => {
      await backend.importFrom(dir);
      lessonCache.current.clear();
      setPack(EMPTY);
      setGeneration((g) => g + 1);
    },
    [backend],
  );

  const ttsUrl = useCallback(
    (voice: string, text: string) => {
      const key = lookup(voice, text);
      return key ? (ttsUrls[key] ?? null) : null;
    },
    [lookup, ttsUrls],
  );

  const value: ContentContextValue = useMemo(
    () => ({
      bundle,
      backend,
      packStatus: pack.status,
      packInfo: pack.info,
      packIndex: pack.index,
      packUpdate: pack.update,
      dict,
      course,
      loadLesson,
      importPack,
      ttsUrl,
    }),
    [bundle, backend, pack, dict, course, loadLesson, importPack, ttsUrl],
  );
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}
