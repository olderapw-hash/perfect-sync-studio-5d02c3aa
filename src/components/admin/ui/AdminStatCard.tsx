import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminCard } from "./AdminCard";

export type StatTone = "neutral" | "ok" | "warn" | "danger" | "gold";

export interface AdminStatCardProps {
  icon?: LucideIcon;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  trend?: "up" | "down" | "flat";
  trendValue?: React.ReactNode;
  tone?: StatTone;
  className?: string;
  footer?: React.ReactNode;
}

const TONE_ICON: Record<StatTone, string> = {
  neutral: "text-bronze",
  ok: "text-[hsl(160_50%_60%)]",
  warn: "text-[hsl(40_70%_65%)]",
  danger: "text-[hsl(0_70%_65%)]",
  gold: "text-bronze",
};

const TREND_MAP = {
  up: { Icon: TrendingUp, cls: "text-[hsl(160_50%_60%)]" },
  down: { Icon: TrendingDown, cls: "text-[hsl(0_70%_65%)]" },
  flat: { Icon: Minus, cls: "text-muted-foreground" },
} as const;

export const AdminStatCard = ({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  trendValue,
  tone = "neutral",
  className,
  footer,
}: AdminStatCardProps) => {
  const TrendIcon = trend ? TREND_MAP[trend].Icon : null;
  const trendCls = trend ? TREND_MAP[trend].cls : "";

  return (
    <AdminCard className={cn("overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="admin-stat-label truncate">{label}</div>
          <div className="mt-2 admin-stat-number truncate">{value}</div>
          {sub && (
            <div className="mt-1.5 truncate text-[11px] text-muted-foreground">{sub}</div>
          )}
        </div>
        {Icon && (
          <span className={cn("admin-card-icon", TONE_ICON[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      {(trend || footer) && (
        <div className="flex items-center justify-between border-t border-border/50 bg-black/30 px-4 py-1.5 text-[11px]">
          {trend && TrendIcon && (
            <span className={cn("inline-flex items-center gap-1 font-semibold", trendCls)}>
              <TrendIcon className="h-3 w-3" />
              {trendValue}
            </span>
          )}
          {footer && <span className="text-muted-foreground">{footer}</span>}
        </div>
      )}
    </AdminCard>
  );
};
