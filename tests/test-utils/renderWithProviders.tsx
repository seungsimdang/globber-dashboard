import { type ReactElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { ToastProvider } from "@/components/common/Toast";

/**
 * 테스트용 QueryClient. 재시도를 끄고 캐시를 즉시 gc해 테스트 간 상태가 새지 않게 한다.
 */
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

type WrapperProps = {
  children: ReactNode;
  queryClient?: QueryClient;
};

export const AllProviders = ({ children, queryClient }: WrapperProps) => {
  const client = queryClient ?? createTestQueryClient();

  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
};

/**
 * `QueryClientProvider` + `ToastProvider`를 포함한 렌더 헬퍼.
 * `useCities`, `useCityMutations`, `useToast`를 사용하는 컴포넌트 테스트에 사용한다.
 */
export const renderWithProviders = (ui: ReactElement, queryClient?: QueryClient) =>
  render(ui, { wrapper: (props) => <AllProviders {...props} queryClient={queryClient} /> });
