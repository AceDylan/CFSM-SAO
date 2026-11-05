import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getDomains } from "@/services/api";
import {
  DOMAIN_RUNWAY_SEGMENTS,
  domainPillLabel,
  domainRunway,
  formatDomainDays,
  toDomainRows,
  type DomainRow,
} from "@/utils/domainWatch";

const MAX_ROWS = 3;
// 后端每小时才刷新一批，首页不用追。
const DOMAIN_STALE_MS = 10 * 60 * 1000;

function DomainListRow({ row }: { row: DomainRow }) {
  const meta = row.last_error ? "查询失败，显示上次结果" : row.registrar;
  return (
    <li className="domain-watch-row" data-level={row.level} title={row.last_error || undefined}>
      <span className="domain-watch-row-main">
        <span className="domain-watch-name" title={row.name}>{row.name}</span>
        {row.note && <span className="domain-watch-note" title={row.note}>{row.note}</span>}
      </span>
      <span className="domain-watch-row-sub">
        <span className="domain-watch-meta">{meta || "—"}</span>
        <span className="domain-watch-date">{row.expire_date || "到期日未知"}</span>
      </span>
    </li>
  );
}

/** 域名到期卡片：最近到期的那个放大，下面列最近的几个，完整列表和增删改在后台「域名」标签。 */
export function DomainWatchCard() {
  const { data: me } = useAuth();
  const loggedIn = Boolean(me?.logged_in);
  const query = useQuery({
    queryKey: ["domains"],
    queryFn: ({ signal }) => getDomains({ signal }),
    enabled: loggedIn,
    staleTime: DOMAIN_STALE_MS,
    retry: 1,
  });
  const rows = useMemo(() => (query.data ? toDomainRows(query.data, new Date()) : []), [query.data]);
  const nearest = rows.find((row) => row.days !== null);
  const nearestDays = nearest?.days != null ? formatDomainDays(nearest.days) : null;
  const runway = nearest?.days != null ? domainRunway(nearest.days) : null;
  const pill = rows.length > 0 ? domainPillLabel(rows) : null;
  const hiddenCount = rows.length - MAX_ROWS;

  const placeholder = !me
    ? "正在读取…"
    : !loggedIn
      ? "登录后可见"
      : query.isError
        ? "域名数据暂时无法读取，稍后自动重试"
        : query.isPending
          ? "正在读取…"
          : "还没有监控的域名，可在后台「域名」标签添加";

  return (
    <div className="mao-progress-container domain-watch">
      <div className="mao-progress-head">
        <div className="mao-progress-title-wrap">
          <h3 className="mao-progress-title">
            <Globe size={17} className="text-(--text-primary)" />
            <span>域名监控</span>
          </h3>
          <p className="mao-progress-subtitle">注册到期与续费提醒</p>
        </div>
        {pill && (
          <span className={`mao-status-pill ${pill.healthy ? "is-healthy" : "is-warning"}`}>
            <span className="mao-status-dot" />
            {pill.label}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="domain-watch-empty">{placeholder}</div>
      ) : (
        <>
          <div className="mao-progress-section">
            <div className="mao-progress-section-header">
              <div className="flex items-baseline gap-1.5">
                <span className="mao-progress-big-num">{nearestDays?.value ?? "--"}</span>
                <span className="mao-progress-unit-label">{nearestDays?.unit ?? "到期日未知"}</span>
              </div>
              <div className="mao-progress-tag-box">
                <span className="mao-progress-tag-label">监控域名</span>
                <span className="mao-progress-tag-val">{rows.length} 个</span>
              </div>
            </div>
            {nearest && runway && (
              <>
                <div className="mao-node-blocks" role="presentation">
                  {Array.from({ length: DOMAIN_RUNWAY_SEGMENTS }, (_, i) => (
                    <span
                      key={i}
                      className={`mao-node-block ${
                        i >= runway.lit ? "is-unknown" : nearest.level === "ok" ? "is-online" : "is-offline"
                      }`}
                    />
                  ))}
                </div>
                <div className="mao-progress-section-footer">
                  <span className="domain-watch-nearest" title={nearest.name}>最近到期 {nearest.name}</span>
                  <span>{runway.label}</span>
                </div>
              </>
            )}
          </div>
          <ul className="domain-watch-list">
            {rows.slice(0, MAX_ROWS).map((row) => (
              <DomainListRow key={row.name} row={row} />
            ))}
            {hiddenCount > 0 && <li className="domain-watch-more">另有 {hiddenCount} 个到期更晚</li>}
          </ul>
        </>
      )}
    </div>
  );
}
