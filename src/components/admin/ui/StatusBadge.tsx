import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "online" | "offline" | "warning" | "critical" | "maintenance";

const TONE_CLASS: Record<StatusTone, string> = {
  online: "admin-status-online",
  offline: "admin-status-offline",
  warning: "admin-status-warning",
  critical: "admin-status-critical",
  maintenance: "admin-status-maintenance",
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  dot?: boolean;
  label: React.ReactNode;
}

export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ tone = "online", dot = true, label, className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn("admin-status-pill", TONE_CLASS[tone], className)}
      {...props}
    >
      {dot && <span className="admin-status-dot" />}
      {label}
    </span>
  ),
);
StatusBadge.displayName = "StatusBadge";
