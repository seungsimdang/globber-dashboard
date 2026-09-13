"use client";

import { AlertDialog as RadixAlertDialog } from "radix-ui";
import { type ReactNode } from "react";
import { cn } from "@/utils/cn";

type AlertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * 파괴적 액션 확인용 다이얼로그 (Radix AlertDialog 기반, role="alertdialog").
 * 일반 Dialog와 달리 배경 콘텐츠와의 상호작용을 더 강하게 차단해 삭제 등 확인이
 * 반드시 필요한 액션에 사용한다.
 */
export const AlertDialog = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: AlertDialogProps) => {
  return (
    <RadixAlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixAlertDialog.Portal>
        <RadixAlertDialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <RadixAlertDialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-lg",
            className,
          )}
        >
          <RadixAlertDialog.Title className="text-lg font-semibold text-gray-900">
            {title}
          </RadixAlertDialog.Title>
          {description ? (
            <RadixAlertDialog.Description className="mt-2 text-sm text-gray-600">
              {description}
            </RadixAlertDialog.Description>
          ) : null}
          <div className="mt-6">{children}</div>
        </RadixAlertDialog.Content>
      </RadixAlertDialog.Portal>
    </RadixAlertDialog.Root>
  );
};

export const AlertDialogCancel = RadixAlertDialog.Cancel;
export const AlertDialogAction = RadixAlertDialog.Action;
