import { readFile, writeFile } from "node:fs/promises";

// Schema provisioning does not depend on Access or publish a Worker.
const databaseId = process.env.D1_DATABASE_ID?.trim();
if (
  !databaseId ||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    databaseId,
  ) ||
  /^0{8}-/.test(databaseId)
)
  throw new Error("Set D1_DATABASE_ID to the real production D1 UUID.");
const source = JSON.parse(
  await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
);
const binding = source.d1_databases.find(
  (database) => database.binding === "DB",
);
if (!binding) throw new Error("The DB binding is missing from wrangler.jsonc.");
await writeFile(
  new URL("../.wrangler.d1.json", import.meta.url),
  JSON.stringify(
    {
      name: source.name,
      compatibility_date: source.compatibility_date,
      workers_dev: false,
      d1_databases: [{ ...binding, database_id: databaseId }],
    },
    null,
    2,
  ) + "\n",
  { mode: 0o600 },
);
console.log(
  "Production D1 configuration generated; Worker and Access settings are not modified.",
);
