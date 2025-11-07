import React from 'react';
import { cn } from '@/lib/utils';

export interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive?: boolean;
  };
}

export const StatTile = React.forwardRef<HTMLDivElement, StatTileProps>(
  ({ className, icon, title, value, subtitle, trend, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow-1)] p-6 transition-all duration-150 hover:shadow-lg",
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[var(--accent-50)] text-[var(--accent-600)] rounded-full flex items-center justify-center">
                {icon}
              </div>
              <h3 className="text-sm font-medium text-[var(--fg-600)]">{title}</h3>
            </div>
            
            <div className="space-y-1">
              <div className="text-2xl font-bold text-[var(--fg-900)]">{value}</div>
              {subtitle && (
                <p className="text-sm text-[var(--fg-600)]">{subtitle}</p>
              )}
            </div>
          </div>
          
          {trend && (
            <div className={cn(
              "text-sm font-medium",
              trend.isPositive ? "text-[var(--accent)]" : "text-[var(--danger)]"
            )}>
              {trend.isPositive ? '+' : ''}{trend.value}%
            </div>
          )}
        </div>
      </div>
    );
  }
);

StatTile.displayName = "StatTile";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center text-center py-12 px-6",
          className
        )}
        {...props}
      >
        <div className="w-16 h-16 bg-[var(--bg-subtle)] text-[var(--fg-400)] rounded-full flex items-center justify-center mb-4">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-[var(--fg-900)] mb-2">{title}</h3>
        {description && (
          <p className="text-[var(--fg-600)] mb-6 max-w-md">{description}</p>
        )}
        {action && action}
      </div>
    );
  }
);

EmptyState.displayName = "EmptyState";

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[var(--bg-subtle)]",
        className
      )}
    />
  );
};
