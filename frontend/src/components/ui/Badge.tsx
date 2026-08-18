import * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "secondary";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide capitalize",
        {
          "bg-gray-900 text-white dark:bg-neutral-100 dark:text-neutral-900": variant === "default",
          "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400": variant === "success",
          "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400": variant === "warning",
          "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400": variant === "danger",
          "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400": variant === "info",
          "bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300": variant === "secondary",
        },
        className
      )}
      {...props}
    />
  );
}
