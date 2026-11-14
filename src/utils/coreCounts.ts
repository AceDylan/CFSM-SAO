import type { NodeInfo } from "@/types/cfsm";

export interface CoreCounts {
  online: number;
  /** 真离线：该在线却没在线的节点，星核据此报警。 */
  offline: number;
  /** 待机：允许关机的节点此刻关着，不算故障。 */
  standby: number;
}

/** 星核读数。online 状态未知（还没收到数据）的节点三项都不计。 */
export function coreCounts(
  nodes: readonly Pick<NodeInfo, "uuid" | "standby">[],
  onlineByUuid: ReadonlyMap<string, boolean | null | undefined>,
): CoreCounts {
  const counts: CoreCounts = { online: 0, offline: 0, standby: 0 };
  for (const node of nodes) {
    const state = onlineByUuid.get(node.uuid);
    if (state === true) counts.online += 1;
    else if (state === false) counts[node.standby ? "standby" : "offline"] += 1;
  }
  return counts;
}

export function coreStatusLabel(total: number, counts: CoreCounts): string {
  if (total === 0) return "SYNCING";
  if (counts.offline > 0) return `${counts.offline} OFFLINE`;
  if (counts.standby > 0) return `${counts.standby} STANDBY`;
  return "ALL ONLINE";
}
