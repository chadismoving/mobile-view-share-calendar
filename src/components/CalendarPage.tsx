import { useState } from "react";
import {
  CalendarDays,
  CheckCheck,
  CloudOff,
  Image,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Share2,
  WifiOff,
} from "lucide-react";
import {
  byTime,
  contentOf,
  dateObject,
  formatDate,
  localDate,
  type Calendar,
  type CalendarContent,
  type EditorCalendar,
  type Slot,
} from "../../shared/calendar";
import { Timeline } from "./Timeline";
import { SlotSheet } from "./SlotSheet";
import { Sheet } from "./Sheet";
import { ShareSheet } from "./ShareSheet";
import { ExportSheet } from "./ExportSheet";
import { useCalendar } from "../lib/use-calendar";

type Model = ReturnType<typeof useCalendar>;
function DateSheet({
  content,
  onAdd,
  onClose,
}: {
  content: CalendarContent;
  onAdd: (date: string) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(() => {
    const last = content.days.at(-1);
    if (!last) return localDate();
    const value = dateObject(last.date);
    value.setDate(value.getDate() + 1);
    return localDate(value);
  });
  const [error, setError] = useState("");
  return (
    <Sheet
      title="Make room for another day"
      subtitle="One more date, a few more possibilities."
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const selectedDate = String(
            new FormData(event.currentTarget).get("date") ?? date,
          );
          if (content.days.some((day) => day.date === selectedDate)) {
            setError(
              "That date is already in your calendar. Add a slot to it below.",
            );
            return;
          }
          onAdd(selectedDate);
        }}
      >
        <label className="field">
          Choose a date
          <input
            autoFocus
            required
            type="date"
            name="date"
            min="1900-01-01"
            max="2200-12-31"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            onInput={(event) => setDate(event.currentTarget.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="sheet-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button primary grow">
            <Plus size={18} /> Add date
          </button>
        </div>
      </form>
    </Sheet>
  );
}
function CalendarView({
  content,
  readOnly,
  model,
}: {
  content: CalendarContent;
  readOnly: boolean;
  model?: Model;
}) {
  const [modal, setModal] = useState<"date" | "share" | "export" | null>(null);
  const [selected, setSelected] = useState<{
    slot: Slot;
    dayId: string;
  } | null>(null);
  const [actionError, setActionError] = useState("");
  const [preparingShare, setPreparingShare] = useState(false);
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const slots = content.days.reduce((sum, day) => sum + day.slots.length, 0);
  const change = (next: CalendarContent) => model?.change(next);
  const openShare = async () => {
    if (!model) return;
    setPreparingShare(true);
    setActionError("");
    if (await model.flush()) setModal("share");
    else
      setActionError(
        "Save your changes before sharing. Check the save notice below.",
      );
    setPreparingShare(false);
  };
  const saveSlot = (slot: Slot, target: string) => {
    if (!selected) return;
    change({
      ...content,
      days: content.days.map((day) => {
        const alreadyHere = day.slots.some((item) => item.id === slot.id);
        let updated = day.slots.filter((item) => item.id !== slot.id);
        if (day.id === target) {
          if (alreadyHere)
            updated.splice(
              day.slots.findIndex((item) => item.id === slot.id),
              0,
              slot,
            );
          else updated.push(slot);
          if (!day.manualOrder) updated = updated.sort(byTime);
        }
        return { ...day, slots: updated };
      }),
    });
    setSelected(null);
  };
  const addSlot = (dayId: string) => {
    if (slots >= 500) {
      setActionError("This calendar has reached its 500-slot limit.");
      return;
    }
    const day = content.days.find((item) => item.id === dayId)!;
    if (day.slots.length >= 100) return;
    setSelected({
      dayId,
      slot: {
        id: crypto.randomUUID(),
        startTime: "15:00",
        endTime: "17:00",
        title: "",
        description: "",
        location: "",
        url: "",
        color: "sage",
        icon: "",
      },
    });
  };
  const statusLabels = {
    saved: "All changes saved",
    unsaved: "Unsaved changes",
    saving: "Saving your plans…",
    error: "Not saved yet",
    conflict: "Changes need your attention",
  };
  return (
    <main className="calendar-page">
      <div className="calendar-intro">
        <div className="calendar-title-row">
          <div className="calendar-title-area">
            {readOnly ? (
              <h1>{content.title}</h1>
            ) : (
              <label className="sr-title-label">
                <span className="sr-only">Calendar title</span>
                <textarea
                  className="title-input"
                  rows={1}
                  maxLength={120}
                  value={content.title}
                  onChange={(event) =>
                    model?.change({ ...content, title: event.target.value })
                  }
                  placeholder="Name your calendar"
                />
              </label>
            )}
            <div className="calendar-description">
              {readOnly ? (
                content.description && <p>{content.description}</p>
              ) : (
                <label>
                  <span className="sr-only">Calendar description</span>
                  <textarea
                    rows={1}
                    maxLength={1000}
                    value={content.description}
                    onChange={(event) =>
                      model?.change({
                        ...content,
                        description: event.target.value,
                      })
                    }
                    placeholder="A little note about these days…"
                  />
                </label>
              )}
            </div>
          </div>
        </div>
        <div className="calendar-toolbar">
          <div className="toolbar-buttons">
            {!readOnly && (
              <button
                className="button primary"
                onClick={() => void openShare()}
                disabled={preparingShare}
              >
                {preparingShare ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <Share2 size={17} />
                )}{" "}
                Share calendar
              </button>
            )}
            <button
              className={`button ${readOnly ? "primary" : "secondary"}`}
              onClick={() => setModal("export")}
            >
              <Image size={17} /> Export image
            </button>
          </div>
          {model ? (
            <div className={`save-status status-${model.status}`} role="status">
              {!model.online ? (
                <WifiOff size={14} />
              ) : model.status === "saving" ? (
                <LoaderCircle size={14} className="spin" />
              ) : model.status === "saved" ? (
                <CheckCheck size={15} />
              ) : (
                <CloudOff size={14} />
              )}
              <span>
                {!model.online
                  ? "Offline · draft on device"
                  : statusLabels[model.status]}
              </span>
            </div>
          ) : (
            <span className="read-only">
              <LockKeyhole size={13} /> View-only calendar
            </span>
          )}
        </div>
      </div>
      {actionError && (
        <div className="notice error" role="alert">
          {actionError}
          <button className="text-button" onClick={() => setActionError("")}>
            Dismiss
          </button>
        </div>
      )}
      {model?.recovered && !recoveryDismissed && (
        <div className="notice">
          <span>Your unfinished draft was recovered from this device.</span>
          <button
            className="text-button"
            onClick={() => setRecoveryDismissed(true)}
          >
            Got it
          </button>
        </div>
      )}
      {model?.status === "error" && (
        <div className="notice error" role="alert">
          <p>{model.error}</p>
          <button
            className="button secondary small"
            onClick={() => void model.flush()}
          >
            Retry save
          </button>
        </div>
      )}
      {model?.conflict && (
        <div className="notice conflict" role="alert">
          <strong>This plan changed in another tab.</strong>
          <p>
            Your draft is still here. Choose which version to keep. Saving yours
            replaces the other tab’s changes.
          </p>
          <div>
            <button
              className="button secondary small"
              onClick={() => {
                if (
                  window.confirm(
                    "Discard this device’s unsaved draft and load the saved calendar?",
                  )
                )
                  model.useServer();
              }}
            >
              Use saved version
            </button>
            <button
              className="button primary small"
              onClick={() => {
                if (
                  window.confirm(
                    "Save this draft and replace the changes from the other tab?",
                  )
                )
                  void model.keepDraft();
              }}
            >
              Save my version
            </button>
          </div>
        </div>
      )}
      {content.days.length === 0 ? (
        <div className="calendar-empty">
          <div className="empty-illustration">
            <CalendarDays size={42} strokeWidth={1.3} />
            <span>✦</span>
          </div>
          <h2>
            {readOnly
              ? "Good things are on the way."
              : "A blank page, a lovely beginning."}
          </h2>
          <p>
            {readOnly
              ? "No dates have been added to this calendar yet."
              : "Add your first date. The rest of the day is yours to imagine."}
          </p>
          {!readOnly && (
            <button className="button primary" onClick={() => setModal("date")}>
              <Plus size={18} /> Add your first date
            </button>
          )}
        </div>
      ) : (
        <Timeline
          content={content}
          readOnly={readOnly}
          onChange={change}
          onAddSlot={addSlot}
          onOpenSlot={(slot, dayId) => setSelected({ slot, dayId })}
          onDeleteDay={(id) => {
            const day = content.days.find((item) => item.id === id)!;
            if (
              window.confirm(
                `Remove ${formatDate(day.date)} and ${day.slots.length ? `all ${day.slots.length} of its time slots` : "its empty date section"}? This cannot be undone.`,
              )
            )
              change({
                ...content,
                days: content.days.filter((item) => item.id !== id),
              });
          }}
        />
      )}
      {!readOnly && content.days.length > 0 && (
        <div className="add-date-area">
          <button
            className="button add-date-button"
            disabled={content.days.length >= 60}
            onClick={() => setModal("date")}
          >
            <Plus size={18} />{" "}
            {content.days.length >= 60
              ? "60-date limit reached"
              : "Add another date"}
          </button>
        </div>
      )}
      {modal === "date" && (
        <DateSheet
          content={content}
          onClose={() => setModal(null)}
          onAdd={(date) => {
            change({
              ...content,
              days: [
                ...content.days,
                {
                  id: crypto.randomUUID(),
                  date,
                  slots: [],
                  manualOrder: false,
                },
              ].sort((a, b) => a.date.localeCompare(b.date)),
            });
            setModal(null);
          }}
        />
      )}
      {selected && (
        <SlotSheet
          key={selected.slot.id}
          {...selected}
          content={content}
          readOnly={readOnly}
          onClose={() => setSelected(null)}
          onMove={change}
          onSave={saveSlot}
          onDelete={() => {
            if (
              !window.confirm(
                `Delete “${selected.slot.title}”? This cannot be undone.`,
              )
            )
              return;
            change({
              ...content,
              days: content.days.map((day) => ({
                ...day,
                slots: day.slots.filter((slot) => slot.id !== selected.slot.id),
              })),
            });
            setSelected(null);
          }}
        />
      )}
      {modal === "share" && model && (
        <ShareSheet
          url={`${model.meta.shareOrigin}/s/${model.meta.shareToken}`}
          onClose={() => setModal(null)}
          onRotate={model.rotate}
        />
      )}
      {modal === "export" && (
        <ExportSheet content={content} onClose={() => setModal(null)} />
      )}
    </main>
  );
}
export function Editor({
  initial,
  token,
}: {
  initial: EditorCalendar;
  token: string;
}) {
  const model = useCalendar(initial, token);
  return (
    <CalendarView content={model.content} readOnly={false} model={model} />
  );
}
export function SharedCalendar({ calendar }: { calendar: Calendar }) {
  return <CalendarView content={contentOf(calendar)} readOnly />;
}
