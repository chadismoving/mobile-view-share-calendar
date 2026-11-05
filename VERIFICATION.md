# Verification · 4 November 2026

Implementation checks were run after the main product was complete. A native date/time submission issue found in the browser was corrected, followed by a final passing check of the changed build.

## Passed locally

- TypeScript typecheck and ESLint, with no errors or warnings.
- Six focused tests in the actual Workers runtime with local D1: schedule CRUD, durable order, atomic stale-save protection, server validation, share revocation/redaction, signed Access JWT checks, independent edit-token authorization, origin/hostname restrictions, and rate limits.
- Vite production build and Wrangler Worker deployment **dry run**. No production deployment occurred.
- Production configuration generator with placeholder fixture values; migration gate accepted an applied migration and rejected a pending one. Generated fixture configuration was removed.
- Browser: create calendar, choose a date, add and edit slot details and native times, move a slot to another date, autosave, reopen, and keyboard drag-and-drop with persisted custom order.
- Browser: public view exposes details and export, with no editing controls.
- Editor and public layouts measured at 320, 375, and 430 CSS pixels with no horizontal document overflow.
- PNG export from the public view: 780 px wide, all dates/details included, with no editor controls. A 48-slot calendar generated four sequential 780 × 5302 PNGs with continued date headings. The last PNG was visually inspected and included the final slot and page count.
- Dependency installation audit reported zero known vulnerabilities after applying the development-tool glob dependency fix.

Local execution used the installed Node 26.3.0. CI is configured to use the pinned Node 24.22.2 LTS; GitHub CI has not yet been run.

## Still requires deployment or a physical device

- Real Cloudflare Access policy, DNS/custom domains, and unauthenticated/incognito boundaries on deployed hostnames.
- Actual GitHub PR CI, main-branch CD, branch protection, production environment/secrets, and remote D1 migration state.
- Touch dragging, native image sharing, download/save behavior, and memory limits on physical iOS Safari and Android devices.
- End-to-end offline reconnect, concurrent browser tabs, and an expired real Access session. Server conflict/auth behavior is covered by the focused tests; these device/session combinations were not manually exercised.

The suggested GitHub name still needs owner confirmation before creating a remote. No license was selected or added. No remote repository, secrets, Access configuration, or Cloudflare resources were created.

## Follow-up: interface cleanup and slot icons

Removed the global branding header/footer, landing-page marketing/benefits, and private-edit-link hint. PNG exports no longer include the corresponding branding; multi-image exports retain page numbers. Added an optional activity emoji picker to slot creation/editing, shared cards/details, and exports. Applied additive migration `0002_slot_icons.sql` to local D1; existing calendars and slots were preserved. Server validation accepts only supported icons and defaults omitted icons to blank for compatibility.

Typecheck, lint, all six focused tests, the frontend build, and the Worker dry run passed after the icon/storage change. Browser checks confirmed picking an icon, saving, reopening with the same icon, and rendering it in a PNG. Final export branding cleanup was followed by typecheck, lint, build, and a browser export check.

## Follow-up: themed calendar essentials

Removed the calendar intro badge (editor and share), star decoration, local-time label (including export), and trailing encouragement captions. Replaced system emoji artwork with 16 original inline SVG calendar icons using the app's pastel fills and olive outlines. Picker buttons include readable names; previous saved emoji values remain accepted and resolve to themed equivalents, including the selected state. No further D1 migration is needed.

Typecheck, lint, six focused tests, production frontend build, and Worker dry run passed. The focused suite verifies saving canonical icon IDs and accepting/resolving legacy values. Browser inspection confirmed existing saved content remains present, the requested elements are gone, the themed picker renders, and an exported PNG includes the custom coffee artwork.

## Release preparation · 5 November 2026

Removed the overall day/plan summary from editor, share view, and PNG export. Confirmed release hosts are `cl.d.htd.ink` for public share links and `cl-edit.d.htd.ink` for Access-protected editing. Added committed domain defaults and a launch runbook in SHIP.md. Deployment now waits for both CI checks and Gitleaks.

