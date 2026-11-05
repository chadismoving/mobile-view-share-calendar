import { useEffect, useRef, useState } from "react";
import {
  Check,
  ImagePlus,
  LoaderCircle,
  Mountain,
  Replace,
  Trash2,
  Upload,
} from "lucide-react";
import { Sheet } from "./Sheet";
import { api } from "../lib/api";
import { cropBanner, readBannerFile } from "../lib/banner";

type BannerDraft = { url: string; width: number; height: number };
function BannerEditor({
  image,
  uploading,
  error,
  onSave,
  onClose,
}: {
  image: BannerDraft;
  uploading: boolean;
  error: string;
  onSave: (focus: number) => void;
  onClose: () => void;
}) {
  const [focus, setFocus] = useState(50);
  return (
    <Sheet
      title="Set the scene"
      subtitle="Choose the part of your photo to use as a banner."
      onClose={onClose}
    >
      <div className="banner-crop-preview">
        <img
          src={image.url}
          alt="Banner crop preview"
          style={{ objectPosition: `50% ${focus}%` }}
        />
      </div>
      {image.height > (image.width * 3) / 8 && (
        <label className="field banner-focus">
          Position
          <input
            type="range"
            min="0"
            max="100"
            value={focus}
            onChange={(event) => setFocus(Number(event.target.value))}
            aria-label="Banner vertical position"
          />
          <span>Move the photo up or down to frame it.</span>
        </label>
      )}
      <p className="banner-file-note">
        The image is resized for a crisp, lightweight banner.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="sheet-actions">
        <button
          className="button secondary"
          onClick={onClose}
          disabled={uploading}
        >
          Cancel
        </button>
        <button
          className="button primary grow"
          onClick={() => onSave(focus)}
          disabled={uploading}
        >
          {uploading ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Check size={17} />
          )}
          {uploading ? "Uploading…" : "Use this banner"}
        </button>
      </div>
    </Sheet>
  );
}
export function CalendarBanner({
  src,
  title,
  editToken,
  onChange,
}: {
  src?: string;
  title: string;
  editToken?: string;
  onChange?: (id: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<BannerDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const broken = Boolean(src && brokenSrc === src);
  const imageUrl = draft?.url;
  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl],
  );
  const choose = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      setDraft(await readBannerFile(file));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not open this image.",
      );
    }
    if (input.current) input.current.value = "";
  };
  const close = () => {
    if (!busy) {
      setDraft(null);
      setError("");
    }
  };
  const upload = async (focus: number) => {
    if (!draft || !editToken) return;
    setBusy(true);
    setError("");
    try {
      const blob = await cropBanner(draft.url, focus);
      const result = await api<{ bannerId: string }>(
        `/api/edit/${editToken}/banner`,
        {
          method: "POST",
          body: blob,
          headers: { "Content-Type": "image/jpeg" },
        },
      );
      onChange?.(result.bannerId);
      setDraft(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not upload your banner. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  if (!src && !editToken) return null;
  return (
    <div className="calendar-banner-area">
      <div className={`calendar-banner ${src && !broken ? "has-banner" : ""}`}>
        {src && !broken ? (
          <img
            src={src}
            alt={`${title || "Calendar"} banner`}
            onError={() => setBrokenSrc(src)}
          />
        ) : (
          <div className="banner-empty">
            <Mountain size={34} strokeWidth={1.3} />
            <span>
              {broken
                ? "Banner could not load."
                : "Add a photo to your calendar"}
            </span>
            {editToken && (
              <button
                className="button secondary small"
                onClick={() => input.current?.click()}
              >
                <ImagePlus size={16} />
                {broken ? "Choose another image" : "Add banner"}
              </button>
            )}
          </div>
        )}
        {src && editToken && !broken && (
          <div className="banner-controls">
            <button
              className="button small"
              onClick={() => input.current?.click()}
            >
              <Replace size={15} /> Change banner
            </button>
            <button
              className="button small icon-only"
              aria-label="Remove banner"
              onClick={() => onChange?.(null)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
      {editToken && (
        <input
          ref={input}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => void choose(event.target.files?.[0])}
          aria-label="Upload calendar banner"
          tabIndex={-1}
        />
      )}
      {error && !draft && (
        <p className="form-error" role="alert">
          <Upload size={14} /> {error}
        </p>
      )}
      {draft && (
        <BannerEditor
          image={draft}
          uploading={busy}
          error={error}
          onClose={close}
          onSave={(focus) => void upload(focus)}
        />
      )}
    </div>
  );
}
