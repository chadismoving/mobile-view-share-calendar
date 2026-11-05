import { readFile, writeFile } from "node:fs/promises";
// JSONC comments are intentionally absent in this config, so JSON.parse is sufficient.
const config = JSON.parse(
  await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
);
const domains = JSON.parse(
  await readFile(
    new URL("../deployment/production.json", import.meta.url),
    "utf8",
  ),
);
const settings = {
  ...process.env,
  EDITOR_ORIGIN: process.env.EDITOR_ORIGIN?.trim() || domains.editorOrigin,
  PUBLIC_SHARE_ORIGIN:
    process.env.PUBLIC_SHARE_ORIGIN?.trim() || domains.publicShareOrigin,
};
const required = [
  "D1_DATABASE_ID",
  "EDITOR_ORIGIN",
  "PUBLIC_SHARE_ORIGIN",
  "ACCESS_TEAM_DOMAIN",
  "ACCESS_AUD",
];
for (const key of required)
  if (!settings[key]?.trim())
    throw new Error(`Missing required deployment variable: ${key}`);
if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    settings.D1_DATABASE_ID,
  ) ||
  /^0{8}-/.test(settings.D1_DATABASE_ID)
)
  throw new Error("Set D1_DATABASE_ID to the real production D1 UUID.");
for (const key of [
  "EDITOR_ORIGIN",
  "PUBLIC_SHARE_ORIGIN",
  "ACCESS_TEAM_DOMAIN",
]) {
  const url = new URL(settings[key]);
  if (
    url.protocol !== "https:" ||
    url.origin !== settings[key] ||
    url.username ||
    url.password
  )
    throw new Error(
      `${key} must be an HTTPS origin without a path or trailing slash.`,
    );
}
if (settings.EDITOR_ORIGIN === settings.PUBLIC_SHARE_ORIGIN)
  throw new Error("Editor and public share hostnames must be different.");
if (
  !new URL(settings.ACCESS_TEAM_DOMAIN).hostname.endsWith(
    ".cloudflareaccess.com",
  )
)
  throw new Error("Use your Cloudflare Access team domain.");
config.vars = {
  ENVIRONMENT: "production",
  ...Object.fromEntries(
    required
      .filter((key) => key !== "D1_DATABASE_ID")
      .map((key) => [key, settings[key]]),
  ),
};
for (const key of ["GOOGLE_MAPS_BROWSER_KEY", "GOOGLE_MAPS_MAP_ID"]) {
  if (settings[key]?.trim()) config.vars[key] = settings[key].trim();
}
config.d1_databases[0].database_id = settings.D1_DATABASE_ID;
delete config.env;
// Access and DNS are configured externally before first deploy. These exact
// custom domains are then attached to this Worker; workers.dev remains disabled.
config.routes = [settings.EDITOR_ORIGIN, settings.PUBLIC_SHARE_ORIGIN].map(
  (origin) => ({ pattern: new URL(origin).hostname, custom_domain: true }),
);
await writeFile(
  new URL("../.wrangler.production.json", import.meta.url),
  JSON.stringify(config, null, 2) + "\n",
  { mode: 0o600 },
);
console.log(
  "Production configuration generated. Verify Access covers the entire editor hostname before deployment.",
);
