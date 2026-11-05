# Daylight · Mobile Shareable Calendar

A small, colorful calendar for plans worth sharing. Create a titled schedule, add dates and time slots, arrange them with touch or keyboard, send a read-only link, and export full-content, phone-sized PNGs.

React + TypeScript + Vite + Tailwind, dnd-kit, a Cloudflare Worker, and D1. No separate server or app login. Cloudflare Access **must** protect editing in production.

## Local setup

Use Node **24.22.2** (`nvm use`) and npm. The lockfile is committed.

```sh
npm ci
npm run db:local
npm run dev
```

Open the localhost URL printed by Wrangler (normally `http://localhost:8787`). `npm run dev` builds the frontend first and serves the whole app through Workers, including a persistent local D1 database. Re-run it after frontend changes. For frontend hot reload, leave Wrangler running and run `npm run dev:ui` in another terminal; open `http://127.0.0.1:5173`. Vite proxies `/api` to Wrangler. Use the Wrangler URL to exercise local share links.

The explicit `development` environment skips Access **only on localhost/127.0.0.1/[::1]**. It does not deploy an unprotected development editor. Never change `ENVIRONMENT` in the production configuration. The unconfigured production Worker fails closed with 503.

```sh
npm run check
```

This runs typecheck, lint, focused Workers/D1 tests, the frontend production build, and a Wrangler deployment dry run. No Cloudflare account or production database is required. `npm test` runs the focused suite once. The suite covers create/read/update/delete of schedule content, durable ordering, conflicts, validation, share revocation, Access JWT verification, independent edit-token checks, CSRF, host boundaries, and rate limits.

## How it behaves

- Create a calendar on `/`. Its private edit link becomes `/edit/{token}`. Bookmark it: there is no account-based list or lost-link recovery. Both an allowed Access session **and** that token are required in production.
- Dates are displayed chronologically. Add up to 60 dates, 100 slots per date, and 500 slots total. The complete JSON save is capped at 1 MiB; very long details can reach that limit earlier.
- Slots can have an optional icon, chosen when creating or editing a slot. The picker starts with 16 original calendar essentials in a matching pastel style. Inline SVG keeps the artwork consistent in cards, details, public shares, and PNG exports. Earlier saved emoji choices remain valid and display the closest themed icon; no database migration is needed for this artwork update.
- New/edited slots are sorted by start time until a drag or move establishes custom order. Use a date’s menu to restore **Sort by time**. A move preserves start/end times. A 230 ms hold on a drag handle starts touch dragging; ordinary content remains scrollable. Keyboard dragging and slot details’ **Move up / Move down / Move to date** are alternatives.
- Times are local wall-clock times on the named date. No timezone conversion, overnight slots, recurring events, or calendar sync. Split an overnight plan across dates. Overlaps are allowed and marked on cards.
- Changes autosave after a short pause. A local draft is kept in browser storage until acknowledged by the server; reconnect retries automatically. Do not clear site storage while offline. Browser storage restrictions can prevent draft recovery. There is no offline service-worker/app-shell cache.
- Revision checks prevent silent overwrites. On conflict, keep the saved version or explicitly replace it with your draft. Export can include the visible draft; sharing requires successful saving.
- Share links use `/s/{token}` on the **public share hostname**. Anyone with the link can read and export. Replacing the link immediately revokes the previous token for future requests, but cannot revoke downloaded images, already-open pages, or copies someone made.
- PNG export lazy-loads the image library and captures a dedicated 390 CSS px layout at 2× density (780 px wide). All text, dates, cards, and links are included. Pages are conservatively capped around 2,800 CSS px tall for mobile canvas memory. Dates stay together when possible; oversized dates repeat their date heading with “continued.” Sequential filenames preserve order. An exceptionally tall single slot reports a clear error instead of silently truncating it. No edit tokens, URLs, buttons, or drag handles enter the image layout.
- Native file sharing appears only when supported. Otherwise use the PNG download links or touch and hold the previews to save on iOS. Banner images are served from the same origin for reliable export. The interactive Google Map is a web feature and is not captured into PNGs; all location text remains included.

See [SHIP.md](SHIP.md) for the current release preparation and remaining launch steps.

## Traditional Chinese typography

The interface, activity cards, map place labels, and PNG body text use **Noto Sans TC**. Calendar titles use **Noto Serif TC**, with regular titles and medium activity headings. The fonts are self-hosted from pinned Fontsource variable-font packages; Unicode subsets load as needed, without a Google Fonts request. The existing cream, sage, and pastel colors are unchanged.

