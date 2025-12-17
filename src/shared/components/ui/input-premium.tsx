import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", icon, error, ...props }, ref) => {
    return (
      <div className={cn(
        "relative flex items-center gap-3 bg-[var(--bg)] border rounded-[var(--radius-pill)] px-4 py-2.5 transition-all duration-150 focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:ring-offset-1",
        error ? "border-[var(--danger)]" : "border-[var(--border)]",
        className
      )}>
        {icon && (
          <div className="flex-shrink-0 text-[var(--fg-400)]">
            {icon}
          </div>
        )}
        <input
          type={type}
          className="w-full bg-transparent outline-none text-sm text-[var(--fg-900)] placeholder-[var(--fg-400)]"
          ref={ref}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = "Input";

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ placeholder = "Rechercher…", className, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="search"
        placeholder={placeholder}
        icon={<Search size={16} />}
        className={className}
        {...props}
      />
    );
  }
);

SearchInput.displayName = "SearchInput";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "w-full bg-[var(--bg)] border rounded-[var(--radius)] px-4 py-3 text-sm text-[var(--fg-900)] placeholder-[var(--fg-400)] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1 resize-none",
          error ? "border-[var(--danger)]" : "border-[var(--border)]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";