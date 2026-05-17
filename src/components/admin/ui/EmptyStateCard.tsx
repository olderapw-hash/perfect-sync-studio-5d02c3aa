import * as React from "react";
import { Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateCardProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyStateCard = ({
  icon: Icon = Sparkles,
  title,
  description,
  action,
  className,
}: EmptyStateCardProps) => (
  <div className={cn("admin-empty-state", className)}>
    <span className="admin-empty-icon-wrap">
      <Icon className="h-5 w-5" />
    </span>
    <h3 className="text-sm font-extrabold uppercase tracking-wider text-foreground">
      {title}
    </h3>
    {description && (
      <p className="mt-1.5 max-w-md text-[12px] leading-relaxed text-muted-foreground">
        {description}
      </p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
