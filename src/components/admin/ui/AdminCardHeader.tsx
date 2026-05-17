import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AdminCardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right slot — typically a badge, status pill or icon action */
  right?: React.ReactNode;
  /** Danger styling for the icon chip */
  danger?: boolean;
}

export const AdminCardHeader = React.forwardRef<HTMLDivElement, AdminCardHeaderProps>(
  ({ icon: Icon, title, subtitle, right, danger, className, ...props }, ref) => (
    <div ref={ref} className={cn("admin-card-header", className)} {...props}>
      {Icon && (
        <span className={cn("admin-card-icon", danger && "admin-card-icon-danger")}>
          <Icon className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="admin-card-title truncate">{title}</div>
        {subtitle && <div className="admin-card-subtitle truncate">{subtitle}</div>}
      </div>
      {right && <div className="ml-auto flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  ),
);
AdminCardHeader.displayName = "AdminCardHeader";
