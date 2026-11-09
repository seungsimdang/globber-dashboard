import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CityFormModal } from "@/components/cities/CityFormModal";
import { renderWithProviders } from "../test-utils/renderWithProviders";

const { searchGeocode } = vi.hoisted(() => ({ searchGeocode: vi.fn() }));
vi.mock("@/services/geocodeService", () => ({ searchGeocode: (...args: unknown[]) => searchGeocode(...args) }));

const candidate = {
  id: "place-1",
  displayName: "서울, 대한민국",
  lat: 37.5665,
  lng: 126.978,
  region: "서울특별시",
  placeType: "city",
};

const fillSearchFields = () => {
  fireEvent.change(screen.getByLabelText(/도시명/), { target: { value: "Seoul" } });
  const country = screen.getByRole("combobox", { name: "국가명" });
  fireEvent.change(country, { target: { value: "kor" } });
  fireEvent.click(screen.getByRole("option", { name: /대한민국/ }));
};

beforeEach(() => searchGeocode.mockReset());
afterEach(() => vi.useRealTimers());

describe("도시 폼의 위치 검색 결과", () => {
  it("사용자가 위치 찾기를 눌러 검색하고 후보를 고르면 좌표 입력란을 채운다", async () => {
    searchGeocode.mockResolvedValue([candidate]);
    renderWithProviders(<CityFormModal server="dev" open mode="create" onOpenChange={vi.fn()} />);
    fillSearchFields();

    const findButton = screen.getByRole("button", { name: "위치 찾기" });
    expect(findButton).toBeEnabled();
    fireEvent.click(findButton);
    await waitFor(() => expect(searchGeocode).toHaveBeenCalledWith("Seoul", "KOR"));
    const choice = await screen.findByRole("button", { name: /서울, 대한민국/ });
    fireEvent.click(choice);

    expect((screen.getByLabelText(/위도/) as HTMLInputElement).value).toBe("37.5665");
    expect((screen.getByLabelText(/경도/) as HTMLInputElement).value).toBe("126.978");
    expect(document.activeElement).toBe(screen.getByLabelText(/위도/));
  });

  it("위치 검색 중 버튼에만 스피너 하나와 진행 상태를 표시한다", async () => {
    let resolveSearch!: (value: typeof candidate[]) => void;
    searchGeocode.mockReturnValue(new Promise<typeof candidate[]>((resolve) => { resolveSearch = resolve; }));
    renderWithProviders(<CityFormModal server="dev" open mode="create" onOpenChange={vi.fn()} />);
    fillSearchFields();
    fireEvent.click(screen.getByRole("button", { name: "위치 찾기" }));

    const button = await screen.findByRole("button", { name: "찾는 중..." });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelectorAll(".animate-spin")).toHaveLength(1);
    expect(screen.getByRole("dialog").querySelectorAll(".animate-spin")).toHaveLength(1);
    expect(document.querySelector('[aria-live="polite"]')).toBeEmptyDOMElement();
    await act(async () => resolveSearch([candidate]));
  });

  it("모달을 닫은 뒤 도착한 이전 검색 응답은 다시 열려도 후보로 남지 않는다", async () => {
    let resolveSearch!: (value: typeof candidate[]) => void;
    searchGeocode.mockReturnValue(new Promise<typeof candidate[]>((resolve) => { resolveSearch = resolve; }));
    const onOpenChange = vi.fn();
    const { rerender } = renderWithProviders(
      <CityFormModal server="dev" open mode="create" onOpenChange={onOpenChange} />,
    );
    fillSearchFields();
    fireEvent.click(screen.getByRole("button", { name: "위치 찾기" }));

    rerender(<CityFormModal server="dev" open={false} mode="create" onOpenChange={onOpenChange} />);
    await act(async () => resolveSearch([candidate]));
    rerender(<CityFormModal server="dev" open mode="create" onOpenChange={onOpenChange} />);

    await waitFor(() => expect(screen.queryByRole("button", { name: /서울, 대한민국/ })).not.toBeInTheDocument());
  });
});
