import { useMemo } from "react";
import { findResourcePeaks, type ResourceSample } from "@/utils/resourcePeaks";

/** 资源水位：平均值和总量会盖住单台快满的机器，所以每项只看最高的那一台。 */
export function ResourcePeaks({
  nodes,
  nameByUuid,
}: {
  nodes: ResourceSample[];
  nameByUuid: Map<string, string>;
}) {
  const peaks = useMemo(() => findResourcePeaks(nodes), [nodes]);

  return (
    <div className="mao-progress-section">
      <div className="mao-progress-section-header">
        <span className="mao-progress-unit-label">资源水位</span>
        <span className="mao-progress-tag-label">每项最高的一台</span>
      </div>
      {peaks.length === 0 ? (
        <span className="mao-progress-tag-label">暂无在线节点读数</span>
      ) : (
        <div className="resource-peaks-rows">
          {peaks.map((peak) => {
            const name = nameByUuid.get(peak.uuid) ?? peak.uuid;
            return (
              <div key={peak.key} className="resource-peak" data-level={peak.level}>
                <span>{peak.label}</span>
                <span className="resource-peak-bar" aria-hidden="true">
                  <span className="resource-peak-fill" style={{ width: `${peak.pct}%` }} />
                </span>
                <span className="resource-peak-name" title={name}>{name}</span>
                <span className="resource-peak-pct">{peak.pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