PNG export waits for fonts before measuring layout and embeds the subsets needed by each page. Font downloads are reused within a multi-image export, so saved images preserve the Chinese typography without embedding both complete CJK families. The original SIL Open Font Licenses are distributed in `public/assets/fonts/`.

## Banners and Google Maps

Upload a JPG, PNG, or WebP cover from the editor's **Add banner** action. The crop preview supports vertical positioning for taller photos. Images are re-encoded to a 1600 × 600 JPEG, with a 750 KB upload cap; input files are limited to 15 MB and 40 megapixels. Cropping strips the original image metadata. Change/remove actions are editor-only. The same banner appears on the public view and in each exported PNG.

Apply migration `0003_calendar_banners.sql` before deploying this version. It adds an optional banner reference and a separate image table; existing calendars remain intact. Images stay private until the banner selection is autosaved. Public image access requires the current share link and currently selected banner, so removing a banner or replacing a share link revokes those public image URLs. Earlier uploads remain in D1 as private image versions; account for image storage when planning retention/cleanup. No R2 bucket or separate image service is required.

The desktop layout shows the timeline beside **Map & places**. On phones, switch between **Schedule** and **Map**. Every non-empty location is listed; repeated addresses share one numbered pin while retaining all associated stops. Use complete addresses when adding slots. The Google SDK loads only after **Load Google Map** is clicked. Address lookup results stay in the current view's memory and are never stored in D1 or localStorage. Unresolved locations stay in the list with a direct Google Maps link.

To enable the map:

1. In your Google Cloud project, enable **Maps JavaScript API** and **Geocoding API**, with billing configured for that project.
2. Create a browser key restricted to those APIs and these website referrers as appropriate:

   ```text
   https://cl.d.htd.ink/*
   https://cl-edit.d.htd.ink/*
   http://localhost:8787/*
   http://127.0.0.1:8787/*
   http://127.0.0.1:5173/*
   ```

3. Put `GOOGLE_MAPS_BROWSER_KEY=...` in the ignored `.dev.vars` for development, then restart Wrangler and reload the page. For GitHub deployment, set `GOOGLE_MAPS_BROWSER_KEY` as a **production Environment secret**. This is a browser key: the app intentionally exposes it via `/api/config`, so website and API restrictions are required; do not reuse a server/admin key.
4. Optionally set `GOOGLE_MAPS_MAP_ID` in `.dev.vars` and the matching GitHub repository variable to use your own JavaScript map ID/style. The initial setup uses Google's `DEMO_MAP_ID`; create your own map ID for production configuration.
5. Verify marker positions, map controls, and attribution on the actual allowed hosts. `RefererNotAllowedMapError` means the page's origin needs to be allowed in the key settings. Without a configured/working key, locations remain saved and can be opened individually.

If the base map loads but location pins fail with `REQUEST_DENIED`, check billing on the project associated with the browser key, enable the Geocoding API in that same project, and check the key's API/website restrictions. The base map and address lookups are separate services. Only `ZERO_RESULTS` indicates that Google could not find an address; denied requests, quota/network failures, and marker-rendering failures are displayed separately. Retry after correcting the project configuration.

