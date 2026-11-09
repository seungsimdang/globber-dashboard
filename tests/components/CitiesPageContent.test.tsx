import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CitiesPageContent } from "@/components/cities/CitiesPageContent";
import { renderWithProviders } from "../test-utils/renderWithProviders";

const { useCities } = vi.hoisted(() => ({ useCities: vi.fn() }));
vi.mock("@/hooks/useCities", () => ({ useCities: (...args: unknown[]) => useCities(...args) }));

beforeEach(() => {
  useCities.mockReturnValue({
    cities: [],
    totalCount: 0,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });
});

describe("도시 페이지 서버 전환", () => {
  it("기본은 운영 조회 전용이고 개발 탭을 고르면 개발 쓰기가 열린다", () => {
    renderWithProviders(<CitiesPageContent />);

    expect(useCities).toHaveBeenLastCalledWith("prod", "");
    expect(screen.getByRole("button", { name: /도시 추가/ })).toBeDisabled();
    expect(screen.getByText("운영 서버는 쓰기 인증 준비 전이라 조회만 할 수 있습니다.")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "개발" }), { button: 0 });

    expect(useCities).toHaveBeenLastCalledWith("dev", "");
    expect(screen.getByRole("button", { name: /도시 추가/ })).toBeEnabled();
    expect(screen.queryByText("운영 서버는 쓰기 인증 준비 전이라 조회만 할 수 있습니다.")).not.toBeInTheDocument();
  });

  it("Radix 모달이 열려 있는 동안 포인터·키보드 상호작용을 모달 안에 가둔다", () => {
    const { container } = renderWithProviders(<CitiesPageContent />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "개발" }), { button: 0 });
    fireEvent.click(screen.getByRole("button", { name: /도시 추가/ }));
    const dialog = screen.getByRole("dialog");
    const outsideTab = container.querySelector<HTMLElement>('[role="tab"][data-state="active"]');

    expect(outsideTab).not.toBeNull();
    expect(document.body.style.pointerEvents).toBe("none");
    outsideTab?.focus();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
