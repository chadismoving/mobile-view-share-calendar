# Calendar release · 5 November 2026

| Purpose              | Hostname                              | Current access                                 |
| -------------------- | ------------------------------------- | ---------------------------------------------- |
| Shared calendars     | `https://cl.d.htd.ink/s/{shareToken}` | Read-only; Cloudflare Access required by owner |
| Editor and write API | `https://cl-edit.d.htd.ink`           | Cloudflare Access plus private edit token      |

The owner explicitly chose to retain Access on both hosts and defer live tests on the share host. Shared links currently require an allowed Access identity. The share hostname still cannot edit calendars. The bare share root serves no editor.

## Deployed

- Source: merged [PR #6](https://github.com/chadismoving/mobile-view-share-calendar/pull/6), main commit `28c2cb5b32e5cdf7ace1d5b65d70646dee936ba7`.
- Worker: `mobile-share-calendar`, version `c00d1bfa-7bb8-46ba-b572-b71ac5103ce4`, deployed at 02:06 UTC on 5 November 2026 at 100% traffic.
- Both exact Custom Domains are enabled and have Cloudflare certificate assignments. `workers.dev` and preview URLs remain disabled.
- Production D1: `mobile-share-calendar` in APAC. All three versioned migrations, including `0003_calendar_banners.sql`, are applied. A private SQL backup was exported before the banner migration. No local test calendars were imported.
- Uploaded/cropped calendar banners, themed slot icons, calendar editing/sharing/export, and Google Maps integration are included. The existing colors remain unchanged.
- The supplied Maps browser key is deployed and saved in the GitHub production Environment secret. Editor Access issuer/audience are configured locally and as GitHub variables. Keys and generated configuration remain ignored.

## Validation

[Main CI](https://github.com/chadismoving/mobile-view-share-calendar/actions/runs/41952816061) passed typecheck, lint, all eight focused Workers/D1 tests, frontend and Worker builds, runtime dependency audit, and secret scanning before deployment. PR dependency review also passed. The remote migration gate reported no pending migrations.

Cloudflare's deployment API confirmed the version at 100% traffic and both Custom Domains attached to this Worker. An unauthenticated editor write request redirects to Cloudflare Access. Production deployment is recorded in GitHub's `production` environment.

Local browser verification covered banner upload/crop/replacement, persistence, shared rendering, PNG export, and phone Schedule/Map views without horizontal overflow at 320, 375, and 430 px. The updated Google key still rejects localhost with `RefererNotAllowedMapError`; live map pins have not been verified. Live shared-calendar tests were deferred at the owner's request. Authenticated production editing, map pins, and physical iOS/Android export behavior remain unverified.

## Future releases

Automatic GitHub deployment remains disabled with `PRODUCTION_DEPLOY_ENABLED=false`. A scoped `CLOUDFLARE_API_TOKEN` is still needed in the GitHub production Environment; local Wrangler OAuth credentials were not uploaded. The initial release used the existing local Cloudflare authentication after main CI passed.

To enable automatic releases, configure that scoped token, then set `PRODUCTION_DEPLOY_ENABLED=true`. The workflow deploys verified main only, after checks, secret scanning, and the remote migration gate. It does not apply migrations. See README for required permissions and configuration.

For schema changes, export a private D1 backup and apply reviewed migrations before deploying compatible code. For a manual release, use the validated ignored production configuration with `npm run deploy`. Local `.dev.vars` is for development; production settings must be supplied separately. Never commit keys, backups, generated configuration, or local databases.

The current source is the first Worker version, so there is no earlier application version to roll back to. Future compatible application rollbacks can use `npx wrangler rollback --config .wrangler.production.json`; schema recovery is separate. See README for D1 Time Travel and backup recovery.
