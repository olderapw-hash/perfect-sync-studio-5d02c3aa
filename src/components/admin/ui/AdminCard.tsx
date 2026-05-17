import * as React from "react";
import { cn } from "@/lib/utils";

export type AdminCardVariant = "default" | "elevated" | "danger" | "success" | "gold";

export interface AdminCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AdminCardVariant;
  interactive?: boolean;
  hover?: boolean;
}

/**
 * Base premium card for the /admin area.
 * Visual only — no logic, no data fetching.
 */
export const AdminCard = React.forwardRef<HTMLDivElement, AdminCardProps>(
  ({ className, variant = "default", interactive, hover, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "admin-card",
        variant === "elevated" && "admin-card-elevated",
        variant === "danger" && "admin-card-danger",
        variant === "success" && "admin-card-success",
        variant === "gold" && "admin-card-gold",
        interactive && "admin-card-interactive admin-card-hover",
        !interactive && hover && "admin-card-hover",
        className,
      )}
      {...props}
    />
  ),
);
AdminCard.displayName = "AdminCard";

export const AdminCardBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { flush?: boolean }
>(({ className, flush, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(flush ? "admin-card-body-flush" : "admin-card-body", className)}
    {...props}
  />
));
AdminCardBody.displayName = "AdminCardBody";

export const AdminCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("admin-card-footer", className)} {...props} />
));
AdminCardFooter.displayName = "AdminCardFooter";
