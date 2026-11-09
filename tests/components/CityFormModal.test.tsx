import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { CityFormModal } from "@/components/cities/CityFormModal";
import { citiesQueryOptions } from "@/hooks/useCities";
import type { City } from "@/types/city";
import { renderWithProviders } from "../test-utils/renderWithProviders";

// 실제 cityService와 apiClient 경로를 쓰고 전역 fetch만 대체하는 통합 테스트, 중복 사전 검사는 쿼리 캐시로 재현
const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const stubFetch = (respond: () => Response) => {
  const fetchMock = vi.fn(async () => respond());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const savedCity = {
  cityId: 3,
  cityName: "Busan",
  countryName: "South Korea",
  lat: 35.1796,
  lng: 129.0756,
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

const tokyo: City = {
  id: "2",
  name: "Tokyo",
  country: "Japan",
  flag: "🇯🇵",
  lat: 35.6762,
  lng: 139.6503,
  countryCode: "JPN",
};

// 중복 사전 검사용으로 전체 목록을 쿼리 캐시에 미리 넣은 클라이언트
const createClientWithCities = (cities: City[]) => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(citiesQueryOptions("dev").queryKey, cities);
  return client;
};

const fillValidForm = (overrides: Partial<Record<string, string>> = {}) => {
  fireEvent.change(screen.getByLabelText(/도시명/), {
    target: { value: overrides.cityName ?? "Busan" },
  });
  fireEvent.change(screen.getByLabelText(/국가명/), {
    target: { value: overrides.countryName ?? "South Korea" },
  });
  fireEvent.change(screen.getByLabelText(/국가코드/), {
    target: { value: overrides.countryCode ?? "KOR" },
  });
  fireEvent.change(screen.getByLabelText(/위도/), {
    target: { value: overrides.lat ?? "35.1796" },
  });
  fireEvent.change(screen.getByLabelText(/경도/), {
    target: { value: overrides.lng ?? "129.0756" },
  });
};

// 모달은 열림 시점에만 폼 값을 초기화하므로 닫힌 상태로 먼저 렌더링한 뒤 open을 true로 전환해 실제 사용 패턴 재현
const renderEditModalOpened = (city: City, onOpenChange = vi.fn(), queryClient?: QueryClient) => {
  const { rerender } = renderWithProviders(
    <CityFormModal server="dev" open={false} mode="edit" city={city} onOpenChange={onOpenChange} />,
    queryClient,
  );
  rerender(<CityFormModal server="dev" open mode="edit" city={city} onOpenChange={onOpenChange} />);
  return { onOpenChange };
};

describe("CityFormModal - create mode (F3)", () => {
  it("제목/제출 버튼이 추가 모드 문구를 표시한다", () => {
    renderWithProviders(<CityFormModal server="dev" open mode="create" onOpenChange={vi.fn()} />);

    expect(screen.getByText("[개발] 도시 추가")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "추가" })).toBeInTheDocument();
  });

  it("필수 필드 누락 시 제출을 막고 필드별 인라인 에러를 표시한다 (F3 엣지케이스)", () => {
    const fetchMock = stubFetch(() => jsonResponse(200, { status: "success", data: savedCity }));
    renderWithProviders(<CityFormModal server="dev" open mode="create" onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(screen.getByText("도시명을 입력해주세요")).toBeInTheDocument();
    expect(screen.getByText("국가명을 입력해주세요")).toBeInTheDocument();
    expect(screen.getByText("국가코드는 영문 3자(예: KOR)로 입력해주세요")).toBeInTheDocument();
    expect(screen.getByText("위도는 -90~90 사이의 숫자여야 합니다")).toBeInTheDocument();
    expect(screen.getByText("경도는 -180~180 사이의 숫자여야 합니다")).toBeInTheDocument();

    // 검증 실패 시 서버 요청 없음
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("위경도 범위를 벗어나면 검증 오류를 표시하고 제출을 막는다 (F3 엣지케이스)", () => {
    renderWithProviders(<CityFormModal server="dev" open mode="create" onOpenChange={vi.fn()} />);

    fillValidForm({ lat: "91", lng: "181" });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(screen.getByText("위도는 -90~90 사이의 숫자여야 합니다")).toBeInTheDocument();
    expect(screen.getByText("경도는 -180~180 사이의 숫자여야 합니다")).toBeInTheDocument();
  });

  it("숫자가 아닌 위경도 입력은 검증 오류를 표시한다 (F3 엣지케이스)", () => {
    renderWithProviders(<CityFormModal server="dev" open mode="create" onOpenChange={vi.fn()} />);

    fillValidForm({ lat: "abc", lng: "xyz" });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(screen.getByText("위도는 -90~90 사이의 숫자여야 합니다")).toBeInTheDocument();
    expect(screen.getByText("경도는 -180~180 사이의 숫자여야 합니다")).toBeInTheDocument();
  });

  it("국가코드가 alpha-3 형식이 아니면 검증 오류를 표시한다", () => {
    renderWithProviders(<CityFormModal server="dev" open mode="create" onOpenChange={vi.fn()} />);

    fillValidForm({ countryCode: "KR" });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(screen.getByText("국가코드는 영문 3자(예: KOR)로 입력해주세요")).toBeInTheDocument();
  });

  it("에러 표시된 필드는 값 변경 즉시(onChange) 재검증되어 에러가 해제된다", () => {
    renderWithProviders(<CityFormModal server="dev" open mode="create" onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    expect(screen.getByText("도시명을 입력해주세요")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/도시명/), { target: { value: "Busan" } });

    expect(screen.queryByText("도시명을 입력해주세요")).not.toBeInTheDocument();
  });

  it("유효한 값으로 제출하면 POST /api/cities로 요청하고 성공 토스트 후 모달이 닫힌다", async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, { status: "success", data: savedCity }));
    const onOpenChange = vi.fn();
    renderWithProviders(<CityFormModal server="dev" open mode="create" onOpenChange={onOpenChange} />);

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(await screen.findByText("개발 서버에 도시가 추가되었습니다")).toBeInTheDocument();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/cities?server=dev");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      cityName: "Busan",
      countryName: "South Korea",
      countryCode: "KOR",
      lat: 35.1796,
      lng: 129.0756,
    });
  });

  it("중복 도시명+국가명 제출 시 요청 없이 폼 상단 배너로 표시하고 입력값을 유지한다 (F3 엣지케이스)", async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, { status: "success", data: savedCity }));
    renderWithProviders(
      <CityFormModal server="dev" open mode="create" onOpenChange={vi.fn()} />,
      createClientWithCities([seoul, tokyo]),
    );

    fillValidForm({ cityName: "Seoul", countryName: "South Korea" });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("이미 등록된 도시입니다.");
    expect((screen.getByLabelText(/도시명/) as HTMLInputElement).value).toBe("Seoul");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("서버가 400 메시지로 거부하면 메시지를 그대로 배너에 표시하고 입력값을 유지한다", async () => {
    stubFetch(() => jsonResponse(400, { status: "fail", data: "서버 거부 메시지" }));
    renderWithProviders(<CityFormModal server="dev" open mode="create" onOpenChange={vi.fn()} />);

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("서버 거부 메시지");
    expect((screen.getByLabelText(/도시명/) as HTMLInputElement).value).toBe("Busan");
  });
});

