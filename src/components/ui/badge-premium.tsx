import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', size = 'sm', children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-medium transition-colors rounded-full";
    
    const variants = {
      default: "bg-[var(--fg-900)] text-white",
      secondary: "bg-[var(--bg-subtle)] text-[var(--fg-700)] border border-[var(--border)]",
      success: "bg-[var(--accent-50)] text-[var(--accent-600)] border border-[var(--accent)]",
      warning: "bg-orange-50 text-orange-700 border border-orange-200",
      danger: "bg-red-50 text-red-700 border border-red-200",
      info: "bg-blue-50 text-blue-700 border border-blue-200"
    };

    const sizes = {
      sm: "px-2 py-0.5 text-xs min-h-[20px]",
      md: "px-3 py-1 text-sm min-h-[24px]"
    };

    return (
      <div
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Badge.displayName = "Badge";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'selected';
  removable?: boolean;
  onRemove?: () => void;
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, variant = 'default', removable, onRemove, children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center gap-1.5 font-medium transition-all duration-150 rounded-[var(--radius-pill)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1";
    
    const variants = {
      default: "bg-[var(--bg-subtle)] text-[var(--fg-700)] border border-[var(--border)] hover:bg-[var(--bg)] hover:border-[var(--accent)]",
      selected: "bg-[var(--accent-50)] text-[var(--accent-600)] border border-[var(--accent)]"
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          "px-3 py-1.5 text-sm min-h-[32px]",
          className
        )}
        {...props}
      >
        {children}
        {removable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.();
            }}
            className="ml-1 hover:bg-black hover:bg-opacity-10 rounded-full p-0.5 transition-colors"
            type="button"
          >
            ×
          </button>
        )}
      </button>
    );
  }
);

Chip.displayName = "Chip";