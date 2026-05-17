import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { AdminCard } from "./AdminCard";
import { AdminCardHeader } from "./AdminCardHeader";
import { StatusBadge, type StatusTone } from "./StatusBadge";

export interface AdminStatusCardProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  tone?: StatusTone;
  statusLabel: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

export const AdminStatusCard = ({
  icon,
  title,
  subtitle,
  tone = "online",
  statusLabel,
  children,
  footer,
}: AdminStatusCardProps) => (
  <AdminCard>
    <AdminCardHeader
      icon={icon}
      title={title}
      subtitle={subtitle}
      right={<StatusBadge tone={tone} label={statusLabel} />}
    />
    {children && <div className="admin-card-body">{children}</div>}
    {footer && <div className="admin-card-footer">{footer}</div>}
  </AdminCard>
);
