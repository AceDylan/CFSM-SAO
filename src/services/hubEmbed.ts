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

// Hub 的光圈接力要落到星核上：它问 {source:"hub", type:"beacon", id, wait}，这里回星核在本框内的
// 圆心和刻度环半径；星核不在屏幕上（开着详情页、往下滚走了）就回 none，Hub 改落到舞台中央。
const BEACON_WAIT_MAX_MS = 1500;
const CORE_RING_RATIO = 184 / 400; // 刻度环半径 184，占 400×400 的画布

type HubBeacon = { x: number; y: number; r: number };

export function findHubCore(doc: Pick<Document, "querySelector"> = document, win: Pick<Window, "innerWidth" | "innerHeight"> = window): HubBeacon | null {
  const box = doc.querySelector("[data-hub-core]")?.getBoundingClientRect();
  if (!box?.width) return null;
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  if (x < 0 || y < 0 || x > win.innerWidth || y > win.innerHeight) return null;
  return { x: Math.round(x), y: Math.round(y), r: Math.round(box.width * CORE_RING_RATIO) };
}

// 冷进入时 Hub 一听到 ready 就问：首页可能还没画出星核，等一小会儿；别的页面永远等不到，当场回 none。
const onHomeRoute = () => /^#?\/?(\?|$)/.test(window.location.hash);

async function answerBeacon(id: number, wait: unknown, origin: string) {
  const maxWait = typeof wait === "number" && Number.isFinite(wait) ? Math.min(Math.max(wait, 0), BEACON_WAIT_MAX_MS) : 0;
  const until = Date.now() + maxWait;
  let core = findHubCore();
  while (!core && onHomeRoute() && Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    core = findHubCore();
  }
  window.parent.postMessage({ source: "cfsm", type: "beacon", id, ...(core ?? { none: true }) }, origin);
}

export function handleHubMessage(event: Pick<MessageEvent, "source" | "origin" | "data">) {
  if (event.source !== window.parent || event.origin !== HUB_ORIGIN) return;
  const data = event.data as { source?: unknown; type?: unknown; theme?: unknown; id?: unknown; wait?: unknown } | null;
  if (!data || typeof data !== "object" || data.source !== "hub") return;
  if (data.type === "leave") setRealtimeHostPaused(true);
  else if (data.type === "enter") setRealtimeHostPaused(false);
  else if (data.type === "theme") {
    const theme = asHubTheme(data.theme);
    if (theme) applyHubTheme(theme);
  } else if (data.type === "beacon" && Number.isSafeInteger(data.id)) {
    void answerBeacon(data.id as number, data.wait, event.origin);
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
