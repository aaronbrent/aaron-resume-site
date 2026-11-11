import { describe, expect, it } from "vitest";
import { findRailwayDomains, findServiceNames } from "./deploy-railway";

describe("findRailwayDomains", () => {
  it("extracts unique *.up.railway.app hosts from CLI output", () => {
    const out = JSON.stringify({
      domains: [{ domain: "web-production-1a2b.up.railway.app" }],
      note: "https://WEB-production-1a2b.up.railway.app is live",
    });
    expect(findRailwayDomains(out)).toEqual(["web-production-1a2b.up.railway.app"]);
  });

  it("returns nothing for custom or missing domains", () => {
    expect(findRailwayDomains("aaronellis.dev railway.app")).toEqual([]);
    expect(findRailwayDomains("")).toEqual([]);
  });
});

describe("findServiceNames", () => {
  it("walks any JSON shape for service names", () => {
    expect(findServiceNames('[{"id":"1","name":"web"},{"id":"2","name":"db"}]')).toEqual([
      "web",
      "db",
    ]);
    expect(findServiceNames('{"services":{"edges":[{"node":{"name":"web"}}]}}')).toEqual([
      "web",
    ]);
  });

  it("tolerates non-JSON output", () => {
    expect(findServiceNames("Unauthorized")).toEqual([]);
  });
});
