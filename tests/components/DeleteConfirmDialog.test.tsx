import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { DeleteConfirmDialog } from "@/components/cities/DeleteConfirmDialog";
import type { City } from "@/types/city";
import { renderWithProviders } from "../test-utils/renderWithProviders";

// 실제 cityService와 apiClient 경로를 쓰고 전역 fetch만 대체하는 통합 테스트
const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const stubFetch = (respond: () => Response | Promise<Response>) => {
  const fetchMock = vi.fn(async () => respond());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const deletedCity = {
  cityId: 1,
  cityName: "Seoul",
  countryName: "South Korea",
  lat: 37.5665,
  lng: 126.978,
  countryCode: "KOR",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const seoul: City = {
  id: "1",
  name: "Seoul",
  country: "South Korea",
  flag: "🇰🇷",
  lat: 37.5665,
  lng: 126.978,
  countryCode: "KOR",
};

describe("DeleteConfirmDialog (F5)", () => {
  it("city가 null이면 다이얼로그를 렌더링하지 않는다", () => {
    renderWithProviders(<DeleteConfirmDialog city={null} onOpenChange={vi.fn()} />);

    expect(screen.queryByText("도시 삭제")).not.toBeInTheDocument();
  });

  it("city가 있으면 확인 문구에 도시명/국가명을 포함해 표시한다", () => {
    renderWithProviders(<DeleteConfirmDialog city={seoul} onOpenChange={vi.fn()} />);

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "'Seoul(South Korea)'을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."),
    ).toBeInTheDocument();
  });

  it("취소 버튼 클릭 시 onOpenChange(false)가 호출되고 삭제 요청은 보내지 않는다", () => {
    const fetchMock = stubFetch(() => jsonResponse(200, { status: "success", data: deletedCity }));
    const onOpenChange = vi.fn();
    renderWithProviders(<DeleteConfirmDialog city={seoul} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("삭제 버튼 클릭 시 DELETE /api/cities/{id}로 요청하고 다이얼로그가 닫힌다", async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, { status: "success", data: deletedCity }));
    const onOpenChange = vi.fn();
    renderWithProviders(<DeleteConfirmDialog city={seoul} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/cities/1");
    expect(init.method).toBe("DELETE");
  });

  it("대상이 없다는 404 응답이면 토스트를 띄우고 다이얼로그를 닫는다 (F5 idempotency)", async () => {
    stubFetch(() => jsonResponse(404, { status: "fail", data: "서버 메시지" }));
    const onOpenChange = vi.fn();
    renderWithProviders(<DeleteConfirmDialog city={seoul} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(await screen.findByText("대상을 찾을 수 없습니다.")).toBeInTheDocument();
  });

  it("서버 오류는 토스트만 띄우고 다이얼로그를 열어 둬 재시도할 수 있다", async () => {
    stubFetch(() => jsonResponse(502, { status: "fail", data: "도시 서버에 문제가 발생했습니다." }));
    const onOpenChange = vi.fn();
    renderWithProviders(<DeleteConfirmDialog city={seoul} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(await screen.findByText("서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "삭제" })).toBeEnabled();
  });

  it("삭제 진행 중에는 삭제/취소 버튼이 비활성화되어 중복 클릭을 막는다", async () => {
    // 응답 시점을 수동 제어해 pending 상태 유지
    let resolveResponse: (response: Response) => void = () => {};
    stubFetch(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
    );

    const onOpenChange = vi.fn();
    renderWithProviders(<DeleteConfirmDialog city={seoul} onOpenChange={onOpenChange} />);

    const deleteButton = screen.getByRole("button", { name: "삭제" });
    fireEvent.click(deleteButton);

    await waitFor(() => expect(deleteButton).toBeDisabled());
    expect(screen.getByRole("button", { name: "취소" })).toBeDisabled();

    resolveResponse(jsonResponse(200, { status: "success", data: deletedCity }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
