import { describe, expect, it } from "vitest";
import { geocodingProblem, mapProblemMessage } from "../src/lib/map-errors";

describe("Google Maps failure classification", () => {
  it("only asks for a clearer address for genuine zero results", () => {
    const denied = {
      code: "REQUEST_DENIED",
      message:
        "Geocoding Service: You must enable Billing on the Google Cloud Project",
    };
    expect(geocodingProblem(denied)).toBe("billing");
    expect(geocodingProblem({ code: "REQUEST_DENIED" })).toBe("denied");
    expect(
      geocodingProblem(new Error("GEOCODER_GEOCODE: REQUEST_DENIED")),
    ).toBe("denied");
    expect(geocodingProblem({ code: "ZERO_RESULTS" })).toBe("not-found");
    expect(geocodingProblem("ZERO_RESULTS")).toBe("not-found");
    expect(geocodingProblem({ code: "OVER_QUERY_LIMIT" })).toBe("quota");
    expect(geocodingProblem({ code: "UNKNOWN_ERROR" })).toBe("unavailable");
    expect(geocodingProblem(new TypeError("Failed to fetch"))).toBe(
      "unavailable",
    );
    expect(geocodingProblem(null)).toBe("unavailable");
    for (const message of Object.values(mapProblemMessage))
      expect(message).not.toMatch(/clearer address|complete address/);
  });
});
