"use client";

import { Toast as RadixToast } from "radix-ui";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";

type ToastVariant = "success" | "error";

type ToastItem = {
  id: number;
  title: string;
  variant: ToastVariant;
};

type ShowToastInput = {
  title: string;
  variant?: ToastVariant;
};

type ToastContextValue = {
  showToast: (input: ShowToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;

let idCounter = 0;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(({ title, variant = "success" }: ShowToastInput) => {
    idCounter += 1;
    const id = idCounter;
    setToasts((current) => [...current, { id, title, variant }]);
  }, []);

  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      <RadixToast.Provider swipeDirection="right" duration={AUTO_DISMISS_MS}>
        {children}
        {toasts.map((toast) => (
          <RadixToast.Root
            key={toast.id}
            duration={AUTO_DISMISS_MS}
            type={toast.variant === "error" ? "foreground" : "background"}
            onOpenChange={(open) => {
              if (!open) removeToast(toast.id);
            }}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 shadow-md",
              toast.variant === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800",
            )}
          >
            <RadixToast.Description className="text-sm font-medium">
              {toast.title}
            </RadixToast.Description>
            <RadixToast.Close
              aria-label="알림 닫기"
              className="rounded p-0.5 opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 outline-none" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast는 ToastProvider 내부에서만 사용할 수 있습니다.");
  }
  return context;
};
