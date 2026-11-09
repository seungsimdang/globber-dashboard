"use client";

import { AlertDialog, AlertDialogCancel } from "@/components/common/AlertDialog";
import { Button } from "@/components/common/Button";
import { useToast } from "@/components/common/Toast";
import { useDeleteCityMutation } from "@/hooks/useCityMutations";
import type { City, CityServer } from "@/types/city";
import { NOT_FOUND_MESSAGE, getErrorMessage, isNotFoundError, serverMessages } from "@/utils/cityErrorMessage";

type DeleteConfirmDialogProps = {
  server: CityServer;
  /** 삭제 대상 도시. null이면 다이얼로그가 닫힌 상태다. */
  city: City | null;
  onOpenChange: (open: boolean) => void;
};

/**
 * 삭제 확인 다이얼로그. `AlertDialogAction`은 Radix 내부적으로
 * `Dialog.Close`이므로 클릭 즉시 다이얼로그를 닫아버려 "삭제 중 로딩 유지" 요구사항과
 * 충돌한다 - 그래서 삭제 버튼은 일반 `Button`으로 만들고, mutation이 끝난 뒤 우리가
 * 직접 `onOpenChange(false)`를 호출해 닫는다.
 */
export const DeleteConfirmDialog = ({ server, city, onOpenChange }: DeleteConfirmDialogProps) => {
  const messages = serverMessages(server);
  const { showToast } = useToast();
  const deleteCityMutation = useDeleteCityMutation(server);

  const handleDelete = () => {
    if (!city) return;

    deleteCityMutation.mutate(city.id, {
      onSuccess: () => {
        showToast({ title: messages.deleted, variant: "success" });
        onOpenChange(false);
      },
      onError: (error: Error) => {
        const notFound = isNotFoundError(error);

        showToast({
          title: notFound ? NOT_FOUND_MESSAGE : getErrorMessage(error, "delete"),
          variant: "error",
        });
        // 대상 없음만 닫고, 네트워크·5xx·인증 오류는 다이얼로그를 열어 둬 재시도할 수 있게 함
        if (notFound) onOpenChange(false);
      },
    });
  };

  return (
    <AlertDialog
      open={city !== null}
      onOpenChange={(next) => {
        if (!deleteCityMutation.isPending) onOpenChange(next);
      }}
      title={`${messages.titlePrefix}도시 삭제`}
      description={
        city ? (
          <>
            {messages.label} 서버에서 &apos;{city.name}({city.country})&apos;을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수
            없습니다.
          </>
        ) : undefined
      }
    >
      <div className="flex justify-end gap-2">
        <AlertDialogCancel asChild>
          <Button variant="secondary" disabled={deleteCityMutation.isPending}>
            취소
          </Button>
        </AlertDialogCancel>
        <Button
          type="button"
          variant="danger"
          isLoading={deleteCityMutation.isPending}
          onClick={handleDelete}
        >
          삭제
        </Button>
      </div>
    </AlertDialog>
  );
};
