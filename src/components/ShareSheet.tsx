import { useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Link,
  RefreshCw,
  Share2,
  ShieldCheck,
} from "lucide-react";
import { Sheet } from "./Sheet";
export function ShareSheet({
  url,
  onRotate,
  onClose,
}: {
  url: string;
  onRotate: () => Promise<void>;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError(
        "Copy the link from the field below. Your browser does not allow clipboard access.",
      );
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: "A little plan for you", url });
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError"))
        void copy();
    }
  };
  return (
    <Sheet
      title="Good days are better shared"
      subtitle="Send a little plan to your favorite people."
      onClose={onClose}
    >
      <div className="share-illustration">
        <div>
          <Link size={30} strokeWidth={1.5} />
        </div>
        <span className="share-spark spark-one">✦</span>
        <span className="share-spark spark-two">✧</span>
      </div>
      <div className="share-permission">
        <ShieldCheck size={18} />
        <div>
          <strong>Just the plans. View only.</strong>
          <p>
            Anyone with this link can see your schedule. They can’t make
            changes.
          </p>
        </div>
      </div>
      <label className="field">
        Your share link
        <input
          readOnly
          value={url}
          onFocus={(event) => event.target.select()}
          aria-label="Read-only share URL"
        />
      </label>
      <div className="share-actions">
        <button className="button primary grow" onClick={() => void copy()}>
          {copied ? <Check size={17} /> : <Copy size={17} />}
          {copied ? "Copied!" : "Copy link"}
        </button>
        {typeof navigator.share === "function" && (
          <button className="button secondary" onClick={() => void share()}>
            <Share2 size={17} /> Share
          </button>
        )}
        <a
          className="button secondary icon-only"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open read-only calendar"
        >
          <ExternalLink size={18} />
        </a>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="rotate-link">
        <p>
          Need a fresh start? Replacing this link makes the old one stop
          working.
        </p>
        <button
          className="button subtle small"
          disabled={busy}
          onClick={() => {
            if (
              !window.confirm(
                "Replace this share link? Everyone using the old link will lose access. Your calendar will stay the same.",
              )
            )
              return;
            setBusy(true);
            setError("");
            void onRotate()
              .then(() => setCopied(false))
              .catch((caught) =>
                setError(
                  caught instanceof Error
                    ? caught.message
                    : "Could not replace the link.",
                ),
              )
              .finally(() => setBusy(false));
          }}
        >
          <RefreshCw size={15} className={busy ? "spin" : ""} />{" "}
          {busy ? "Replacing…" : "Replace share link"}
        </button>
      </div>
    </Sheet>
  );
}
