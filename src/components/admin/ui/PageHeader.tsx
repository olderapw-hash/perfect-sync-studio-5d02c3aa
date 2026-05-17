import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  icon?: LucideIcon;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader = ({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: PageHeaderProps) => (
  <header className={cn("admin-page-header", className)}>
    {Icon && (
      <span className="admin-card-icon h-10 w-10">
        <Icon className="h-4.5 w-4.5" />
      </span>
    )}
    <div className="min-w-0 flex-1">
      {eyebrow && (
        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary">
          {eyebrow}
        </div>
      )}
      <h1 className="truncate text-lg font-extrabold tracking-tight text-foreground">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{subtitle}</p>
      )}
    </div>
    {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
  </header>
);
