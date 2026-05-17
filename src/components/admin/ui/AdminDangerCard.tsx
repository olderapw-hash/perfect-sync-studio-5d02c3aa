import * as React from "react";
import { AlertTriangle, type LucideIcon } from "lucide-react";
import { AdminCard } from "./AdminCard";
import { AdminCardHeader } from "./AdminCardHeader";

export interface AdminDangerCardProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  warning?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}

export const AdminDangerCard = ({
  icon = AlertTriangle,
  title,
  subtitle,
  warning,
  children,
  actions,
}: AdminDangerCardProps) => (
  <AdminCard variant="danger">
    <AdminCardHeader icon={icon} title={title} subtitle={subtitle} danger />
    <div className="admin-card-body space-y-3">
      {warning && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-[12px] text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{warning}</span>
        </div>
      )}
      {children}
    </div>
    {actions && <div className="admin-card-footer justify-end gap-2">{actions}</div>}
  </AdminCard>
);
