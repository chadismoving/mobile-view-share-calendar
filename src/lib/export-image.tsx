/* eslint-disable react-refresh/only-export-components -- Lazy image export owns a private render-only layout. */
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  dateObject,
  formatDate,
  type CalendarContent,
  type Day,
  type Slot,
} from "../../shared/calendar";
import { SlotContent } from "../components/SlotCard";

type Segment = { day: Day; slots: Slot[]; continued: boolean };
export type ExportedImage = { url: string; filename: string; file: File };
const MAX_HEIGHT = 2800;
const frame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
function ExportLayout({
  content,
  segments,
  page = 1,
  total = 1,
  bannerSrc,
}: {
  content: CalendarContent;
  segments: Segment[];
  page?: number;
  total?: number;
  bannerSrc?: string;
}) {
  return (
    <div className="export-page">
      <header className="export-header">
        {bannerSrc && (
          <img
            className="export-banner"
            src={bannerSrc}
            alt={`${content.title} banner`}
          />
        )}
        <h1>{content.title}</h1>
        {content.description && <p>{content.description}</p>}
      </header>
      <div className="export-days">
        {segments.map((segment, index) => (
          <section
            className="export-day"
            data-export-day
            key={`${segment.day.id}-${index}`}
          >
            <div className="export-day-header">
              <div className="date-tile">
                <span>
                  {dateObject(segment.day.date).toLocaleDateString("en-US", {
                    month: "short",
                  })}
                </span>
                <strong>{dateObject(segment.day.date).getDate()}</strong>
              </div>
              <div>
                <h2>
                  {dateObject(segment.day.date).toLocaleDateString("en-US", {
                    weekday: "long",
                  })}
                </h2>
                <p>
                  {formatDate(segment.day.date, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {segment.continued ? " · continued" : ""}
                </p>
              </div>
            </div>
            <div className="export-slots">
              {segment.slots.map((slot) => (
                <article
                  className={`export-slot color-${slot.color}`}
                  data-export-slot
                  key={slot.id}
                >
                  <SlotContent slot={slot} full />
                </article>
              ))}
              {!segment.slots.length && (
                <p className="export-empty">A little room for possibility.</p>
              )}
            </div>
          </section>
        ))}
      </div>
      {total > 1 && (
        <footer className="export-footer">
          <span>
            Part {page} of {total}
          </span>
        </footer>
      )}
    </div>
  );
}
export async function exportImages(
  content: CalendarContent,
  onProgress: (value: string) => void,
  bannerSrc?: string,
): Promise<ExportedImage[]> {
  await document.fonts.ready;
  const host = document.createElement("div");
  host.className = "export-host";
  host.setAttribute("aria-hidden", "true");
  document.body.appendChild(host);
  const root = createRoot(host);
  const files: ExportedImage[] = [];
  try {
    const initial = content.days.map((day) => ({
      day,
      slots: day.slots,
      continued: false,
    }));
    flushSync(() =>
      root.render(
        <ExportLayout
          content={content}
          segments={initial}
          bannerSrc={bannerSrc}
        />,
      ),
    );
    await frame();
    if (bannerSrc) {
      const image = host.querySelector<HTMLImageElement>(".export-banner");
      if (image)
        await image.decode().catch(() => {
          throw new Error(
            "The banner could not load. Reconnect and try exporting again.",
          );
        });
    }
    const page = host.querySelector<HTMLElement>(".export-page")!;
    const header =
      page.querySelector<HTMLElement>(".export-header")!.offsetHeight;
    const footer =
      page.querySelector<HTMLElement>(".export-footer")?.offsetHeight ?? 0;
    const available = MAX_HEIGHT - header - footer - 120;
    const pages: Segment[][] = [[]];
    let used = 0;
    const nextPage = () => {
      pages.push([]);
      used = 0;
    };
    const add = (segment: Segment, height: number) => {
      if (used && used + height > available) nextPage();
      pages[pages.length - 1].push(segment);
      used += height;
    };
    const nodes = [...host.querySelectorAll<HTMLElement>("[data-export-day]")];
    initial.forEach((segment, index) => {
      const node = nodes[index];
      const height = node.offsetHeight + 26;
      if (height <= available) {
        add(segment, height);
        return;
      }
      const slots = [
        ...node.querySelectorAll<HTMLElement>("[data-export-slot]"),
      ];
      let group: Slot[] = [];
      let groupHeight = 104;
      let continued = false;
      segment.slots.forEach((slot, slotIndex) => {
        const slotHeight = slots[slotIndex].offsetHeight + 12;
        if (slotHeight + 104 > available)
          throw new Error(
            "One slot is too tall to export safely. Please shorten its details and try again.",
          );
        if (group.length && groupHeight + slotHeight > available) {
          add({ day: segment.day, slots: group, continued }, groupHeight);
          nextPage();
          group = [];
          groupHeight = 104;
          continued = true;
        }
        group.push(slot);
        groupHeight += slotHeight;
      });
      if (group.length)
        add({ day: segment.day, slots: group, continued }, groupHeight);
    });
    const { toBlob } = await import("html-to-image");
    const name =
      content.title
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60)
        .toLowerCase() || "my-calendar";
    for (let index = 0; index < pages.length; index++) {
      onProgress(`Making image ${index + 1} of ${pages.length}…`);
      flushSync(() =>
        root.render(
          <ExportLayout
            content={content}
            segments={pages[index]}
            page={index + 1}
            total={pages.length}
            bannerSrc={bannerSrc}
          />,
        ),
      );
      await frame();
      const banner = host.querySelector<HTMLImageElement>(".export-banner");
      if (banner) await banner.decode();
      const node = host.querySelector<HTMLElement>(".export-page")!;
      if (node.offsetHeight > MAX_HEIGHT + 100)
        throw new Error(
          "This image is too tall. Please shorten your calendar details and try again.",
        );
      const blob = await toBlob(node, {
        width: 390,
        height: node.offsetHeight,
        pixelRatio: 2,
        backgroundColor: "#f8f5ef",
        cacheBust: false,
        skipFonts: true,
      });
      if (!blob)
        throw new Error(
          "Your browser could not create the image. Please try again.",
        );
      const filename = `${name}${pages.length > 1 ? `-${String(index + 1).padStart(2, "0")}` : ""}.png`;
      const file = new File([blob], filename, { type: "image/png" });
      files.push({ url: URL.createObjectURL(blob), filename, file });
    }
    return files;
  } catch (error) {
    files.forEach((file) => URL.revokeObjectURL(file.url));
    throw error;
  } finally {
    root.unmount();
    host.remove();
  }
}
