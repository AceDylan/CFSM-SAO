import { applyEmbeddedAppearance } from "@/hooks/usePreferences";
import { setRealtimeHostPaused } from "@/services/wsStore";

/** 唯一允许嵌入本站的 Bookmark Hub；后端用 frame-ancestors 强制同一个来源。 */
export const HUB_ORIGIN = "https://best.acedylan.us:5526";

const THEME_QUERY_KEY = "hub_theme";
const THEME_STORAGE_KEY = "cfsm-sao:hub-theme";

type HubTheme = "dark" | "light";

function asHubTheme(value: unknown): HubTheme | null {
  return value === "dark" || value === "light" ? value : null;
}

export function isHubEmbed(win: Window = window): boolean {
  return win.parent !== win;
}

function postToHub(type: "ready" | "reauth") {
  if (!isHubEmbed()) return;
  window.parent.postMessage({ source: "cfsm", type }, HUB_ORIGIN);
}

/** 页面可以看了：Hub 收到后撤掉加载层。 */
export const notifyHubReady = () => postToHub("ready");

/** 框里没有登录态（会话过期、退出了后台）：请 Hub 重新签票。 */
export const requestHubReauth = () => postToHub("reauth");

function applyHubTheme(theme: HubTheme) {
  try {
    sessionStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 存不下只影响框内跳转后的第一帧
  }
  applyEmbeddedAppearance(theme);
}

export function handleHubMessage(event: Pick<MessageEvent, "source" | "origin" | "data">) {
  if (event.source !== window.parent || event.origin !== HUB_ORIGIN) return;
  const data = event.data as { source?: unknown; type?: unknown; theme?: unknown } | null;
  if (!data || typeof data !== "object" || data.source !== "hub") return;
  if (data.type === "leave") setRealtimeHostPaused(true);
  else if (data.type === "enter") setRealtimeHostPaused(false);
  else if (data.type === "theme") {
    const theme = asHubTheme(data.theme);
    if (theme) applyHubTheme(theme);
  }
}

function initialTheme(): HubTheme | null {
  const fromQuery = asHubTheme(new URLSearchParams(window.location.search).get(THEME_QUERY_KEY));
  if (fromQuery) return fromQuery;
  try {
    return asHubTheme(sessionStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** 必须在首次渲染前调用：决定第一帧有没有顶栏、是深色还是浅色。 */
export function initHubEmbed() {
  if (!isHubEmbed()) return;
  document.documentElement.dataset.embed = "hub";
  window.addEventListener("message", handleHubMessage);
  const theme = initialTheme();
  if (theme) applyHubTheme(theme);
}
