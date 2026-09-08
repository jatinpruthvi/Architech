"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2, Check } from "lucide-react";

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  success?: boolean;
  children: ReactNode;
};

/** Shared async action primitive: stable geometry, accessible status, and one
 * motion language for forms, saves, uploads, and broker actions. */
export default function ActionButton({ busy = false, success = false, disabled, children, className = "", ...props }: ActionButtonProps) {
  const isDisabled = disabled || busy;
  return (
    <button
      {...props}
      disabled={isDisabled}
      aria-busy={busy || undefined}
      className={`action-button motion-press inline-flex items-center justify-center gap-2 ${className}`}
    >
      {busy ? <Loader2 size={14} className="action-button-spinner" aria-hidden="true" /> : success ? <Check size={14} aria-hidden="true" /> : null}
      <span>{children}</span>
      <span className="sr-only" aria-live="polite">{busy ? "Working" : success ? "Completed" : ""}</span>
    </button>
  );
}
