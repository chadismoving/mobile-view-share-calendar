import { AlertCircle, ArrowUpRight, GripVertical, MapPin } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { timeRange, type Slot } from "../../shared/calendar";

import { SlotIcon } from "./SlotIcon";

export function SlotContent({
  slot,
  full = false,
  overlap = false,
}: {
  slot: Slot;
  full?: boolean;
  overlap?: boolean;
}) {
  return (
    <>
      <div className="slot-topline">
        <span className="slot-time">{timeRange(slot)}</span>
        {overlap && (
          <span className="overlap-mark" title="Overlaps another time slot">
            <AlertCircle size={13} />
            <span className="sr-only">Overlaps another time slot</span>
          </span>
        )}
      </div>
      <h3 className="slot-heading">
        <SlotIcon value={slot.icon} />
        <span>{slot.title}</span>
      </h3>
      {slot.description && (
        <p className={full ? "slot-description" : "slot-description clamp-two"}>
          {slot.description}
        </p>
      )}
      {slot.location && (
        <div className="slot-location">
          <MapPin size={13} />
          <span>{slot.location}</span>
        </div>
      )}
      {slot.url &&
        (full ? (
          <a
            className="slot-link"
            href={slot.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            {slot.url}
            <ArrowUpRight size={14} />
          </a>
        ) : (
          <span className="slot-link">
            <ArrowUpRight size={13} /> Link attached
          </span>
        ))}
    </>
  );
}
export function SlotCard({
  slot,
  readOnly,
  overlap,
  onOpen,
}: {
  slot: Slot;
  readOnly: boolean;
  overlap: boolean;
  onOpen: () => void;
}) {
  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
    attributes,
    listeners,
  } = useSortable({ id: slot.id, disabled: readOnly });
  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`slot-card color-${slot.color} ${isDragging ? "is-dragging" : ""}`}
    >
      <button
        className="slot-main"
        onClick={onOpen}
        aria-label={`${slot.title}, ${timeRange(slot)}. ${readOnly ? "View" : "Edit"} details`}
      >
        <SlotContent slot={slot} overlap={overlap} />
        <span className="slot-open">
          <ArrowUpRight size={15} />
        </span>
      </button>
      {!readOnly && (
        <button
          {...attributes}
          {...listeners}
          className="drag-handle"
          aria-label={`Drag ${slot.title} to rearrange`}
          title="Hold to drag; open details for move controls"
        >
          <GripVertical size={19} />
        </button>
      )}
    </article>
  );
}
