import { describe, expect, it } from "vitest";
import { daysUntilExpiry, domainPillLabel, domainRunway, formatDomainDays, toDomainRows } from "../domainWatch";

const now = new Date(2026, 10, 6, 23, 30);
const rowsOf = (...dates: Array<string | null>) =>
  toDomainRows(dates.map((expire_date, i) => ({ name: `d${i}.com`, expire_date })), now);

describe("daysUntilExpiry", () => {
  it("counts whole local days regardless of the time of day", () => {
    expect(daysUntilExpiry("2026-11-06", now)).toBe(0);
    expect(daysUntilExpiry("2026-11-07", now)).toBe(1);
    expect(daysUntilExpiry("2026-11-05", now)).toBe(-1);
    expect(daysUntilExpiry("2027-07-10", now)).toBe(246);
  });

  it("treats a missing or malformed date as unknown", () => {
    expect(daysUntilExpiry("", now)).toBeNull();
    expect(daysUntilExpiry(null, now)).toBeNull();
    expect(daysUntilExpiry("July 2027", now)).toBeNull();
  });
});

describe("toDomainRows", () => {
  it("warns from the backend's first reminder at 30 days", () => {
    expect(rowsOf("2026-12-06", "2026-12-07", "2026-11-01", "").map((row) => row.level)).toEqual([
      "warning",
      "ok",
      "expired",
      "unknown",
    ]);
  });
});

describe("domainPillLabel", () => {
  it("reports the most urgent state", () => {
    expect(domainPillLabel(rowsOf("2027-07-10"))).toEqual({ label: "状态健康", healthy: true });
    expect(domainPillLabel(rowsOf("2027-07-10", ""))).toEqual({ label: "查询异常 (1)", healthy: false });
    expect(domainPillLabel(rowsOf("2026-11-10", ""))).toEqual({ label: "临期 (1)", healthy: false });
    expect(domainPillLabel(rowsOf("2026-11-01", "2026-11-10"))).toEqual({ label: "已过期 (1)", healthy: false });
  });

  it("counts a failed lookup even when the stored date is fine", () => {
    const rows = toDomainRows([{ name: "a.us", expire_date: "2027-07-10", last_error: "timeout" }], now);
    expect(domainPillLabel(rows)).toEqual({ label: "查询异常 (1)", healthy: false });
  });
});

describe("formatDomainDays", () => {
  it("words past, today and future", () => {
    expect(formatDomainDays(-3)).toEqual({ value: "3", unit: "天前已过期" });
    expect(formatDomainDays(0)).toEqual({ value: "0", unit: "今天到期" });
    expect(formatDomainDays(246)).toEqual({ value: "246", unit: "天后到期" });
  });
});

describe("domainRunway", () => {
  it("lights a segment per month, capped at a year", () => {
    expect(domainRunway(246)).toEqual({ lit: 8, label: "约 8 个月" });
    expect(domainRunway(800)).toMatchObject({ lit: 12 });
  });

  it("keeps one segment until the day it expires", () => {
    expect(domainRunway(3)).toEqual({ lit: 1, label: "不足 1 个月" });
    expect(domainRunway(0)).toEqual({ lit: 0, label: "今天" });
    expect(domainRunway(-2)).toEqual({ lit: 0, label: "已过期" });
  });
});
