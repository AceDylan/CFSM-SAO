// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

const setRealtimeHostPaused = vi.fn();
const applyEmbeddedAppearance = vi.fn();
vi.mock("@/services/wsStore", () => ({ setRealtimeHostPaused }));
vi.mock("@/hooks/usePreferences", () => ({ applyEmbeddedAppearance }));

const { HUB_ORIGIN, findHubCore, handleHubMessage, isHubEmbed } = await import("@/services/hubEmbed");

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

  describe("beacon", () => {
    const view = { innerWidth: 1000, innerHeight: 800 };
    const docWith = (box: Partial<DOMRect> | null) =>
      ({ querySelector: () => (box ? { getBoundingClientRect: () => box } : null) }) as unknown as Document;

    afterEach(() => {
      vi.restoreAllMocks();
      document.body.innerHTML = "";
      window.location.hash = "";
    });

    const addCore = () => {
      const core = document.createElement("div");
      core.setAttribute("data-hub-core", "");
      core.getBoundingClientRect = () => ({ left: 400, top: 20, width: 200, height: 200 }) as DOMRect;
      document.body.append(core);
    };

    it("reports the ring around the core in frame pixels", () => {
      expect(findHubCore(docWith({ left: 400, top: 20, width: 200, height: 200 }), view)).toEqual({ x: 500, y: 120, r: 92 });
    });

    it("reports nothing when the core is missing, hidden, or scrolled away", () => {
      expect(findHubCore(docWith(null), view)).toBeNull();
      expect(findHubCore(docWith({ left: 0, top: 0, width: 0, height: 0 }), view)).toBeNull();
      expect(findHubCore(docWith({ left: 400, top: -180, width: 200, height: 200 }), view)).toBeNull();
    });

    it("answers the Hub with the core's position", async () => {
      addCore();
      const post = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
      message({ source: "hub", type: "beacon", id: 7, wait: 0 });
      await vi.waitFor(() => expect(post).toHaveBeenCalled());
      expect(post).toHaveBeenCalledWith(expect.objectContaining({ source: "cfsm", type: "beacon", id: 7, r: 92 }), HUB_ORIGIN);
    });

    it("waits for the core on the home route up to the Hub's limit", async () => {
      const post = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
      message({ source: "hub", type: "beacon", id: 8, wait: 1000 });
      setTimeout(addCore, 60);
      await vi.waitFor(() => expect(post).toHaveBeenCalled());
      expect(post).toHaveBeenCalledWith(expect.objectContaining({ id: 8, r: 92 }), HUB_ORIGIN);
    });

    it("answers none at once on other routes", async () => {
      window.location.hash = "#/server/abc";
      const post = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
      message({ source: "hub", type: "beacon", id: 9, wait: 1000 });
      await vi.waitFor(() => expect(post).toHaveBeenCalled(), { timeout: 40 });
      expect(post).toHaveBeenCalledWith({ source: "cfsm", type: "beacon", id: 9, none: true }, HUB_ORIGIN);
    });

    it("ignores questions without a usable id or from another origin", async () => {
      addCore();
      const post = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
      message({ source: "hub", type: "beacon", id: "7" });
      message({ source: "hub", type: "beacon", id: 7 }, { origin: "https://evil.example" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(post).not.toHaveBeenCalled();
    });
  });

  it("detects embedding from the parent window", () => {
    expect(isHubEmbed({ parent: {} } as unknown as Window)).toBe(true);
    const top = {} as { parent?: unknown };
    top.parent = top;
    expect(isHubEmbed(top as unknown as Window)).toBe(false);
  });
});
