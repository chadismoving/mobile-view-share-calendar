# Codex Build Instructions — Mobile Shareable Calendar

## Objective
Build a production-ready MVP: a lightweight, single-page, mobile-first calendar web app where a user creates a titled schedule, adds dates and time slots, rearranges slots with drag-and-drop, edits details, shares a read-only view, and exports a polished mobile-sized image (PNG).

## Platform and stack
- Deploy on **Cloudflare Workers** using **Wrangler**.
- Frontend: React + TypeScript + Vite, served through Workers static assets.
- Backend: Worker API routes.
- Database: Cloudflare D1 for calendars and time slots.
- Use a minimal, accessible component system; prefer Tailwind CSS for responsive styling.
- Use a mobile-friendly drag-and-drop library such as `@dnd-kit`.
- No separate server, Docker, or paid third-party service required.

## Product requirements
### 1. Single-page editor
- Designed primarily for phone screens (320–430px), with comfortable touch targets (>=44px).
- User can create a calendar with an editable **title** and optional short description.
- User can add one or more dates, and add multiple time slots per date.
- Time slots have start time and end time (e.g., 3:00 PM–5:00 PM), title, optional description, optional location/link, and optional color/category.
- Tap a time slot to view its full details and edit or delete it using a bottom sheet/modal.
- Display essential details directly on each slot card; expand for longer content.
- Support dragging slots to reorder within a day and move to another date. When moving between dates, preserve start/end times unless the user explicitly edits them.
- Save changes automatically with a visible saved/saving/error indicator.
- Support empty states, validation (end time after start time), and confirmation before destructive actions.

### 2. Calendar-like layout
- Use a **day-grouped vertical timeline** rather than a dense desktop month grid, optimized for mobile.
- Each date section has a readable date header and an Add Time Slot action.
- Slots show time range, title, and a short detail preview.
- Sort by start time by default. Drag-and-drop establishes a manual display order; provide an optional Sort by Time action.
- Allow overlapping time slots but show a subtle warning rather than blocking them.

### 3. Sharing and permissions
- Generate a hard-to-guess public **read-only share URL** for each calendar, e.g. `/s/{shareToken}`.
- Share view must show the title, dates, slots, and details but no edit controls.
- Use native Web Share API when supported, otherwise Copy Link.
- Creator receives a separate private edit URL with an unguessable edit token, e.g. `/edit/{editToken}`. Store only a hash of the edit token server-side; never expose it in public share pages or responses.
- No app-level login/password. **Cloudflare Access protects all editor and write API routes**, and the edit token provides calendar-specific authorization. An edit link alone must not bypass Access. Share links are read-only and do not grant edit rights.
- Add Regenerate Share Link action to revoke the old public link.
- Avoid search-engine indexing of shared calendars (robots meta + relevant headers), while recognizing that unlisted links are not authentication.

### 4. Visual design
- **Lovely, colorful, polished** aesthetic: soft pastel palette, warm background, rounded cards, subtle shadows, small playful accents.
- Distinct but harmonious colors for time-slot categories; ensure readable contrast.
- Clear hierarchy: calendar title, date headings, time labels, slot cards, primary actions.
- Smooth micro-interactions, but honor `prefers-reduced-motion`.
- Keep page fast, clean, and uncluttered; no unnecessary dashboard/navigation.

### 5. Export as mobile image (PNG)
- Provide **Export Image** in both editor and read-only share views; do **not** implement Print / PDF or A4 layouts.
- Export the calendar as a crisp **PNG** designed for viewing/sharing on phones, not paper. Preserve the colorful cards, title, date headings, time ranges, and visible details.
- Capture a dedicated, clean export layout without edit buttons, drag handles, navigation, or other controls. Do not simply screenshot the current viewport: include the full calendar content, including off-screen dates and slots.
- Use a lightweight client-side DOM-to-image solution (e.g. `html-to-image`) with high pixel density; lazy-load it so the main editor stays fast. Handle web-font loading and CORS-safe assets.
- Keep output width around 390 CSS px at 2x resolution; height expands with content. For very long calendars, split into multiple sequential PNGs to avoid browser canvas size/memory limits, with clear date boundaries and filenames.
- On mobile, use native share with the image file where supported; otherwise offer Download/Save Image and a preview. Handle iOS Safari limitations gracefully.
- Image output must not include private edit tokens or edit links.

## Suggested D1 schema
- `calendars`: `id`, `title`, `description`, `edit_token_hash`, `share_token_hash` or securely indexed share identifier, `created_at`, `updated_at`.
- `calendar_days`: `id`, `calendar_id`, `date`, `sort_order`.
- `time_slots`: `id`, `day_id`, `start_time`, `end_time`, `title`, `description`, `location`, `url`, `color`, `sort_order`, `created_at`, `updated_at`.
- Use UUIDs or similarly unguessable IDs. Define foreign keys and indexes. Apply migrations via Wrangler.

