import { useMemo } from "react";
import { useNodeOnlineSummaries } from "@/hooks/useNode";
import { useVisibleNodes } from "@/hooks/useVisibleNodes";

const TICK_ANGLES = Array.from({ length: 120 }, (_, i) => i * 3);

/**
 * 内嵌在 Bookmark Hub 时首页顶部的星核：和 Hub 首页反应堆同一套刻度环，
 * 也是 Hub 光圈接力的起落点（位置经 hubEmbed 的 beacon 报给 Hub）。
 * 中间只写真实读数：可见节点里在线几台、离线几台。
 */
export function HubCore() {
  const nodes = useVisibleNodes();
  const summaries = useNodeOnlineSummaries();
  const { online, offline } = useMemo(() => {
    const state = new Map(summaries.map((node) => [node.uuid, node.online]));
    return {
      online: nodes.filter((node) => state.get(node.uuid) === true).length,
      offline: nodes.filter((node) => state.get(node.uuid) === false).length,
    };
  }, [nodes, summaries]);
  const total = nodes.length;
  const summary = total === 0 ? "暂无节点数据" : `在线 ${online} 台，共 ${total} 台，离线 ${offline} 台`;

  return (
    <div
      className={`hub-core${offline > 0 ? " is-alert" : ""}`}
      data-hub-core
      role="img"
      aria-label={`服务器星核：${summary}`}
    >
      <div className="hub-core__sweep" />
      <svg className="hub-core__svg" viewBox="-200 -200 400 400" aria-hidden="true">
        <defs>
          <linearGradient id="hubCoreArc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#5ee7ff" />
            <stop offset=".6" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#f472d0" />
          </linearGradient>
        </defs>
        <g className="hub-core__ticks">
          {TICK_ANGLES.map((angle) => (
            <line
              key={angle}
              y1={angle % 30 === 0 ? -187 : -180}
              y2={-172}
              transform={`rotate(${angle})`}
              className={angle % 30 === 0 ? "is-major" : undefined}
            />
          ))}
        </g>
        <circle className="hub-core__dash" r={152} />
        <g className="hub-core__arcs" stroke="url(#hubCoreArc)">
          <circle r={128} pathLength={100} strokeDasharray="18 82" />
          <circle r={128} pathLength={100} strokeDasharray="9 91" strokeDashoffset={-40} />
          <circle r={128} pathLength={100} strokeDasharray="14 86" strokeDashoffset={-68} />
        </g>
        <g className="hub-core__orbit">
          <circle cy={-140} r={2.6} />
          <circle cy={140} r={1.6} />
        </g>
        <g className="hub-core__orbit is-slow">
          <circle cx={-164} r={2} />
        </g>
      </svg>
      <div className="hub-core__body" />
      <div className="hub-core__read" aria-hidden="true">
        <b>
          {total === 0 ? "--" : online}
          <small>/{total === 0 ? "--" : total}</small>
        </b>
        <span>{total === 0 ? "SYNCING" : offline > 0 ? `${offline} OFFLINE` : "ALL ONLINE"}</span>
      </div>
    </div>
  );
}