Maps requests use an origin-only referrer so edit-token paths are not sent as referrers. Google's SDK resource/CSP permissions are enabled only when a Maps key is configured; map initialization uses the documented Google allowlist, including the SDK's evaluation requirement. Sources: [Google Maps CSP guide](https://developers.google.com/maps/documentation/javascript/content-security-policy), [advanced markers](https://developers.google.com/maps/documentation/javascript/advanced-markers/start), and [API-key restrictions](https://developers.google.com/maps/api-security-best-practices).

## Production prerequisites: Access and separate hostnames

Configure these in **your Cloudflare account**, outside this repository, before deploying:

1. Use the confirmed hostnames in `deployment/production.json`: **`cl.d.htd.ink` for share links** and **`cl-edit.d.htd.ink` for the private editor**. Both are attached in the `d.htd.ink` Cloudflare zone. Use a dedicated D1 database for production.
2. Create a Cloudflare Zero Trust **self-hosted Access application covering the entire editor hostname**, `cl-edit.d.htd.ink`, with no path restrictions. Use an Allow policy for your authorized identities. Do not add a Bypass policy. Copy its Application Audience (AUD) and team domain (`https://your-team.cloudflareaccess.com`). The Worker independently verifies the JWT signature, issuer, audience, and expiration using the team’s public keys; trusting the header alone is insufficient. See [Cloudflare JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).
3. The owner currently keeps `cl.d.htd.ink` behind Access too. Recipients therefore need an allowed Access identity as well as the share link. For anonymous sharing later, the owner can remove Access coverage from this hostname while retaining it on the editor. The Worker allows only share pages, share GET APIs, assets, and robots.txt on the share hostname; write and editor paths are rejected there.
4. The generated deployment config attaches **both exact custom domains** to the same Worker, allowing Cloudflare to provision their DNS/TLS. Resolve existing conflicting DNS records before deployment. The editor hostname’s Access policy must already exist. `workers.dev` and version preview URLs are disabled, and the Worker rejects unknown hostnames. Static assets are routed through the Worker first, so an asset fallback cannot bypass protected HTML/API handling. See [Workers static asset routing](https://developers.cloudflare.com/workers/static-assets/binding/).
5. Keep request URL logging, third-party analytics, and error trackers off for token-bearing routes. The app sets `no-store`, an origin-only referrer policy, `noindex`, a restrictive CSP, and frame protections. The Worker’s error log intentionally omits URLs and exception contents. Review Cloudflare account-level HTTP logs/retention too: tokens in link paths can appear in infrastructure logs. Robots directives prevent cooperative indexing; they are not authentication.

The production D1 database already exists. For a fresh account or staging setup, create a separate database; for this production release, reuse its existing UUID. Export the public configuration values in your local shell (copy placeholders from `.env.example`; npm does **not** load that file automatically):

```sh
npx wrangler login
# Production database already provisioned; do not create a duplicate.
export D1_DATABASE_ID='your-real-database-uuid'
export EDITOR_ORIGIN='https://cl-edit.d.htd.ink'
export PUBLIC_SHARE_ORIGIN='https://cl.d.htd.ink'
export ACCESS_TEAM_DOMAIN='https://your-team.cloudflareaccess.com'
export ACCESS_AUD='your-application-audience'
```

The production config generator defaults to the confirmed hostnames in `deployment/production.json`; environment variables can override them for staging. Origins must have no trailing slash or path. `node scripts/production-config.mjs` validates the values and writes the ignored `.wrangler.production.json`; real deployment values are not baked into public frontend assets. `.dev.vars`, `.env`, generated config, local databases, and credentials are ignored. Share identifiers are random 256-bit values stored as a unique indexed identifier. Only SHA-256 hashes of private edit tokens are stored in D1. Edit tokens appear only in the authenticated creation response and private browser URL.

Review and apply the versioned schema explicitly, then deploy:

```sh
npm run db:production
npm run deploy
```

These commands perform real remote mutations: run only after checking the account, Access, routes, and database. No live resources are created by installing or building this project. Rate limit bindings allow 60 share API reads/minute/IP and 10 calendar creations/minute/IP (Cloudflare’s distributed limits are approximate). Access protects creation; the current owner-managed Access setup also protects shared calendars. Additional zone WAF/rate-limit policies can be configured externally.

### Database migrations, backups, and rollback

Migrations live in `migrations/`. D1 batches atomically save a calendar snapshot; a per-request nonce guards all child writes if the revision check loses a race. Public responses are explicitly projected and never contain edit credentials.

Before **any production migration**, export a backup to a secure location outside the repository:

```sh
npx wrangler d1 export DB --remote --config .wrangler.production.json --output /secure/path/calendar-backup.sql
npx wrangler d1 migrations list DB --remote --config .wrangler.production.json
```

Review SQL for destructive changes, test against a separate staging D1, and apply with `npm run db:production`. CD deliberately **does not apply migrations**: it queries `d1_migrations`, compares it to the versioned migration files, and fails if any are pending. Before deployment, the operator must apply all migrations, including `0001_initial.sql` and `0002_slot_icons.sql`, and `0003_calendar_banners.sql`. Later migrations should be additive and backward-compatible so the currently deployed Worker stays operational while migrations run.

Rollback application code with `npx wrangler rollback --config .wrangler.production.json` after confirming the target version is compatible with the database. Schema changes are not automatically reversed by a code rollback. For data recovery, use [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) or a verified secure export, coordinating writes and the application version before restoration. A database restore can also restore old share links, so rotate affected links afterwards. Keep production data and backups out of Git and Actions artifacts.

## Publish under chadismoving and enable CI/CD

The public repository is [chadismoving/mobile-view-share-calendar](https://github.com/chadismoving/mobile-view-share-calendar), confirmed and created on 5 November 2026. No license has been selected or added.

Production D1 `mobile-share-calendar` has been provisioned in APAC with all three schema migrations applied. Its ID is stored in GitHub repository variables and the ignored local `.env.production`; no local test schedules were imported. For an existing database, inspect the migrations before applying additional changes. `npm run db:production` generates a D1-only config and does not require Access values or deploy a Worker.

The first production Worker was deployed locally on 5 November 2026 from verified main commit `28c2cb5`; see [SHIP.md](SHIP.md) for its version and validation limits. Automatic GitHub deployment remains disabled by `PRODUCTION_DEPLOY_ENABLED=false` because a scoped `CLOUDFLARE_API_TOKEN` has not been configured. CI and secret scanning still run. After that production Environment secret is configured, set the variable to `true` and either push to `main` or manually run the CI workflow on `main`.

A GitHub **production** Environment, the D1/account/domain and editor Access variables, and the Maps browser-key secret are configured. The local Wrangler OAuth token has not been copied to GitHub. Configure the scoped deployment token below to enable automatic releases:

| Kind                | Name                    | Value                                                                                                                     |
| ------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Environment secret  | `CLOUDFLARE_API_TOKEN`  | Narrowly scoped Cloudflare token for this Worker/account, D1 read, and required custom-domain/zone deployment permissions |
| Repository variable | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID                                                                                                     |
| Repository variable | `D1_DATABASE_ID`        | Production D1 UUID                                                                                                        |
| Repository variable | `EDITOR_ORIGIN`         | `https://cl-edit.d.htd.ink`                                                                                               |
| Repository variable | `PUBLIC_SHARE_ORIGIN`   | `https://cl.d.htd.ink`                                                                                                    |
| Repository variable | `ACCESS_TEAM_DOMAIN`    | Access team HTTPS origin                                                                                                  |
| Repository variable | `ACCESS_AUD`            | Application AUD                                                                                                           |

Use the minimum permissions for the chosen account and deployment resources. The operator applying migrations needs D1 **write** separately; CD only reads migration state. This follows Cloudflare’s documented [GitHub Actions token authentication](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/); the workflow does not invent an OIDC exchange that Wrangler does not support. Rotate the scoped token through GitHub Secrets, never files in source control.

Enable branch protection for `main`, require CI/checks and security checks, disallow direct pushes if desired, enable GitHub secret scanning and push protection, and set production Environment reviewers if desired. Then push:

```sh
git push -u origin main
```

`.github/workflows/ci.yml` runs `npm ci`, typecheck, lint, tests, frontend build, Worker dry run, and a runtime-dependency audit on PRs and pushes to `main`. The production job runs only on `main` for a push or manual CI dispatch, **after checks pass** and only when `PRODUCTION_DEPLOY_ENABLED=true`, in the production Environment. It rejects an outdated push before deployment. Fork PRs get no production secrets and never deploy. The CI workflow also runs Gitleaks, and deployment waits for both checks and secret scanning. `.github/workflows/security.yml` adds pull-request dependency review. For an organization repository, Gitleaks may need its organization license; for this personal-account repository it does not. Dependabot reviews npm and Actions weekly. Action versions are major-pinned; enable automated updates and optionally pin reviewed commit SHAs in your organization policy.

Preview deployments are intentionally not created for untrusted PRs. For staging, duplicate this setup with a separate Worker, D1, Access application, two staging hostnames, and a separate GitHub Environment. Never point a preview at production D1. The local `development` environment is for loopback development, not Internet deployment.

## Before calling a deployment ready

Automated checks exercise the real local Workers runtime and D1, but cannot verify your external Access policy, DNS, or GitHub environment. After configuring/deploying, manually verify:

- Open editor and write APIs unauthenticated: Access challenges or Worker 401/403, even with a valid edit link. Public share hostname rejects editor/write routes; alternative Worker hostnames cannot bypass Access.
- Open a share link with an allowed Access identity: view details and export, with no editing controls. Replace the link; the old one returns unavailable. Anonymous sharing is only expected if the owner later removes Access from the share host.
- On 320, 375, and 430 px viewports: create two dates and several slots including 3:00–5:00 PM; edit, drag within/across dates, use keyboard/move controls, refresh, and confirm persistence and no horizontal scrolling.
- Try offline editing/reconnect, concurrent tabs, and an expired Access session. Confirm drafts remain recoverable.
- On actual iOS Safari and Android: export short and long schedules, review **every** PNG, and try native file share/download/save. Device canvas memory and native share behavior need physical-device checks.
- Confirm PR CI and a protected main deployment complete successfully on GitHub; local dry runs do not prove a production deploy.

## Structure

```text
src/                 React editor, share view, dialogs, timeline, autosave, PNG export
shared/calendar.ts   Shared types, validation, ordering and formatting
worker/              Access verification, HTTP security, API and transactional D1 store
migrations/          Versioned D1 schema
deployment/          Confirmed production hostname defaults
scripts/             Validated deployment configuration and migration gate
 tests/              Focused Workers/D1 integration and security tests
.github/             CI/CD, dependency review, secret scanning, Dependabot
```
