import type { DomainRecord } from "@/types/cfsm";

/** 与后端首个到期提醒里程碑（30 天）一致。 */
export const DOMAIN_WARNING_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export type DomainLevel = "expired" | "warning" | "ok" | "unknown";

export interface DomainRow extends DomainRecord {
  days: number | null;
  level: DomainLevel;
}

/** 距到期还有几天，按浏览器本地日期算（和后台「域名」标签同一口径）；日期无效返回 null。 */
export function daysUntilExpiry(expireDate: string | null | undefined, now: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expireDate ?? "");
  if (!match) return null;
  const expire = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((expire - today) / DAY_MS);
}

function levelOf(days: number | null): DomainLevel {
  if (days === null) return "unknown";
  if (days < 0) return "expired";
  return days <= DOMAIN_WARNING_DAYS ? "warning" : "ok";
}

export function toDomainRows(domains: DomainRecord[], now: Date): DomainRow[] {
  return domains.map((domain) => {
    const days = daysUntilExpiry(domain.expire_date, now);
    return { ...domain, days, level: levelOf(days) };
  });
}

/** 卡片右上角的状态：过期优先于临期，临期优先于查询失败。 */
export function domainPillLabel(rows: DomainRow[]): { label: string; healthy: boolean } {
  const count = (test: (row: DomainRow) => boolean) => rows.filter(test).length;
  const expired = count((row) => row.level === "expired");
  if (expired > 0) return { label: `已过期 (${expired})`, healthy: false };
  const warning = count((row) => row.level === "warning");
  if (warning > 0) return { label: `临期 (${warning})`, healthy: false };
  const troubled = count((row) => row.level === "unknown" || Boolean(row.last_error));
  if (troubled > 0) return { label: `查询异常 (${troubled})`, healthy: false };
  return { label: "状态健康", healthy: true };
}

/** 余量条一格一个月、满格一年：一年后到期的域名看起来都是满的，临近才开始掉格。 */
export const DOMAIN_RUNWAY_SEGMENTS = 12;
const DAYS_PER_MONTH = 30.44;

export function domainRunway(days: number): { lit: number; label: string } {
  if (days <= 0) return { lit: 0, label: days === 0 ? "今天" : "已过期" };
  const months = Math.round(days / DAYS_PER_MONTH);
  return {
    lit: Math.min(DOMAIN_RUNWAY_SEGMENTS, Math.max(1, months)),
    label: days < DAYS_PER_MONTH ? "不足 1 个月" : `约 ${months} 个月`,
  };
}

export function formatDomainDays(days: number): { value: string; unit: string } {
  if (days < 0) return { value: String(-days), unit: "天前已过期" };
  if (days === 0) return { value: "0", unit: "今天到期" };
  return { value: String(days), unit: "天后到期" };
}
