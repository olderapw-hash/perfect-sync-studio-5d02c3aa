import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { AdminCard } from "./AdminCard";
import { AdminCardHeader } from "./AdminCardHeader";
import { cn } from "@/lib/utils";

export interface AdminSectionCardProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export const AdminSectionCard = ({
  icon,
  title,
  subtitle,
  badge,
  children,
  footer,
  className,
  bodyClassName,
}: AdminSectionCardProps) => (
  <AdminCard variant="elevated" className={className}>
    <AdminCardHeader icon={icon} title={title} subtitle={subtitle} right={badge} />
    <div className={cn("admin-card-body space-y-4", bodyClassName)}>{children}</div>
    {footer && <div className="admin-card-footer">{footer}</div>}
  </AdminCard>
);

/** Alias for semantic clarity in pages */
export const SectionCard = AdminSectionCard;
