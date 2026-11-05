import { describe, expect, it } from "vitest";
import { findResourcePeaks, type ResourceSample } from "../resourcePeaks";

const node = (uuid: string, overrides: Partial<ResourceSample> = {}): ResourceSample => ({
  uuid,
  online: true,
  cpuPct: 10,
  ramUsed: 1,
  ramTotal: 10,
  diskUsed: 1,
  diskTotal: 10,
  ...overrides,
});

describe("findResourcePeaks", () => {
  it("picks the busiest node for each resource separately", () => {
    const peaks = findResourcePeaks([
      node("a", { cpuPct: 80 }),
      node("b", { ramUsed: 5 }),
      node("c", { diskUsed: 9.5 }),
    ]);
    expect(peaks.map(({ key, uuid, level }) => [key, uuid, level])).toEqual([
      ["cpu", "a", "warning"],
      ["ram", "b", "ok"],
      ["disk", "c", "critical"],
    ]);
  });

  it("ignores offline nodes, whose readings are stale", () => {
    const peaks = findResourcePeaks([node("gone", { online: false, cpuPct: 99 }), node("unknown", { online: null, cpuPct: 98 }), node("up")]);
    expect(peaks[0]).toMatchObject({ uuid: "up", pct: 10 });
  });

  it("skips a resource no node can report", () => {
    const peaks = findResourcePeaks([node("a", { ramTotal: 0, diskTotal: 0 })]);
    expect(peaks.map((peak) => peak.key)).toEqual(["cpu"]);
  });

  it("keeps percentages inside the bar", () => {
    expect(findResourcePeaks([node("a", { cpuPct: 130 })])[0]).toMatchObject({ pct: 100, level: "critical" });
  });

  it("returns nothing when no node is online", () => {
    expect(findResourcePeaks([node("a", { online: false })])).toEqual([]);
  });
});
