import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { CityFormModal } from "@/components/cities/CityFormModal";
import { __resetMockCitiesForTest, getAllMockCities } from "@/mocks/mockCities";
import type { City } from "@/types/city";
import { renderWithProviders } from "../test-utils/renderWithProviders";

/**
 * 실제 cityService.addCity/updateCity(→ mockCities 저장소)를 그대로 사용하는 통합 테스트.
 * mockDelay만 즉시 resolve로 대체해 300~800ms 랜덤 지연 없이 검증한다.
 */
vi.mock("@/mocks/mockDelay", () => ({
  mockDelay: () => Promise.resolve(),
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

const fillValidForm = (overrides: Partial<Record<string, string>> = {}) => {
  fireEvent.change(screen.getByLabelText(/도시명/), {
    target: { value: overrides.cityName ?? "Busan" },
  });
  fireEvent.change(screen.getByLabelText(/국가명/), {
    target: { value: overrides.countryName ?? "South Korea" },
  });
  fireEvent.change(screen.getByLabelText(/국가코드/), {
    target: { value: overrides.countryCode ?? "KR" },
  });
  fireEvent.change(screen.getByLabelText(/위도/), {
    target: { value: overrides.lat ?? "35.1796" },
  });
  fireEvent.change(screen.getByLabelText(/경도/), {
    target: { value: overrides.lng ?? "129.0756" },
  });
};

beforeEach(() => {
  __resetMockCitiesForTest();
});

/**
 * CityFormModal은 열림 시점(닫힘→열림 전환)에만 폼 값을 초기화한다(컴포넌트 내부 주석 참고:
 * "열림 시점에만 폼 상태를 초기화한다"). 실제 앱(`CitiesPageContent`)에서도 모달은 항상
 * `open=false`로 먼저 마운트된 뒤 토글되므로, edit 모드 테스트는 동일하게 닫힌 상태로
 * 먼저 렌더링한 뒤 `open`을 true로 바꿔 실제 사용 패턴을 재현한다.
 */
const renderEditModalOpened = (city: City, onOpenChange = vi.fn()) => {
  const { rerender } = renderWithProviders(
    <CityFormModal open={false} mode="edit" city={city} onOpenChange={onOpenChange} />,
  );
  rerender(<CityFormModal open mode="edit" city={city} onOpenChange={onOpenChange} />);
  return { onOpenChange };
};

describe("CityFormModal - create mode (F3)", () => {
  it("제목/제출 버튼이 추가 모드 문구를 표시한다", () => {
    renderWithProviders(<CityFormModal open mode="create" onOpenChange={vi.fn()} />);

    expect(screen.getByText("도시 추가")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "추가" })).toBeInTheDocument();
  });

  it("필수 필드 누락 시 제출을 막고 필드별 인라인 에러를 표시한다 (F3 엣지케이스)", () => {
    renderWithProviders(<CityFormModal open mode="create" onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(screen.getByText("도시명을 입력해주세요")).toBeInTheDocument();
    expect(screen.getByText("국가명을 입력해주세요")).toBeInTheDocument();
    expect(screen.getByText("국가코드는 영문 2자(예: KR)로 입력해주세요")).toBeInTheDocument();
    expect(screen.getByText("위도는 -90~90 사이의 숫자여야 합니다")).toBeInTheDocument();
    expect(screen.getByText("경도는 -180~180 사이의 숫자여야 합니다")).toBeInTheDocument();

    // 검증 실패 시 실제 addMockCity를 호출하지 않아야 한다.
    expect(getAllMockCities()).toHaveLength(15);
  });

  it("위경도 범위를 벗어나면 검증 오류를 표시하고 제출을 막는다 (F3 엣지케이스)", () => {
    renderWithProviders(<CityFormModal open mode="create" onOpenChange={vi.fn()} />);

    fillValidForm({ lat: "91", lng: "181" });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(screen.getByText("위도는 -90~90 사이의 숫자여야 합니다")).toBeInTheDocument();
    expect(screen.getByText("경도는 -180~180 사이의 숫자여야 합니다")).toBeInTheDocument();
  });

  it("숫자가 아닌 위경도 입력은 검증 오류를 표시한다 (F3 엣지케이스)", () => {
    renderWithProviders(<CityFormModal open mode="create" onOpenChange={vi.fn()} />);

    fillValidForm({ lat: "abc", lng: "xyz" });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(screen.getByText("위도는 -90~90 사이의 숫자여야 합니다")).toBeInTheDocument();
    expect(screen.getByText("경도는 -180~180 사이의 숫자여야 합니다")).toBeInTheDocument();
  });

  it("국가코드가 alpha-2 형식이 아니면 검증 오류를 표시한다", () => {
    renderWithProviders(<CityFormModal open mode="create" onOpenChange={vi.fn()} />);

    fillValidForm({ countryCode: "KOR" });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(screen.getByText("국가코드는 영문 2자(예: KR)로 입력해주세요")).toBeInTheDocument();
  });

  it("에러 표시된 필드는 값 변경 즉시(onChange) 재검증되어 에러가 해제된다 (design-spec.md §4)", () => {
    renderWithProviders(<CityFormModal open mode="create" onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    expect(screen.getByText("도시명을 입력해주세요")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/도시명/), { target: { value: "Busan" } });

    expect(screen.queryByText("도시명을 입력해주세요")).not.toBeInTheDocument();
  });

  it("유효한 값으로 제출하면 실제 addCity를 통해 저장소에 추가되고 성공 토스트 후 모달이 닫힌다", async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(<CityFormModal open mode="create" onOpenChange={onOpenChange} />);

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(await screen.findByText("도시가 추가되었습니다")).toBeInTheDocument();

    const stored = getAllMockCities();
    expect(stored).toHaveLength(16);
    expect(stored.find((c) => c.cityName === "Busan" && c.countryName === "South Korea")).toBeDefined();
  });

  it("중복 도시명+국가명 제출 시 서버 거부를 폼 상단 배너로 표시하고 입력값을 유지한다 (F3 엣지케이스)", async () => {
    renderWithProviders(<CityFormModal open mode="create" onOpenChange={vi.fn()} />);

    fillValidForm({ cityName: "Seoul", countryName: "South Korea" });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("이미 등록된 도시입니다.");
    expect((screen.getByLabelText(/도시명/) as HTMLInputElement).value).toBe("Seoul");

    // 실제로 저장소에 추가되지 않았어야 한다 (거부됨).
    expect(getAllMockCities()).toHaveLength(15);
  });
});

describe("CityFormModal - edit mode (F4)", () => {
  it("edit 모드에서는 city 데이터로 폼이 초기화되고 저장 버튼 문구를 표시한다", () => {
    renderEditModalOpened(seoul);

    expect(screen.getByText("도시 수정")).toBeInTheDocument();
    expect((screen.getByLabelText(/도시명/) as HTMLInputElement).value).toBe("Seoul");
    expect((screen.getByLabelText(/국가명/) as HTMLInputElement).value).toBe("South Korea");
    expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
  });

  it("유효한 값으로 수정 제출하면 실제 updateCity를 통해 저장소가 갱신되고 모달이 닫힌다", async () => {
    const { onOpenChange } = renderEditModalOpened(seoul);

    fireEvent.change(screen.getByLabelText(/도시명/), { target: { value: "Seoul Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(await screen.findByText("도시가 수정되었습니다")).toBeInTheDocument();

    const stored = getAllMockCities();
    expect(stored.find((c) => c.cityId === 1)?.cityName).toBe("Seoul Updated");
  });

  it("수정 결과가 다른 도시와 중복되면 폼 상단 배너로 거부 메시지를 표시한다 (F4 엣지케이스)", async () => {
    renderEditModalOpened(seoul);

    // cityId 2 = Tokyo/Japan으로 바꾸려 하면 기존 Tokyo/Japan(cityId 2)과 중복.
    fireEvent.change(screen.getByLabelText(/도시명/), { target: { value: "Tokyo" } });
    fireEvent.change(screen.getByLabelText(/국가명/), { target: { value: "Japan" } });
    fireEvent.change(screen.getByLabelText(/국가코드/), { target: { value: "JP" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("이미 등록된 도시입니다.");

    // 원본 Seoul(cityId 1)은 변경되지 않았어야 한다.
    expect(getAllMockCities().find((c) => c.cityId === 1)?.cityName).toBe("Seoul");
  });

  it("존재하지 않는 대상(id) 수정 시도 시 폼을 닫고 Toast로만 안내한다 (F4 엣지케이스, design-spec.md §3.5)", async () => {
    // 다른 세션에서 이미 삭제된 상황을 재현: 저장소에서 먼저 제거한 뒤 그 city로 폼을 연다.
    const ghostCity: City = { ...seoul, id: "9999" };
    const { onOpenChange } = renderEditModalOpened(ghostCity);

    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(await screen.findByText("대상을 찾을 수 없습니다.")).toBeInTheDocument();

    // not-found는 폼 상단 배너(role=alert)가 아닌 Toast로만 표시되어야 한다.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("CityFormModal - 공통 동작", () => {
  it("취소 버튼 클릭 시 아무 요청 없이 즉시 닫힌다", () => {
    const onOpenChange = vi.fn();
    renderWithProviders(<CityFormModal open mode="create" onOpenChange={onOpenChange} />);

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(getAllMockCities()).toHaveLength(15);
  });

  it("open=false면 모달 내용을 렌더링하지 않는다", () => {
    renderWithProviders(<CityFormModal open={false} mode="create" onOpenChange={vi.fn()} />);

    expect(screen.queryByText("도시 추가")).not.toBeInTheDocument();
  });
});
