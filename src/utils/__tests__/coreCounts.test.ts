import { describe, expect, it } from "vitest";
import { coreCounts, coreStatusLabel } from "@/utils/coreCounts";

const nodes = [
  { uuid: "a" },
  { uuid: "b" },
  { uuid: "pc", standby: true },
];

describe("coreCounts", () => {
  it("counts a powered-off standby node as standby, not offline", () => {
    const counts = coreCounts(nodes, new Map([["a", true], ["b", true], ["pc", false]]));
    expect(counts).toEqual({ online: 2, offline: 0, standby: 1 });
    expect(coreStatusLabel(nodes.length, counts)).toBe("1 STANDBY");
  });

  it("still alerts when a regular node is down, even with a standby node off", () => {
    const counts = coreCounts(nodes, new Map([["a", true], ["b", false], ["pc", false]]));
    expect(counts).toEqual({ online: 1, offline: 1, standby: 1 });
    expect(coreStatusLabel(nodes.length, counts)).toBe("1 OFFLINE");
  });

  it("counts a standby node that is on as online", () => {
    const counts = coreCounts(nodes, new Map([["a", true], ["b", true], ["pc", true]]));
    expect(counts).toEqual({ online: 3, offline: 0, standby: 0 });
    expect(coreStatusLabel(nodes.length, counts)).toBe("ALL ONLINE");
  });

  it("ignores nodes without data yet", () => {
    expect(coreCounts(nodes, new Map([["a", true]]))).toEqual({ online: 1, offline: 0, standby: 0 });
    expect(coreStatusLabel(0, { online: 0, offline: 0, standby: 0 })).toBe("SYNCING");
  });
});
