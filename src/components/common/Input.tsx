"use client";

import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/utils/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError = false, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400",
          "focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600",
          "disabled:bg-gray-50 disabled:text-gray-400",
          hasError && "border-red-500 focus:ring-red-500 focus:border-red-500",
          className,
        )}
        aria-invalid={hasError || undefined}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
