import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { AdminCard } from "./AdminCard";
import { AdminCardHeader } from "./AdminCardHeader";
import { cn } from "@/lib/utils";

export interface AdminTableCardProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Add subtle terminal/auditoria aesthetic (mono font hint) */
  terminal?: boolean;
}

export const AdminTableCard = ({
  icon,
  title,
  subtitle,
  toolbar,
  children,
  className,
  terminal,
}: AdminTableCardProps) => (
  <AdminCard className={cn("overflow-hidden", className)}>
    <AdminCardHeader icon={icon} title={title} subtitle={subtitle} right={toolbar} />
    <div className={cn("overflow-x-auto", terminal && "font-mono text-[12px]")}>
      {children}
    </div>
  </AdminCard>
);
