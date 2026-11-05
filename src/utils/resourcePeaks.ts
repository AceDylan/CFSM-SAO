/** 与后端内存告警的 90% 同档；75% 起先提个醒。 */
const WARNING_PCT = 75;
const CRITICAL_PCT = 90;

export type ResourceLevel = "ok" | "warning" | "critical";

export interface ResourcePeak {
  key: "cpu" | "ram" | "disk";
  label: string;
  uuid: string;
  pct: number;
  level: ResourceLevel;
}

export interface ResourceSample {
  uuid: string;
  online: boolean | null;
  cpuPct: number;
  ramUsed: number;
  ramTotal: number;
  diskUsed: number;
  diskTotal: number;
}

const RESOURCES: Array<{
  key: ResourcePeak["key"];
  label: string;
  read: (node: ResourceSample) => number | null;
}> = [
  { key: "cpu", label: "CPU", read: (node) => node.cpuPct },
  { key: "ram", label: "内存", read: (node) => (node.ramTotal > 0 ? (node.ramUsed / node.ramTotal) * 100 : null) },
  { key: "disk", label: "硬盘", read: (node) => (node.diskTotal > 0 ? (node.diskUsed / node.diskTotal) * 100 : null) },
];

function levelOf(pct: number): ResourceLevel {
  if (pct >= CRITICAL_PCT) return "critical";
  return pct >= WARNING_PCT ? "warning" : "ok";
}

/** 每项资源占用最高的一台。离线节点的读数是旧的，不参与；没有有效读数的资源不返回。 */
export function findResourcePeaks(nodes: ResourceSample[]): ResourcePeak[] {
  const online = nodes.filter((node) => node.online === true);
  return RESOURCES.flatMap(({ key, label, read }) => {
    let peak: { uuid: string; pct: number } | null = null;
    for (const node of online) {
      const pct = read(node);
      if (pct === null || !Number.isFinite(pct)) continue;
      if (!peak || pct > peak.pct) peak = { uuid: node.uuid, pct };
    }
    if (!peak) return [];
    const pct = Math.min(100, Math.max(0, peak.pct));
    return [{ key, label, uuid: peak.uuid, pct, level: levelOf(pct) }];
  });
}