Typecheck, lint, six focused tests, frontend build, Worker dry run, and production dependency audit passed. Configuration checks verified the exact default domains, staging overrides, host isolation, disabled alternative Worker URLs, and failure on missing production settings. Browser verification confirmed the count row is removed and PNG export succeeds.

GitHub and Cloudflare authentication are available. Read-only account checks found the active target zone, with no calendar Access application, production D1 database, or custom-domain assignments yet. Local Git was initialized and source staged for review, without a commit, remote, or push. No production resource was created and nothing was deployed.

Gitleaks scanned the staged source with redacted output and reported no leaks. The runtime dependency audit reported zero known vulnerabilities. No production settings, credential files, or local D1 data are staged.

## Production D1 and GitHub provisioning · 5 November 2026

The owner confirmed the public repository name `chadismoving/mobile-view-share-calendar` and authorized D1/GitHub provisioning. Created the public repository and APAC production D1 database `mobile-share-calendar`, then applied both versioned migrations. Configured GitHub's production Environment and non-secret account/database/domain variables. `PRODUCTION_DEPLOY_ENABLED=false` holds Worker deployment while the owner sets up Access; the local Wrangler OAuth token was not uploaded to GitHub. No Worker, DNS, Access policy, or local calendar-data import was performed.

Added a database-only configuration generator so schema operations do not require Access values, and manual CI dispatch for the future gated release. Source publication and hosted CI status are verified through GitHub Actions; use the linked run results for current status.

## Map and banner feature · 5 November 2026

Added uploaded/cropped/replaced/removed calendar banners, public-banner authorization and share-link revocation, the optional Google Maps integration, numbered deduplicated locations, a desktop places sidebar, and phone Schedule/Map tabs. Preserved the existing pastel theme. Migration `0003_calendar_banners.sql` was applied to local D1 only.

Typecheck and lint passed without warnings, all eight focused tests passed, and the frontend production build and Worker dry run passed. New tests cover image validation, upload/ownership boundaries, banner persistence, stale-save protection, public-image revocation, normalized location grouping, and optional map configuration. Browser checks verified upload/crop, replacement, refresh persistence, public sharing, and PNG export with the banner. Both mobile views had no horizontal overflow at 320, 375, or 430 px.

Google's SDK was exercised with a local browser key, but the Google service rejected localhost with `RefererNotAllowedMapError`; live marker placement is not verified. The UI reports failure and retains the full list and direct Google Maps links. No map coordinates are persisted. A synthetic landscape was used as a local-only banner preview, with a small synthetic JPEG fixture in tests; no third-party reference image was copied into the product.

## First production deployment · 5 November 2026

Merged PR #6 to main (`28c2cb5`). Its main CI passed all eight focused tests, typecheck/lint, both builds, dependency audit, and secret scanning; PR dependency review passed. Exported a private production D1 backup, applied additive migration `0003_calendar_banners.sql`, and verified no pending migrations. Deployed Worker version `c00d1bfa-7bb8-46ba-b572-b71ac5103ce4` to both exact custom domains at 100% traffic using existing local Cloudflare authentication. Recorded the deployment in GitHub's production environment. Automatic GitHub deployment remains disabled pending a scoped deployment token.

The supplied Maps key is deployed and saved as a GitHub production Environment secret; no key was committed. Restarted local Wrangler with the updated key: Google still returned `RefererNotAllowedMapError` for localhost. Live pins remain unverified. The editor's unauthenticated write API redirects to Access. The owner confirmed Access should remain on the share host and explicitly deferred its live tests, so anonymous public availability is not expected for this release. No local calendars were imported into production. See SHIP.md for the current release state; earlier sections describe historical preparation steps.

## Traditional Chinese fonts · 5 November 2026

Added self-hosted Noto Sans TC for the interface and activity content, and Noto Serif TC for the calendar title. Medium activity headings and slightly looser title spacing retain the existing theme. PNG export now embeds only the font subsets used by each page and waits for font loading before pagination.

Typecheck, lint, and the production frontend build passed. A disposable local calendar with mixed Traditional Chinese and English verified the computed font families, the narrow 320 px layout without horizontal overflow, and a visually inspected 780 px PNG containing the serif title, sans activity content, punctuation, and themed icons. No user calendars or production data were changed for this preview. Live share-host testing remains deferred at the owner's request.
