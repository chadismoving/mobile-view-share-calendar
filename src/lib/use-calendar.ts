import { useCallback, useEffect, useRef, useState } from "react";
import {
  contentOf,
  contentSchema,
  type CalendarContent,
  type EditorCalendar,
} from "../../shared/calendar";
import { api, ApiError } from "./api";

type Status = "saved" | "unsaved" | "saving" | "error" | "conflict";
type StoredDraft = { content: CalendarContent; revision: number };
const storage = {
  read(key: string): StoredDraft | null {
    try {
      const stored = JSON.parse(
        localStorage.getItem(key) ?? "null",
      ) as StoredDraft | null;
      if (!stored || !Number.isInteger(stored.revision)) return null;
      const result = contentSchema.safeParse(stored.content);
      return result.success
        ? { content: result.data, revision: stored.revision }
        : null;
    } catch {
      return null;
    }
  },
  write(key: string, value: StoredDraft) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Autosave still works when storage is unavailable. */
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* Private browsing may block storage. */
    }
  },
};
export function useCalendar(initial: EditorCalendar, token: string) {
  const key = `daylight-draft:${initial.id}`;
  const [recovered] = useState(() => storage.read(key));
  const [content, setContent] = useState<CalendarContent>(
    () => recovered?.content ?? contentOf(initial),
  );
  const [meta, setMeta] = useState(initial);
  const [status, setStatus] = useState<Status>(
    recovered
      ? recovered.revision !== initial.revision
        ? "conflict"
        : "unsaved"
      : "saved",
  );
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<EditorCalendar | null>(
    recovered && recovered.revision !== initial.revision ? initial : null,
  );
  const [online, setOnline] = useState(navigator.onLine);
  const latest = useRef(content);
  const revision = useRef(initial.revision);
  const lastSaved = useRef(JSON.stringify(contentOf(initial)));
  const blocked = useRef(
    Boolean(recovered && recovered.revision !== initial.revision),
  );
  const running = useRef<Promise<boolean> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const change = useCallback(
    (
      next: CalendarContent | ((current: CalendarContent) => CalendarContent),
    ) => {
      const value = typeof next === "function" ? next(latest.current) : next;
      latest.current = value;
      storage.write(key, { content: value, revision: revision.current });
      setContent(value);
      if (!blocked.current) {
        setStatus("unsaved");
        setError("");
      }
    },
    [key],
  );

  const flush = useCallback(async (): Promise<boolean> => {
    if (running.current) return running.current;
    if (blocked.current) return false;
    const work = async () => {
      while (JSON.stringify(latest.current) !== lastSaved.current) {
        const parsed = contentSchema.safeParse(latest.current);
        if (!parsed.success) {
          setStatus("error");
          setError(parsed.error.issues[0].message);
          return false;
        }
        if (!navigator.onLine) {
          setStatus("error");
          setError(
            "You’re offline. Your draft is kept on this device and will save when you reconnect.",
          );
          return false;
        }
        const snapshot = latest.current;
        const fingerprint = JSON.stringify(snapshot);
        setStatus("saving");
        setError("");
        try {
          const result = await api<{ revision: number; updatedAt: string }>(
            `/api/edit/${token}`,
            {
              method: "PUT",
              body: JSON.stringify({
                content: parsed.data,
                revision: revision.current,
              }),
            },
          );
          revision.current = result.revision;
          lastSaved.current = fingerprint;
          if (!mounted.current) return true;
          setMeta((current) => ({ ...current, ...result }));
          if (JSON.stringify(latest.current) === fingerprint)
            storage.remove(key);
          else
            storage.write(key, {
              content: latest.current,
              revision: revision.current,
            });
        } catch (caught) {
          if (!mounted.current) return false;
          if (
            caught instanceof ApiError &&
            caught.status === 409 &&
            caught.data?.calendar
          ) {
            blocked.current = true;
            setConflict(caught.data.calendar as EditorCalendar);
            setStatus("conflict");
          } else setStatus("error");
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not save. Your draft is still here.",
          );
          return false;
        }
      }
      if (mounted.current) {
        setStatus("saved");
        storage.remove(key);
      }
      return true;
    };
    running.current = work();
    try {
      return await running.current;
    } finally {
      running.current = null;
    }
  }, [key, token]);

  useEffect(() => {
    if (status !== "unsaved" || blocked.current) return;
    const timer = window.setTimeout(() => {
      void flush();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [content, flush, status]);
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine && !blocked.current) void flush();
    };
    const warn = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== lastSaved.current) {
        event.preventDefault();
      }
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("beforeunload", warn);
    };
  }, [flush]);
  const useServer = () => {
    if (!conflict) return;
    revision.current = conflict.revision;
    lastSaved.current = JSON.stringify(contentOf(conflict));
    latest.current = contentOf(conflict);
    blocked.current = false;
    setContent(contentOf(conflict));
    setMeta(conflict);
    setConflict(null);
    setError("");
    setStatus("saved");
    storage.remove(key);
  };
  const keepDraft = async () => {
    if (!conflict) return;
    revision.current = conflict.revision;
    setMeta(conflict);
    blocked.current = false;
    setConflict(null);
    setError("");
    return flush();
  };
  const rotate = async () => {
    if (!(await flush()))
      throw new Error("Save your changes before replacing the share link.");
    const result = await api<{
      shareToken: string;
      revision: number;
      updatedAt: string;
    }>(`/api/edit/${token}/share`, {
      method: "POST",
      body: JSON.stringify({ revision: revision.current }),
    });
    revision.current = result.revision;
    setMeta((current) => ({ ...current, ...result }));
  };
  return {
    content,
    change,
    meta,
    status,
    error,
    online,
    flush,
    conflict,
    useServer,
    keepDraft,
    rotate,
    recovered: Boolean(recovered),
  };
}
