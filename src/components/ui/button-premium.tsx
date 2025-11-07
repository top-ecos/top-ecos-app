import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', children, disabled, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
    
    const variants = {
      primary: "bg-[var(--accent)] text-white hover:bg-green-500 active:bg-green-500 shadow-sm",
      secondary: "bg-[var(--bg)] text-[var(--fg-900)] border border-[var(--border)] hover:bg-[var(--bg-subtle)] active:bg-[var(--bg-subtle)] shadow-sm",
      ghost: "bg-transparent text[var(--fg-900)] hover:bg-[var(--bg-subtle)] active:bg-[var(--bg-subtle)]"
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm rounded-[var(--radius-pill)] min-h-[36px]",
      md: "px-4 py-2 text-sm rounded-[var(--radius-pill)] min-h-[40px]",
      lg: "px-6 py-3 text-base rounded-[var(--radius-pill)] min-h-[44px]"
    };

    return (
      <button
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";