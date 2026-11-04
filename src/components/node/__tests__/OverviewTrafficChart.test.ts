import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { appendTrafficPoint, getTrafficChartThemeStyles } from "../OverviewTrafficChart";

describe("OverviewTrafficChart history", () => {
  it("keeps only the real samples it was given, oldest first, capped at the window", () => {
    const history: Array<{ time: number; rate: number }> = [];
    appendTrafficPoint(history, { time: 1, rate: 100 });
    expect(history).toEqual([{ time: 1, rate: 100 }]);

    for (let time = 2; time <= 20; time += 1) appendTrafficPoint(history, { time, rate: time });
    expect(history).toHaveLength(16);
    expect(history[0]).toEqual({ time: 5, rate: 5 });
    expect(history.at(-1)).toEqual({ time: 20, rate: 20 });
  });

  it("does not fabricate startup history", () => {
    const source = readFileSync(new URL("../OverviewTrafficChart.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("Math.random");
  });
});

describe("OverviewTrafficChart theme styles", () => {
  it("keeps classic standard colors unchanged (blue up, green down)", () => {
    const darkStyles = getTrafficChartThemeStyles("default", true);
    expect(darkStyles.up.color).toBe("#3b82f6");
    expect(darkStyles.down.color).toBe("#2f9e65");

    const lightStyles = getTrafficChartThemeStyles("default", false);
    expect(lightStyles.up.color).toBe("#3b82f6");
    expect(lightStyles.down.color).toBe("#2f9e65");
  });

  it("adapts to EVA Unit-01 palette (purple up, neon energy green down)", () => {
    const darkStyles = getTrafficChartThemeStyles("eva", true);
    expect(darkStyles.up.color).toBe("#8b5cf6");
    expect(darkStyles.down.color).toBe("#00ff66");

    const lightStyles = getTrafficChartThemeStyles("eva", false);
    expect(lightStyles.up.color).toBe("#7c3aed");
    expect(lightStyles.down.color).toBe("#059669");
  });

  it("adapts to Steins;Gate Divergence palette (amber gold up, nixie neon orange down)", () => {
    const darkStyles = getTrafficChartThemeStyles("divergence", true);
    expect(darkStyles.up.color).toBe("#facc15");
    expect(darkStyles.down.color).toBe("#ff7700");

    const lightStyles = getTrafficChartThemeStyles("divergence", false);
    expect(lightStyles.up.color).toBe("#d97706");
    expect(lightStyles.down.color).toBe("#ea580c");
  });

  it("includes css overrides for online status bar under eva and divergence palettes", () => {
    const homeCss = readFileSync(
      new URL("../../../styles/home.css", import.meta.url),
      "utf8",
    );
    expect(homeCss).toContain('.mao-progress-container[data-palette="eva"] .mao-node-block.is-online');
    expect(homeCss).toContain('.mao-progress-container[data-palette="eva"] .mao-seamless-segment.is-online');
    expect(homeCss).toContain('.mao-progress-container[data-palette="divergence"] .mao-node-block.is-online');
    expect(homeCss).toContain('.mao-progress-container[data-palette="divergence"] .mao-seamless-segment.is-online');
  });
});
