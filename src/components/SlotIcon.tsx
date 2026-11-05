import type { ReactNode } from "react";
import { slotIconDefinition, type SlotIconName } from "../../shared/calendar";

// Original 32 × 32 vector artwork: soft fills, olive outlines, rounded details.
// Inline SVG keeps the picker, calendar and PNG exports visually identical.
const artwork: Record<SlotIconName, ReactNode> = {
  "": null,
  coffee: (
    <>
      <path d="M7 13h15v7a6 6 0 0 1-6 6h-3a6 6 0 0 1-6-6z" fill="#e5c49a" />
      <path d="M22 14h2a4 4 0 0 1 0 8h-3M5 27h20M11 9c-2-3 2-3 0-6m6 6c-2-3 2-3 0-6" />
      <path d="M8 16h13" stroke="#fff8e9" />
    </>
  ),
  meal: (
    <>
      <circle cx="18" cy="17" r="9" fill="#eee1bf" />
      <circle cx="18" cy="17" r="5.5" stroke="#b5b899" />
      <path d="M4 5v7m3-7v7M4 9h3m-1.5 3v15M29 5v22m0-22c-4 2-4 9 0 9" />
    </>
  ),
  meeting: (
    <>
      <circle cx="11" cy="10" r="4" fill="#d8dec6" />
      <circle cx="23" cy="12" r="3.5" fill="#e6c5b6" />
      <path d="M3 26v-3a8 8 0 0 1 16 0v3z" fill="#d8dec6" />
      <path d="M21 19a7 7 0 0 1 9 6v1h-7" fill="#e6c5b6" />
    </>
  ),
  work: (
    <>
      <rect x="4" y="10" width="24" height="17" rx="4" fill="#e1c5a5" />
      <path d="M11 10V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3M4 16c7 5 17 5 24 0" />
      <rect x="13" y="16" width="6" height="5" rx="1.5" fill="#fff7e9" />
    </>
  ),
  call: (
    <>
      <path
        d="m10 5 4 6-4 3c2 4 4 6 8 8l3-4 6 4-2 5c-1 2-5 1-8 0C10 24 5 19 3 12 2 9 3 6 5 5z"
        fill="#d9dfc5"
      />
      <path d="M20 5a9 9 0 0 1 7 7m-8-3a5 5 0 0 1 4 4" stroke="#b79359" />
    </>
  ),
  study: (
    <>
      <path
        d="M16 8C12 5 7 5 3 7v19c4-2 9-2 13 1 4-3 9-3 13-1V7c-4-2-9-2-13 1z"
        fill="#e9ddc2"
      />
      <path d="M16 8v19M7 11l5 1m-5 4 5 1m9-5 4-1m-4 6 4-1" />
    </>
  ),
  exercise: (
    <>
      <path d="m11 12 9 9" strokeWidth="3" />
      <rect
        x="3"
        y="9"
        width="7"
        height="14"
        rx="2"
        transform="rotate(-45 6.5 16)"
        fill="#d6ddc6"
      />
      <rect
        x="22"
        y="9"
        width="7"
        height="14"
        rx="2"
        transform="rotate(-45 25.5 16)"
        fill="#d6ddc6"
      />
      <path d="m5 8 5-5m12 26 5-5" stroke="#b79359" />
    </>
  ),
  walk: (
    <>
      <path d="M16 26V12m0 7-5-4m5 1 4-4" />
      <path d="M15 16C5 18 3 10 6 5c8 0 12 4 9 11z" fill="#d2ddbf" />
      <path d="M17 13c-1-7 5-9 10-7 1 7-3 11-10 7z" fill="#e1e4ca" />
      <path d="M7 28c5-2 13-2 18 0" stroke="#b89c6c" />
    </>
  ),
  travel: (
    <>
      <path
        d="m14 13-9-2-3 3 11 5-3 7 3 2 6-7 7 2 2-3-6-4 6-9c2-3-1-5-3-3l-8 9-4-7-3 1z"
        fill="#dce4e2"
      />
      <path d="m5 25-2 2m4 1-1 2" stroke="#bba374" />
    </>
  ),
  home: (
    <>
      <path d="M6 14v13h20V14" fill="#e9ddc7" />
      <path d="M3 15 16 4l13 11" fill="#d7dfc7" />
      <path d="M12 27v-9h8v9" fill="#f8f4e9" />
      <path d="M23 6v4" />
    </>
  ),
  birthday: (
    <>
      <rect x="5" y="16" width="22" height="12" rx="3" fill="#ead1ca" />
      <path d="M5 20c2 3 4 3 6 0 2 3 5 3 7 0 3 3 6 3 9 0" fill="#fff6e8" />
      <path d="M10 16v-5m6 5v-5m6 5v-5" />
      <path
        d="M10 4c-4 4 0 6 0 3 0 3 4 1 0-3m6-2c-4 4 0 6 0 3 0 3 4 1 0-3m6 2c-4 4 0 6 0 3 0 3 4 1 0-3"
        fill="#dcb36f"
        stroke="#b69a62"
      />
    </>
  ),
  shopping: (
    <>
      <path d="M7 11h18l2 17H5z" fill="#e1d7e7" />
      <path d="M11 13V8a5 5 0 0 1 10 0v5" />
      <path d="m12 20 3 3 6-6" stroke="#8b8e72" />
    </>
  ),
  health: (
    <>
      <path d="M16 27 5 17C-4 8 9-1 16 9 23-1 36 8 27 17z" fill="#e8c9c1" />
      <path d="M11 17h10m-5-5v10" stroke="#fff9ef" strokeWidth="2.5" />
    </>
  ),
  creative: (
    <>
      <path
        d="M16 4C8 4 3 10 3 17c0 7 6 12 12 12 3 0 5-2 3-5-1-2 0-4 3-4h3c8 0 6-16-8-16z"
        fill="#e9ddc1"
      />
      <circle cx="10" cy="11" r="2" fill="#b1c2a0" stroke="none" />
      <circle cx="18" cy="9" r="2" fill="#d8ad8f" stroke="none" />
      <circle cx="24" cy="13" r="2" fill="#b9abc8" stroke="none" />
      <circle cx="8" cy="19" r="2" fill="#acc3cb" stroke="none" />
    </>
  ),
  rest: (
    <>
      <path
        d="M22 4C11 4 5 20 18 26 6 30-1 17 7 8c4-4 10-5 15-4z"
        fill="#dedbb3"
      />
      <path
        d="m24 10 1.5 3 3 1.5-3 1.5L24 19l-1.5-3-3-1.5 3-1.5z"
        fill="#eacb92"
        stroke="#b69a62"
      />
    </>
  ),
  reminder: (
    <>
      <path
        d="M8 14a8 8 0 0 1 16 0c0 7 3 8 3 10H5c0-2 3-3 3-10z"
        fill="#e7d7b4"
      />
      <path d="M13 27a3 3 0 0 0 6 0M16 3v3" />
      <path d="M4 9 2 12m26-3 2 3" stroke="#b29964" />
    </>
  ),
};

export function SlotIcon({
  value,
  decorative = false,
}: {
  value: string;
  decorative?: boolean;
}) {
  const icon = slotIconDefinition(value);
  if (!icon.value) return null;
  return (
    <span
      className={`calendar-icon calendar-icon-${icon.value}`}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : icon.label}
      aria-hidden={decorative || undefined}
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        stroke="#58694f"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {artwork[icon.value]}
      </svg>
    </span>
  );
}
