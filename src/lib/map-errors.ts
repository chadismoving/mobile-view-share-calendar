export type MapProblem =
  "not-found" | "billing" | "denied" | "quota" | "unavailable" | "marker";

export function geocodingProblem(error: unknown): MapProblem {
  const value =
    typeof error === "object" && error !== null
      ? (error as { code?: unknown; message?: unknown })
      : {};
  const code = typeof value.code === "string" ? value.code : "";
  const message =
    typeof value.message === "string"
      ? value.message
      : typeof error === "string"
        ? error
        : "";
  if (code === "ZERO_RESULTS" || /\bZERO_RESULTS\b/.test(message))
    return "not-found";
  if (/billing/i.test(message)) return "billing";
  if (code === "REQUEST_DENIED" || /\bREQUEST_DENIED\b/.test(message))
    return "denied";
  if (code === "OVER_QUERY_LIMIT" || /\bOVER_QUERY_LIMIT\b/.test(message))
    return "quota";
  return "unavailable";
}

export const mapProblemMessage: Record<
  Exclude<MapProblem, "not-found">,
  string
> = {
  billing:
    "Google Maps billing is not enabled. The calendar owner needs to enable billing for the map’s Google Cloud project before location pins can load.",
  denied:
    "Google denied location lookups (REQUEST_DENIED). The calendar owner needs to check Maps billing, Geocoding API access, and website restrictions.",
  quota:
    "Google Maps has reached its location-lookup limit. Please try again later.",
  unavailable:
    "Location lookup is temporarily unavailable. Try again or open the locations below in Google Maps.",
  marker:
    "The locations were found, but their map pins could not be displayed. Please retry or open the locations below in Google Maps.",
};