## API and security
- Create calendar; retrieve editor calendar by private edit token; update calendar metadata; add/edit/delete/reorder days and slots; retrieve read-only calendar by share token; rotate share token.
- Validate all input server-side (dates, times, lengths, URLs, color enum). Escape user text in rendering and avoid unsafe HTML injection.
- Rate-limit public create and read endpoints using available Cloudflare mechanisms where appropriate.
- Never send edit tokens in public API responses. Use appropriate cache-control headers for private and share content.
- Configure **Cloudflare Access as mandatory for the editor**, including create/update/delete APIs. Keep the read-only share site/API publicly reachable using a **separate hostname or Worker route** outside the Access application scope (e.g. `app.example.com` for editing, `share.example.com` for viewing). Avoid relying on path exclusions that could expose write APIs. Verify Access JWT server-side on protected endpoints, and verify edit tokens independently. Document Cloudflare Access setup as a deployment prerequisite.

## UX details
- Initial landing state: `Create Calendar` with title field.
- Editor top bar: editable title, Share, Export Image.
- Floating or sticky `+ Add Date` action and per-day `+ Add Slot`.
- Bottom sheet for slot editing, with native mobile-friendly date/time inputs.
- Show a small onboarding hint for drag-and-drop; support touch drag activation without interfering with normal page scroll.
- Provide accessible alternatives to drag-and-drop (Move to Date / Move Up / Move Down).
- Handle loading, offline/network failure, and autosave conflicts gracefully.

## Acceptance criteria
1. Create a titled calendar on mobile and reopen its private edit link to continue editing.
2. Add at least two dates and several slots, including a 3:00 PM–5:00 PM slot.
3. Tap a slot to view and update its details; edits persist after refresh.
4. Drag a slot within a date or to another date; updated ordering persists.
5. Open a share link in an incognito browser: full schedule visible without Cloudflare Access, editing unavailable. Access-protected editor and write APIs reject unauthenticated requests.
6. Rotate the share link: previous link stops working.
7. Export PNG on mobile: image includes all calendar content and details, with no editing controls; long schedules export as multiple images if needed.
8. UI works on 320px, 375px, and 430px widths with no horizontal overflow.
9. Typecheck, lint, tests, and Cloudflare Workers build/deploy pass.
10. Public GitHub repository is safe to publish (no committed secrets), PR CI runs automatically, and a successful merge/push to `main` triggers a production deployment only after CI passes.

## GitHub repository and CI/CD (required)
- Project must be ready for a **public GitHub repository** under the `chadismoving` account (suggested repository: `chadismoving/mobile-share-calendar`; confirm the final name before creating a remote repository).
- Include a clean `.gitignore`, `.env.example`, `README.md`, `LICENSE` (only if owner selects one), and GitHub Actions workflows in `.github/workflows/`.
- Never commit credentials, Wrangler auth tokens, Cloudflare API tokens, Access secrets, D1 production data, private edit URLs, or local `.dev.vars` files. Add secret scanning and dependency review where practical.
- CI on pull requests and pushes to `main`: install with `npm ci`, typecheck, lint, run tests, and build. Use pinned Node LTS and least-privilege GitHub Actions permissions.
- CD on successful CI for pushes to `main`: deploy Cloudflare Workers via Wrangler using **GitHub Actions**. Prefer Cloudflare-supported OIDC/short-lived credentials if available; otherwise use a narrowly scoped `CLOUDFLARE_API_TOKEN` GitHub Actions secret and `CLOUDFLARE_ACCOUNT_ID` variable/secret. Do not expose secrets to pull-request jobs from forks.
- Separate preview and production environments where feasible. PR checks must never deploy to production. Configure GitHub Environment protection for production if desired.
- Keep D1 schema migrations versioned in Git. Run migrations in a controlled deployment step; do not run destructive production migrations automatically. Document rollback and backup strategy.
- Configure Cloudflare Access and public share hostname/routing **outside the repository** as deployment prerequisites, and document DNS, Access policies, and Workers routes. Never publish sensitive hostname tokens or identity information.
- Public repository means **source code is public**, not that editing is public: Access must still protect editor and write APIs; share pages remain read-only and publicly accessible.
- Codex should prepare all workflows and instructions. Only create the GitHub repository, configure secrets, or deploy when the required permissions and credentials are available; never claim these steps succeeded without verification.

## Implementation process
1. Inspect the repository and follow any existing `AGENTS.md` and coding conventions.
2. Propose a brief implementation plan and file structure before coding.
3. Implement D1 migrations, Worker API, frontend, share mode, drag-and-drop, and mobile image export.
4. Add focused tests for CRUD, permissions, validation, and ordering.
5. Set up GitHub Actions CI/CD and public-repository hygiene; document how to publish under `chadismoving` and configure GitHub secrets. Provide README with local setup (`wrangler dev`), D1 migration steps, environment configuration, Cloudflare Access policy / hostname separation, and deployment commands.
6. Run checks and report what was verified vs. what still needs manual testing.

## Scope control
- **MVP:** no app-level login/signup (Cloudflare Access is required for editing), invitations, email, recurring events, external calendar sync, notifications, or payment system.
- Prioritize delightful mobile UX, reliable persistence, shareability, and clean mobile image export.
- If a decision is unspecified, choose the simplest maintainable implementation and document the assumption.
