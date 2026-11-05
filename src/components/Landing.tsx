import { useState } from "react";
import { ArrowRight, LoaderCircle, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import type { EditorCalendar, Slot } from "../../shared/calendar";
import { SlotContent } from "./SlotCard";
const previewSlots: Slot[] = [
  {
    id: "preview-1",
    title: "Slow morning, good coffee",
    startTime: "09:00",
    endTime: "10:00",
    description: "A little catch-up before the day begins.",
    location: "Our favorite corner café",
    url: "",
    color: "sage",
    icon: "coffee",
  },
  {
    id: "preview-2",
    title: "A little art & wandering",
    startTime: "11:00",
    endTime: "13:00",
    description: "No rush. Just follow what catches your eye.",
    location: "",
    url: "",
    color: "lavender",
    icon: "creative",
  },
  {
    id: "preview-3",
    title: "Something sweet",
    startTime: "15:00",
    endTime: "17:00",
    description: "",
    location: "The neighborhood bakery",
    url: "",
    color: "peach",
    icon: "meal",
  },
];
export function Landing({
  onCreate,
}: {
  onCreate: (token: string, calendar: EditorCalendar) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="landing">
      <div className="landing-copy">
        <form
          aria-labelledby="create-title"
          className="create-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim()) return;
            setBusy(true);
            setError("");
            void api<{ editToken: string; calendar: EditorCalendar }>(
              "/api/calendars",
              { method: "POST", body: JSON.stringify({ title, description }) },
            )
              .then((result) => onCreate(result.editToken, result.calendar))
              .catch((caught) =>
                setError(
                  caught instanceof Error
                    ? caught.message
                    : "Could not create your calendar.",
                ),
              )
              .finally(() => setBusy(false));
          }}
        >
          <h1 id="create-title" className="create-title">
            Create calendar
          </h1>
          <label className="field">
            Calendar title
            <input
              required
              maxLength={120}
              placeholder="e.g. A weekend with my favorite people"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="field">
            A little context <span className="optional">optional</span>
            <textarea
              maxLength={1000}
              rows={2}
              placeholder="What are we looking forward to?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button primary full-width create-button"
            type="submit"
            disabled={busy}
          >
            {busy ? (
              <LoaderCircle size={19} className="spin" />
            ) : (
              <Sparkles size={18} />
            )}
            {busy ? "Making room for your plans…" : "Create calendar"}
            {!busy && <ArrowRight size={18} />}
          </button>
        </form>
      </div>
      <div className="landing-preview" aria-label="Example calendar">
        <span className="preview-note">a little inspiration ↴</span>
        <div className="preview-paper">
          <div className="preview-heading">
            <span className="eyebrow">LET’S MAKE A DAY OF IT</span>
            <h2>
              A Saturday
              <br />
              well spent<span> ☀</span>
            </h2>
            <p>The best kind of plans, with the best kind of people.</p>
          </div>
          <div className="preview-date">
            <div className="date-tile">
              <span>NOV</span>
              <strong>7</strong>
            </div>
            <div>
              <strong>Saturday</strong>
              <span>Three little things to look forward to</span>
            </div>
          </div>
          <div className="preview-slots">
            {previewSlots.map((slot) => (
              <div className={`preview-slot color-${slot.color}`} key={slot.id}>
                <SlotContent slot={slot} />
              </div>
            ))}
          </div>
        </div>
        <span className="preview-sticker">
          small plans,
          <br />
          <em>happy hearts.</em>
        </span>
      </div>
    </main>
  );
}
