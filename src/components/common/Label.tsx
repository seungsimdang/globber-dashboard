"use client";

import { Label as RadixLabel } from "radix-ui";
import { type ComponentPropsWithoutRef, forwardRef } from "react";
import { cn } from "@/utils/cn";

type LabelProps = ComponentPropsWithoutRef<typeof RadixLabel.Root> & {
  required?: boolean;
};

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required = false, children, ...props }, ref) => {
    return (
      <RadixLabel.Root
        ref={ref}
        className={cn("mb-1 block text-sm font-medium text-gray-700", className)}
        {...props}
      >
        {children}
        {required ? (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        ) : null}
      </RadixLabel.Root>
    );
  },
);
Label.displayName = "Label";
