"use client";

import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: string;
  message: string;
  action?: ReactNode;
  variant?: "empty" | "error" | "locked";
}

/**
 * Presentational empty / loading-adjacent state.
 * Used for empty feeds, auth gates, and soft error surfaces.
 */
export function EmptyState({
  icon = "💬",
  message,
  action,
  variant = "empty",
}: EmptyStateProps) {
  return (
    <div className={`feed-state feed-state--${variant}`}>
      <span className="feed-state-icon" aria-hidden="true">
        {icon}
      </span>
      <p className="empty-primary">{message}</p>
      {action}
    </div>
  );
}
