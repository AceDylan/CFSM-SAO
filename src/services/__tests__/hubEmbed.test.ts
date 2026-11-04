// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

const setRealtimeHostPaused = vi.fn();
const applyEmbeddedAppearance = vi.fn();
vi.mock("@/services/wsStore", () => ({ setRealtimeHostPaused }));
vi.mock("@/hooks/usePreferences", () => ({ applyEmbeddedAppearance }));

const { HUB_ORIGIN, handleHubMessage, isHubEmbed } = await import("@/services/hubEmbed");

const message = (data: unknown, overrides: Partial<MessageEvent> = {}) =>
  handleHubMessage({ source: window.parent, origin: HUB_ORIGIN, data, ...overrides } as MessageEvent);

describe("hub embed messages", () => {
  afterEach(() => vi.clearAllMocks());

  it("pauses realtime when the Hub leaves and resumes when it returns", () => {
    message({ source: "hub", type: "leave" });
    expect(setRealtimeHostPaused).toHaveBeenLastCalledWith(true);
    message({ source: "hub", type: "enter" });
    expect(setRealtimeHostPaused).toHaveBeenLastCalledWith(false);
  });

  it("follows the Hub theme and ignores unknown values", () => {
    message({ source: "hub", type: "theme", theme: "light" });
    expect(applyEmbeddedAppearance).toHaveBeenCalledWith("light");
    applyEmbeddedAppearance.mockClear();
    message({ source: "hub", type: "theme", theme: "neural" });
    expect(applyEmbeddedAppearance).not.toHaveBeenCalled();
  });

  it("ignores messages from any other origin, window, or sender", () => {
    message({ source: "hub", type: "leave" }, { origin: "https://evil.example" });
    message({ source: "hub", type: "leave" }, { source: {} as Window });
    message({ source: "other", type: "leave" });
    message(null);
    expect(setRealtimeHostPaused).not.toHaveBeenCalled();
  });

  it("detects embedding from the parent window", () => {
    expect(isHubEmbed({ parent: {} } as unknown as Window)).toBe(true);
    const top = {} as { parent?: unknown };
    top.parent = top;
    expect(isHubEmbed(top as unknown as Window)).toBe(false);
  });
});
