import * as React from "react";
import { cn } from "@/lib/utils";
import { AdminCard } from "./AdminCard";
import { AdminCardHeader } from "./AdminCardHeader";
import type { LucideIcon } from "lucide-react";

export interface DataPanelColumn {
  key: string;
  label: React.ReactNode;
  /** CSS grid track size, e.g. "1fr", "120px", "minmax(0, 1fr)" */
  width?: string;
  align?: "left" | "right" | "center";
  className?: string;
}

export interface DataPanelRow {
  id: string | number;
  cells: Record<string, React.ReactNode>;
  className?: string;
  onClick?: () => void;
}

export interface DataPanelProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  toolbar?: React.ReactNode;
  columns: DataPanelColumn[];
  rows: DataPanelRow[];
  empty?: React.ReactNode;
  className?: string;
}

/**
 * Compact "service row" panel — used to replace giant card grids
 * with a professional, software-like list (Service | Status | Procs | Action).
 */
export const DataPanel = ({
  icon,
  title,
  subtitle,
  toolbar,
  columns,
  rows,
  empty,
  className,
}: DataPanelProps) => {
  const gridTemplate = columns.map((c) => c.width ?? "1fr").join(" ");
  return (
    <AdminCard className={cn("overflow-hidden", className)}>
      <AdminCardHeader icon={icon} title={title} subtitle={subtitle} right={toolbar} />

      {/* Column headers */}
      <div
        className="grid items-center gap-3 border-b border-border/60 bg-black/30 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {columns.map((c) => (
          <div
            key={c.key}
            className={cn(
              c.align === "right" && "text-right",
              c.align === "center" && "text-center",
              c.className,
            )}
          >
            {c.label}
          </div>
        ))}
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">
          {empty ?? "Nenhum item."}
        </div>
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            onClick={row.onClick}
            className={cn(
              "admin-data-row",
              row.onClick && "cursor-pointer",
              row.className,
            )}
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {columns.map((c) => (
              <div
                key={c.key}
                className={cn(
                  "min-w-0 truncate",
                  c.align === "right" && "text-right",
                  c.align === "center" && "text-center",
                  c.className,
                )}
              >
                {row.cells[c.key]}
              </div>
            ))}
          </div>
        ))
      )}
    </AdminCard>
  );
};
