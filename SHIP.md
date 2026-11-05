# Calendar release · 5 November 2026

| Purpose                      | Hostname                              | Access                                    |
| ---------------------------- | ------------------------------------- | ----------------------------------------- |
| Public calendar links        | `https://cl.d.htd.ink/s/{shareToken}` | Public, read-only                         |
| Private editor and write API | `https://cl-edit.d.htd.ink`           | Cloudflare Access plus private edit token |

The confirmed origins are versioned in `deployment/production.json`. The public bare root serves no editor; share links use `/s/{shareToken}`.

## Provisioned

- Public repository: [chadismoving/mobile-view-share-calendar](https://github.com/chadismoving/mobile-view-share-calendar). The owner confirmed the final name.
- Production D1 database: `mobile-share-calendar`, provisioned in APAC. Both `0001_initial.sql` and `0002_slot_icons.sql` have been applied. Local test calendars have not been imported.
- GitHub `production` Environment created. The account ID, D1 ID, and both origins are configured as non-secret repository variables.
- `PRODUCTION_DEPLOY_ENABLED=false` explicitly prevents Worker deployment while the owner configures Access. PR and main CI checks still run.
- Credentials, local production settings, generated configs, databases, and builds are ignored by Git. No license has been selected.

Database connection metadata is in the ignored local `.env.production` and GitHub repository variables. D1 migrations can run independently of Access using `npm run db:production`; this generates the ignored `.wrangler.d1.json` without deploying a Worker. CI still checks that all migrations are applied before any future deployment.

## Complete before publishing the Worker

1. The owner will configure a self-hosted Access application covering **all paths of `cl-edit.d.htd.ink`**, with an Allow policy for their intended identities and no Bypass policy. Keep **`cl.d.htd.ink` outside Access**, including wildcard Access applications.
2. Copy the Access team HTTPS origin and the editor application's AUD into GitHub repository variables:

   ```sh
   gh variable set ACCESS_TEAM_DOMAIN --body 'https://your-team.cloudflareaccess.com' --repo chadismoving/mobile-view-share-calendar
   gh variable set ACCESS_AUD --body 'your-editor-app-audience' --repo chadismoving/mobile-view-share-calendar
   ```

3. Create a narrowly scoped Cloudflare deployment API token for the Worker/account and required zone resources, with D1 read access for the migration gate. Store it as the **production Environment** secret, through GitHub's secure prompt:

   ```sh
   gh secret set CLOUDFLARE_API_TOKEN --env production --repo chadismoving/mobile-view-share-calendar
   ```

   The local Wrangler OAuth credential has not been copied into GitHub. Keep credentials out of source and chat.

4. Review the exact hostnames, Access coverage, and any conflicting DNS records. The eventual Worker deployment attaches the two exact Custom Domains and Cloudflare provisions their DNS/TLS. `workers.dev` and preview URLs remain disabled. No Worker or DNS records have been deployed in this provisioning step.
5. Once the Access policy and credentials are ready, enable the release gate and run CI on main:

   ```sh
   gh variable set PRODUCTION_DEPLOY_ENABLED --body true --repo chadismoving/mobile-view-share-calendar
   gh workflow run ci.yml --ref main --repo chadismoving/mobile-view-share-calendar
   ```

   Deployment runs only after typecheck, lint, focused tests, frontend/Worker builds, dependency audit, secret scanning, and the remote migration gate pass. Future successful pushes to `main` deploy while this gate is enabled. PRs never deploy to production. Set the variable back to `false` to hold future deployments.

## Validation and launch

Local checks already passed: typecheck, lint, six focused Workers/D1 tests, frontend build, Worker dry run, domain/staging/fail-closed configuration checks, production dependency audit, and staged-source Gitleaks scan. Check the repository's [Actions runs](https://github.com/chadismoving/mobile-view-share-calendar/actions) for current hosted CI results. The first remote push is verified as part of repository publication; local passes do not establish production availability.

After the first Worker deployment:

- Open the editor and write APIs without an Access session, even with a valid edit link: Access must challenge or the Worker must deny access.
- Open a real `cl.d.htd.ink/s/...` link in an incognito browser: calendar and exports must work without Access, with no editing controls. Editing and writes must fail on that hostname.
- Create a fresh production calendar, edit, reorder, refresh, rotate the share link, and verify that the previous link is revoked.
- Export short and long calendars on iOS Safari and Android, reviewing every PNG and file-share/save behavior.
- Verify both certificates, the deployed commit, and GitHub's deployment record.

The production database starts empty. Local edit/share URLs address local D1 data and do not automatically become production URLs. For later schema changes, take a secure D1 backup and review compatibility before migration. See README for database backups, Time Travel, and code rollback.
