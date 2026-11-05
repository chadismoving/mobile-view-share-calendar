import { useEffect, useState } from "react";
import { ArrowLeft, LoaderCircle, Sprout } from "lucide-react";
import type { Calendar, EditorCalendar } from "../shared/calendar";
import { api } from "./lib/api";
import { Landing } from "./components/Landing";
import { Editor, SharedCalendar } from "./components/CalendarPage";

type Route =
  | { type: "home" }
  | { type: "edit" | "share"; token: string }
  | { type: "missing" };
function route(): Route {
  const path = window.location.pathname;
  if (path === "/") return { type: "home" };
  const match = /^\/(edit|s)\/([A-Za-z0-9_-]{43})\/?$/.exec(path);
  return match
    ? { type: match[1] === "s" ? "share" : "edit", token: match[2] }
    : { type: "missing" };
}
export default function App() {
  const [currentRoute, setRoute] = useState(route);
  const [calendar, setCalendar] = useState<Calendar | EditorCalendar | null>(
    null,
  );
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const pop = () => {
      setCalendar(null);
      setError("");
      setRoute(route());
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (currentRoute.type !== "edit" && currentRoute.type !== "share") return;
    let live = true;
    void api<{ calendar: Calendar | EditorCalendar }>(
      `/api/${currentRoute.type === "share" ? "share" : "edit"}/${currentRoute.token}`,
    )
      .then((result) => {
        if (live) {
          setCalendar(result.calendar);
          setError("");
        }
      })
      .catch((caught) => {
        if (live)
          setError(
            caught instanceof Error
              ? caught.message
              : "This calendar is unavailable.",
          );
      });
    return () => {
      live = false;
    };
  }, [currentRoute, retry]);
  useEffect(() => {
    document.title = calendar
      ? `${calendar.title} · Daylight`
      : "Daylight — a little space for your plans";
  }, [calendar]);
  const missing = currentRoute.type === "missing";
  return (
    <div className="app-shell">
      {currentRoute.type === "home" ? (
        <Landing
          onCreate={(token, initial) => {
            window.history.pushState(null, "", `/edit/${token}`);
            setCalendar(initial);
            setRoute({ type: "edit", token });
          }}
        />
      ) : error || missing ? (
        <main className="page-message">
          <Sprout size={38} />
          <h1>
            {missing
              ? "A little off the path."
              : "We couldn’t open this calendar."}
          </h1>
          <p>
            {error ||
              "This page could not be found. Check that you have the complete link."}
          </p>
          <div>
            {!missing && (
              <button
                className="button primary"
                onClick={() => {
                  setError("");
                  setRetry((value) => value + 1);
                }}
              >
                Try again
              </button>
            )}
            {currentRoute.type !== "share" && (
              <a className="button secondary" href="/">
                <ArrowLeft size={17} /> Back home
              </a>
            )}
          </div>
        </main>
      ) : calendar &&
        currentRoute.type === "edit" &&
        "shareToken" in calendar ? (
        <Editor
          key={calendar.id}
          initial={calendar}
          token={currentRoute.token}
        />
      ) : calendar && currentRoute.type === "share" ? (
        <SharedCalendar calendar={calendar} token={currentRoute.token} />
      ) : (
        <main className="page-message" role="status">
          <LoaderCircle size={30} className="spin" />
          <p>Making a little room for your plans…</p>
        </main>
      )}
    </div>
  );
}
