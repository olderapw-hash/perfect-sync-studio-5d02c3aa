import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ActionButtonTone = "primary" | "ghost" | "danger" | "gold" | "neutral";

export interface ActionButtonProps extends Omit<ButtonProps, "variant"> {
  tone?: ActionButtonTone;
}

/**
 * Thin wrapper around shadcn <Button> with admin-specific tones.
 * Doesn't change underlying behavior — only visual mapping.
 */
export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ tone = "primary", className, ...props }, ref) => {
    const cls = {
      primary: "",
      ghost: "border border-border/60 bg-card/60 hover:border-primary/50 text-foreground",
      danger:
        "bg-destructive/15 border border-destructive/50 text-destructive hover:bg-destructive/25 hover:text-destructive",
      gold: "bg-[hsl(40_48%_28%)]/40 border border-[hsl(40_48%_56%)]/40 text-[hsl(40_60%_70%)] hover:bg-[hsl(40_48%_30%)]/60",
      neutral: "bg-muted/40 border border-border/50 text-muted-foreground hover:text-foreground",
    }[tone];

    const variant: ButtonProps["variant"] =
      tone === "ghost" || tone === "neutral" || tone === "danger" || tone === "gold"
        ? "outline"
        : "default";

    return (
      <Button
        ref={ref}
        variant={variant}
        className={cn("h-8 gap-1.5 text-xs font-semibold", cls, className)}
        {...props}
      />
    );
  },
);
ActionButton.displayName = "ActionButton";
