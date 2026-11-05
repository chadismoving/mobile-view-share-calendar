import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  MapPin,
  Trash2,
  Ban,
  Smile,
  ChevronDown,
} from "lucide-react";
import {
  colors,
  colorLabels,
  formatDate,
  moveSlot,
  slotSchema,
  slotIcons,
  slotIconDefinition,
  type CalendarContent,
  type Slot,
} from "../../shared/calendar";
import { Sheet } from "./Sheet";
import { SlotContent } from "./SlotCard";
import { SlotIcon } from "./SlotIcon";

export function SlotSheet({
  slot,
  dayId,
  content,
  readOnly,
  onSave,
  onMove,
  onDelete,
  onClose,
}: {
  slot: Slot;
  dayId: string;
  content: CalendarContent;
  readOnly: boolean;
  onSave: (slot: Slot, dayId: string) => void;
  onMove: (content: CalendarContent) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(slot);
  const [target, setTarget] = useState(dayId);
  const [error, setError] = useState("");
  const [iconsOpen, setIconsOpen] = useState(false);
  const selectedIcon = slotIconDefinition(draft.icon);
  const day = content.days.find((item) => item.id === dayId)!;
  const existing = day.slots.some((item) => item.id === slot.id);
  const index = day.slots.findIndex((item) => item.id === slot.id);
  const field = <K extends keyof Slot>(key: K, value: Slot[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  if (readOnly)
    return (
      <Sheet
        title="A little more detail"
        subtitle={formatDate(day.date)}
        onClose={onClose}
      >
        <div className={`detail-card color-${slot.color}`}>
          <SlotContent slot={slot} full />
        </div>
        <button className="button primary full-width" onClick={onClose}>
          Done
        </button>
      </Sheet>
    );
  return (
    <Sheet
      title={existing ? "Edit time slot" : "Something to look forward to"}
      subtitle={formatDate(day.date)}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const parsed = slotSchema.safeParse({
            ...draft,
            startTime: form.get("startTime"),
            endTime: form.get("endTime"),
          });
          if (!parsed.success) {
            setError(parsed.error.issues[0].message);
            return;
          }
          onSave(parsed.data, target);
        }}
      >
        <label className="field">
          What’s the plan?
          <input
            autoFocus
            required
            maxLength={120}
            value={draft.title}
            onChange={(event) => field("title", event.target.value)}
            placeholder="Coffee, a little adventure…"
          />
        </label>
        <fieldset className="icon-picker">
          <legend>
            Calendar icon <span className="optional">optional</span>
          </legend>
          <button
            type="button"
            className="icon-picker-trigger"
            aria-expanded={iconsOpen}
            aria-controls="slot-icon-options"
            onClick={() => setIconsOpen((open) => !open)}
          >
            {draft.icon ? (
              <SlotIcon value={draft.icon} decorative />
            ) : (
              <Smile size={20} />
            )}
            <span>{draft.icon ? selectedIcon.label : "Choose an icon"}</span>
            <ChevronDown size={16} />
          </button>
          {iconsOpen && (
            <div className="icon-picker-options" id="slot-icon-options">
              {slotIcons.map((icon) => (
                <button
                  key={icon.value}
                  type="button"
                  className={`icon-choice ${selectedIcon.value === icon.value ? "selected" : ""}`}
                  aria-label={icon.label}
                  aria-pressed={selectedIcon.value === icon.value}
                  title={icon.label}
                  onClick={() => {
                    field("icon", icon.value);
                    setIconsOpen(false);
                  }}
                >
                  {icon.value ? (
                    <SlotIcon value={icon.value} decorative />
                  ) : (
                    <Ban size={19} aria-hidden="true" />
                  )}
                  <span className="icon-choice-label">
                    {icon.value ? icon.label : "None"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </fieldset>
        <div className="form-row">
          <label className="field">
            Start time
            <input
              required
              type="time"
              name="startTime"
              value={draft.startTime}
              onChange={(event) => field("startTime", event.target.value)}
              onInput={(event) => field("startTime", event.currentTarget.value)}
            />
          </label>
          <label className="field">
            End time
            <input
              required
              type="time"
              name="endTime"
              value={draft.endTime}
              onChange={(event) => field("endTime", event.target.value)}
              onInput={(event) => field("endTime", event.currentTarget.value)}
            />
          </label>
        </div>
        <label className="field">
          A few details <span className="optional">optional</span>
          <textarea
            rows={3}
            maxLength={2000}
            value={draft.description}
            onChange={(event) => field("description", event.target.value)}
            placeholder="Anything you’d like to remember"
          />
        </label>
        <label className="field">
          <span>
            <MapPin size={13} /> Location{" "}
            <span className="optional">optional</span>
          </span>
          <input
            maxLength={200}
            value={draft.location}
            onChange={(event) => field("location", event.target.value)}
            placeholder="Place name and street address"
          />
        </label>
        <p className="location-hint">
          Use a full address so this stop can be pinned on your calendar’s map.
        </p>
        <label className="field">
          Link <span className="optional">optional</span>
          <input
            type="url"
            maxLength={2000}
            value={draft.url}
            onChange={(event) => field("url", event.target.value)}
            placeholder="https://…"
          />
        </label>
        <fieldset className="color-picker">
          <legend>A splash of color</legend>
          <div>
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                className={`color-swatch color-${color} ${draft.color === color ? "selected" : ""}`}
                onClick={() => field("color", color)}
                aria-label={colorLabels[color]}
                aria-pressed={draft.color === color}
              >
                {draft.color === color && <Check size={18} />}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="field">
          {existing ? "Move to date" : "Date"}
          <select
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          >
            {content.days.map((item) => (
              <option key={item.id} value={item.id}>
                {formatDate(item.date)}
              </option>
            ))}
          </select>
        </label>
        {existing && (
          <div className="reorder-actions">
            <span>Display order</span>
            <button
              className="button subtle small"
              type="button"
              disabled={index <= 0}
              onClick={() => {
                onMove(moveSlot(content, slot.id, dayId, index - 1));
                onClose();
              }}
            >
              <ArrowUp size={15} /> Move up
            </button>
            <button
              className="button subtle small"
              type="button"
              disabled={index >= day.slots.length - 1}
              onClick={() => {
                onMove(moveSlot(content, slot.id, dayId, index + 1));
                onClose();
              }}
            >
              <ArrowDown size={15} /> Move down
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="sheet-actions">
          {existing && (
            <button
              type="button"
              className="button danger icon-only"
              aria-label="Delete time slot"
              onClick={onDelete}
            >
              <Trash2 size={19} />
            </button>
          )}
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button primary grow">
            <Check size={17} /> {existing ? "Save changes" : "Add time slot"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
