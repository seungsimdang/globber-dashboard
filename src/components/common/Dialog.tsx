"use client";

import { Dialog as RadixDialog } from "radix-ui";
import { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

/**
 * 접근성 있는 모달 다이얼로그 (Radix Dialog 기반).
 * 오픈 시 포커스 트랩, Esc/배경 클릭으로 닫기, 닫힘 시 트리거로 포커스 복귀를 기본 제공한다.
 */
export const Dialog = ({ open, onOpenChange, title, description, children, className }: DialogProps) => {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <RadixDialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-lg",
            "max-h-[90vh] overflow-y-auto",
            className,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <RadixDialog.Title className="text-lg font-semibold text-gray-900">
                {title}
              </RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 text-sm text-gray-500">
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close asChild>
              <button
                type="button"
                aria-label="닫기"
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};

export const DialogClose = (props: ComponentPropsWithoutRef<typeof RadixDialog.Close>) => (
  <RadixDialog.Close {...props} />
);
