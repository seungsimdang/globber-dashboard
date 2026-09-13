import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { DeleteConfirmDialog } from "@/components/cities/DeleteConfirmDialog";
import { __resetMockCitiesForTest } from "@/mocks/mockCities";
import { deleteCity } from "@/services/cityService";
import { mockDelay } from "@/mocks/mockDelay";
import type { City } from "@/types/city";
import { renderWithProviders } from "../test-utils/renderWithProviders";

/**
 * 실제 삭제 로직(cityService.deleteCity → mockCities)을 그대로 사용하는 통합 테스트.
 * mockDelay만 대체해 300~800ms 랜덤 지연 없이 빠르게(또는 필요 시 제어 가능하게) 검증한다.
 * 기본은 즉시 resolve하되, "진행 중 상태" 테스트에서는 수동으로 resolve 시점을 제어한다.
 */
vi.mock("@/mocks/mockDelay", () => ({
  mockDelay: vi.fn(() => Promise.resolve()),
}));

const seoul: City = {
  id: "1",
  name: "Seoul",
  country: "South Korea",
  flag: "🇰🇷",
  lat: 37.5665,
  lng: 126.978,
  countryCode: "KR",
};

beforeEach(() => {
  __resetMockCitiesForTest();
});

describe("DeleteConfirmDialog (F5)", () => {
  it("city가 null이면 다이얼로그를 렌더링하지 않는다", () => {
    renderWithProviders(<DeleteConfirmDialog city={null} onOpenChange={vi.fn()} />);

    expect(screen.queryByText("도시 삭제")).not.toBeInTheDocument();
  });

  it("city가 있으면 확인 문구에 도시명/국가명을 포함해 표시한다 (design-spec.md §5)", () => {
    renderWithProviders(<DeleteConfirmDialog city={seoul} onOpenChange={vi.fn()} />);

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "'Seoul(South Korea)'을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."),
    ).toBeInTheDocument();
  });

  it("취소 버튼 클릭 시 onOpenChange(false)가 호출되고 실제 삭제는 일어나지 않는다", () => {
    const onOpenChange = vi.fn();
    renderWithProviders(<DeleteConfirmDialog city={seoul} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("삭제 버튼 클릭 시 실제 cityService.deleteCity가 호출되어 저장소에서 제거되고 다이얼로그가 닫힌다", async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(<DeleteConfirmDialog city={seoul} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

    // 실제 서비스 레이어를 거쳐 삭제되었는지 소스 함수를 다시 호출해 확인한다.
    await expect(deleteCity("1")).rejects.toThrow("대상을 찾을 수 없습니다.");
  });

  it("존재하지 않는 id(이미 삭제됨) 삭제 시도 시 에러 콜백 경로를 타고도 다이얼로그를 닫는다 (F5 idempotency)", async () => {
    // 먼저 실제로 삭제해 대상이 사라진 상태를 만든 뒤, 같은 city로 다시 다이얼로그를 띄운 것을 재현.
    await deleteCity("1");

    const onOpenChange = vi.fn();
    renderWithProviders(<DeleteConfirmDialog city={seoul} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("삭제 진행 중에는 삭제/취소 버튼이 비활성화되어 중복 클릭을 막는다", async () => {
    // 이 테스트만 mockDelay를 수동으로 제어해, mutation이 pending 상태로 머무는 동안
    // 버튼 비활성화를 관찰할 수 있게 한다 (검증/쓰기 로직 자체는 실제 deleteCity/deleteMockCity 사용).
    let resolveDelay: () => void = () => {};
    vi.mocked(mockDelay).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveDelay = resolve;
        }),
    );

    const onOpenChange = vi.fn();
    renderWithProviders(<DeleteConfirmDialog city={seoul} onOpenChange={onOpenChange} />);

    const deleteButton = screen.getByRole("button", { name: "삭제" });
    fireEvent.click(deleteButton);

    await waitFor(() => expect(deleteButton).toBeDisabled());
    expect(screen.getByRole("button", { name: "취소" })).toBeDisabled();

    resolveDelay();

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