describe("CityFormModal - edit mode (F4)", () => {
  it("edit 모드에서는 city 데이터로 폼이 초기화되고 저장 버튼 문구를 표시한다", () => {
    renderEditModalOpened(seoul);

    expect(screen.getByText("[개발] 도시 수정")).toBeInTheDocument();
    expect((screen.getByLabelText(/도시명/) as HTMLInputElement).value).toBe("Seoul");
    expect((screen.getByLabelText(/국가명/) as HTMLInputElement).value).toBe("South Korea");
    expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
  });

  it("처음부터 open=true로 마운트돼도 edit 모드 폼이 city 데이터로 초기화된다", () => {
    renderWithProviders(<CityFormModal server="dev" open mode="edit" city={seoul} onOpenChange={vi.fn()} />);

    expect((screen.getByLabelText(/도시명/) as HTMLInputElement).value).toBe("Seoul");
    expect((screen.getByLabelText(/국가명/) as HTMLInputElement).value).toBe("South Korea");
  });

  it("유효한 값으로 수정 제출하면 PUT /api/cities/{id}로 요청하고 모달이 닫힌다", async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse(200, { status: "success", data: { ...savedCity, cityId: 1, cityName: "Seoul Updated" } }),
    );
    const { onOpenChange } = renderEditModalOpened(seoul);

    fireEvent.change(screen.getByLabelText(/도시명/), { target: { value: "Seoul Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(await screen.findByText("개발 서버의 도시가 수정되었습니다")).toBeInTheDocument();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/cities/1?server=dev");
    expect(init.method).toBe("PUT");
  });

  it("수정 결과가 다른 도시와 중복되면 요청 없이 폼 상단 배너로 거부 메시지를 표시한다 (F4 엣지케이스)", async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, { status: "success", data: savedCity }));
    renderEditModalOpened(seoul, vi.fn(), createClientWithCities([seoul, tokyo]));

    fireEvent.change(screen.getByLabelText(/도시명/), { target: { value: "Tokyo" } });
    fireEvent.change(screen.getByLabelText(/국가명/), { target: { value: "Japan" } });
    fireEvent.change(screen.getByLabelText(/국가코드/), { target: { value: "JPN" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("이미 등록된 도시입니다.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("존재하지 않는 대상(id) 수정 시도 시 폼을 닫고 Toast로만 안내한다 (F4 엣지케이스)", async () => {
    // 다른 세션에서 이미 삭제된 상황으로 서버가 404 응답
    stubFetch(() => jsonResponse(404, { status: "fail", data: "서버 메시지" }));
    const ghostCity: City = { ...seoul, id: "9999" };
    const { onOpenChange } = renderEditModalOpened(ghostCity);

    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(await screen.findByText("대상을 찾을 수 없습니다.")).toBeInTheDocument();

    // 폼 상단 배너(role=alert) 없이 Toast로만 표시
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("CityFormModal - 공통 동작", () => {
  it("취소 버튼 클릭 시 아무 요청 없이 즉시 닫힌다", () => {
    const fetchMock = stubFetch(() => jsonResponse(200, { status: "success", data: savedCity }));
    const onOpenChange = vi.fn();
    renderWithProviders(<CityFormModal server="dev" open mode="create" onOpenChange={onOpenChange} />);

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("open=false면 모달 내용을 렌더링하지 않는다", () => {
    renderWithProviders(<CityFormModal server="dev" open={false} mode="create" onOpenChange={vi.fn()} />);

    expect(screen.queryByText("[개발] 도시 추가")).not.toBeInTheDocument();
  });
});
