import { readFile, readdir } from "node:fs/promises";
const result = JSON.parse(await readFile(process.argv[2], "utf8"));
const applied =
  Array.isArray(result) &&
  result.length === 1 &&
  result[0].success === true &&
  Array.isArray(result[0].results)
    ? new Set(result[0].results.map((row) => row.name))
    : null;
const expected = (
  await readdir(new URL("../migrations", import.meta.url))
).filter((file) => file.endsWith(".sql"));
if (!applied || expected.some((name) => !applied.has(name)))
  throw new Error(
    "Pending or unverified D1 migrations. Back up D1 and apply reviewed migrations manually before deploying.",
  );
console.log("No pending D1 migrations.");
