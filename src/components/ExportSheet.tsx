import { useEffect, useRef, useState } from "react";
import { Download, Image, LoaderCircle, Share2 } from "lucide-react";
import type { CalendarContent } from "../../shared/calendar";
import type { ExportedImage } from "../lib/export-image";
import { Sheet } from "./Sheet";

export function ExportSheet({
  content,
  bannerSrc,
  onClose,
}: {
  content: CalendarContent;
  bannerSrc?: string;
  onClose: () => void;
}) {
  const [images, setImages] = useState<ExportedImage[]>([]);
  const [progress, setProgress] = useState("Gathering your lovely plans…");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const snapshot = useRef(content);
  const job = useRef<Promise<ExportedImage[]> | null>(null);
  useEffect(() => {
    let active = true;
    if (!job.current)
      job.current = import("../lib/export-image").then((module) =>
        module.exportImages(
          snapshot.current,
          (value) => {
            if (active) setProgress(value);
          },
          bannerSrc,
        ),
      );
    const currentJob = job.current;
    void currentJob
      .then((result) => {
        if (active) setImages(result);
      })
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not create your images. Please try again.",
          );
      });
    return () => {
      active = false;
      void currentJob
        .then((result) => {
          window.setTimeout(() => {
            if (!document.querySelector("[data-export-preview]"))
              result.forEach((item) => URL.revokeObjectURL(item.url));
          }, 0);
        })
        .catch(() => undefined);
    };
  }, [attempt, bannerSrc]);
  const canShare =
    images.length > 0 &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: images.map((item) => item.file) });
  const share = async () => {
    try {
      await navigator.share({
        files: images.map((item) => item.file),
        title: content.title,
      });
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError"))
        setError(
          "Image sharing is unavailable here. Use the download buttons, or hold an image to save it.",
        );
    }
  };
  return (
    <Sheet
      title="Take your plans with you"
      subtitle="A lovely, phone-sized image. Every detail included."
      onClose={onClose}
    >
      {images.length === 0 && !error && (
        <div className="export-loading" role="status">
          <div className="export-loading-icon">
            <Image size={29} />
            <LoaderCircle size={18} className="spin" />
          </div>
          <p>{progress}</p>
          <span>Long schedules become a few neat images.</span>
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          <p>{error}</p>
          {images.length === 0 && (
            <button
              className="button secondary small"
              onClick={() => {
                job.current = null;
                setError("");
                setAttempt((value) => value + 1);
              }}
            >
              Try again
            </button>
          )}
        </div>
      )}
      {images.length > 0 && (
        <div data-export-preview>
          <p className="export-tip">
            {images.length > 1
              ? `${images.length} images, in schedule order. `
              : ""}
            Save the PNG below, or touch and hold the preview on your phone.
          </p>
          {canShare && (
            <button
              className="button primary full-width"
              onClick={() => void share()}
            >
              <Share2 size={17} /> Share{" "}
              {images.length > 1 ? "images" : "image"}
            </button>
          )}
          <div className="export-previews">
            {images.map((item, index) => (
              <div key={item.filename}>
                <img
                  src={item.url}
                  alt={`${content.title}, exported schedule${images.length > 1 ? `, part ${index + 1}` : ""}`}
                />
                <a
                  className="button secondary full-width"
                  href={item.url}
                  download={item.filename}
                >
                  <Download size={17} /> Save image
                  {images.length > 1 ? ` ${index + 1}` : ""}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}
