"use client";

import { type ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/common/Toast";
import { ApiError } from "@/lib/apiClient";

// 4xx와 서버 설정 오류(500)는 재시도해도 같은 결과, 그 외 최대 2회 재시도
const retryQuery = (failureCount: number, error: Error) => {
  if (error instanceof ApiError && ((error.status >= 400 && error.status < 500) || error.status === 500)) {
    return false;
  }

  return failureCount < 2;
};

export const Providers = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: retryQuery } } }));

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
};
