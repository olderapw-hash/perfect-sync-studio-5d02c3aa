import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { AdminCard } from "./AdminCard";
import { AdminCardHeader } from "./AdminCardHeader";

export interface AdminActionCardProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  /** Footer area for action buttons */
  actions?: React.ReactNode;
}

export const AdminActionCard = ({
  icon,
  title,
  subtitle,
  badge,
  children,
  actions,
}: AdminActionCardProps) => (
  <AdminCard hover>
    <AdminCardHeader icon={icon} title={title} subtitle={subtitle} right={badge} />
    {children && <div className="admin-card-body">{children}</div>}
    {actions && <div className="admin-card-footer justify-end gap-2">{actions}</div>}
  </AdminCard>
);
