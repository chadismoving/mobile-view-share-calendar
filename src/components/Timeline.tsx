import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCenter,
  pointerWithin,
  type DragEndEvent,
  type CollisionDetection,
  DragOverlay,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  ArrowDownWideNarrow,
  CalendarDays,
  GripVertical,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import {
  dateObject,
  formatDate,
  moveSlot,
  overlaps,
  type CalendarContent,
  type Day,
  type Slot,
  byTime,
} from "../../shared/calendar";
import { SlotCard, SlotContent } from "./SlotCard";

function DaySection({
  day,
  index,
  readOnly,
  onAdd,
  onOpen,
  onSort,
  onDelete,
}: {
  day: Day;
  index: number;
  readOnly: boolean;
  onAdd: () => void;
  onOpen: (slot: Slot) => void;
  onSort: () => void;
  onDelete: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: day.id,
    disabled: readOnly,
  });
  const [menu, setMenu] = useState(false);
  return (
    <section
      ref={setNodeRef}
      className={`day-section ${isOver ? "drop-active" : ""}`}
      aria-label={formatDate(day.date)}
    >
      <div className="day-header">
        <div className="date-tile">
          <span>
            {dateObject(day.date).toLocaleDateString("en-US", {
              month: "short",
            })}
          </span>
          <strong>{dateObject(day.date).getDate()}</strong>
        </div>
        <div className="day-heading">
          <span className="eyebrow">
            DAY {String(index + 1).padStart(2, "0")}
          </span>
          <h2>
            {dateObject(day.date).toLocaleDateString("en-US", {
              weekday: "long",
            })}
            <span className="day-year">
              {dateObject(day.date).getFullYear()}
            </span>
          </h2>
          <span className="day-count">
            {day.slots.length} {day.slots.length === 1 ? "plan" : "plans"}
            {day.manualOrder ? " · custom order" : ""}
          </span>
        </div>
        {!readOnly && (
          <div className="day-tools">
            <button
              className="icon-button"
              aria-label={`Options for ${formatDate(day.date)}`}
              aria-expanded={menu}
              onClick={() => setMenu((value) => !value)}
            >
              <MoreHorizontal size={21} />
            </button>
            {menu && (
              <div className="day-menu">
                <button
                  onClick={() => {
                    onSort();
                    setMenu(false);
                  }}
                >
                  <ArrowDownWideNarrow size={16} /> Sort by time
                </button>
                <button
                  className="text-danger"
                  onClick={() => {
                    onDelete();
                    setMenu(false);
                  }}
                >
                  <Trash2 size={16} /> Remove date
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="day-body">
        <SortableContext
          items={day.slots.map((slot) => slot.id)}
          strategy={verticalListSortingStrategy}
        >
          {day.slots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              readOnly={readOnly}
              overlap={overlaps(slot, day.slots)}
              onOpen={() => onOpen(slot)}
            />
          ))}
        </SortableContext>
        {day.slots.length === 0 && (
          <div className="day-empty">
            <span>A little room for possibility.</span>
            {readOnly && <span>No plans added yet.</span>}
          </div>
        )}
        {!readOnly && (
          <button
            className="add-slot"
            onClick={onAdd}
            disabled={day.slots.length >= 100}
          >
            <Plus size={16} /> Add time slot
          </button>
        )}
      </div>
    </section>
  );
}
const collision: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  const slots = underPointer.filter(
    (hit) =>
      args.droppableContainers.find((container) => container.id === hit.id)
        ?.data.current?.sortable,
  );
  return slots.length
    ? slots
    : underPointer.length
      ? underPointer
      : closestCenter(args);
};
export function Timeline({
  content,
  readOnly,
  onChange,
  onAddSlot,
  onOpenSlot,
  onDeleteDay,
}: {
  content: CalendarContent;
  readOnly: boolean;
  onChange: (content: CalendarContent) => void;
  onAddSlot: (dayId: string) => void;
  onOpenSlot: (slot: Slot, dayId: string) => void;
  onDeleteDay: (dayId: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 230, tolerance: 7 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);
  const start = ({ active }: DragStartEvent) =>
    setActiveSlot(
      content.days
        .flatMap((day) => day.slots)
        .find((slot) => slot.id === active.id) ?? null,
    );
  const end = ({ active, over }: DragEndEvent) => {
    setActiveSlot(null);
    if (!over || active.id === over.id) return;
    const targetDay = content.days.find(
      (day) =>
        day.id === over.id || day.slots.some((slot) => slot.id === over.id),
    );
    if (!targetDay) return;
    const targetIndex = targetDay.slots.findIndex(
      (slot) => slot.id === over.id,
    );
    onChange(
      moveSlot(
        content,
        String(active.id),
        targetDay.id,
        targetIndex < 0 ? targetDay.slots.length : targetIndex,
      ),
    );
  };
  return (
    <>
      {!readOnly && content.days.length > 0 && (
        <div className="timeline-caption">
          <span>
            <CalendarDays size={15} /> YOUR SCHEDULE
          </span>
          <span>
            <GripVertical size={14} /> Hold a handle to rearrange
          </span>
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={start}
        onDragEnd={end}
        onDragCancel={() => setActiveSlot(null)}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Press space to pick up a time slot. Use arrow keys to move, space to drop, or escape to cancel. Open slot details for Move to Date and Move Up or Down.",
          },
        }}
      >
        <div className="timeline">
          {content.days.map((day, index) => (
            <DaySection
              key={day.id}
              day={day}
              index={index}
              readOnly={readOnly}
              onAdd={() => onAddSlot(day.id)}
              onOpen={(slot) => onOpenSlot(slot, day.id)}
              onDelete={() => onDeleteDay(day.id)}
              onSort={() =>
                onChange({
                  ...content,
                  days: content.days.map((item) =>
                    item.id === day.id
                      ? {
                          ...item,
                          manualOrder: false,
                          slots: [...item.slots].sort(byTime),
                        }
                      : item,
                  ),
                })
              }
            />
          ))}
        </div>
        <DragOverlay>
          {activeSlot && (
            <div className={`slot-card drag-preview color-${activeSlot.color}`}>
              <div className="slot-main">
                <SlotContent slot={activeSlot} />
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </>
  );
}
