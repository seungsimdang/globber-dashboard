import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CityListTable } from "@/components/cities/CityListTable";
import type { City } from "@/types/city";

const sampleCities: City[] = [
  {
    id: "1",
    name: "Seoul",
    country: "South Korea",
    flag: "🇰🇷",
    lat: 37.5665,
    lng: 126.978,
    countryCode: "KR",
  },
  {
    id: "2",
    name: "Busan",
    country: "South Korea",
    flag: "🇰🇷",
    lat: 35.1796,
    lng: 129.0756,
    countryCode: "KR",
  },
];

const baseProps = {
  keyword: "",
  isLoading: false,
  isError: false,
  onRetry: vi.fn(),
  onAddCity: vi.fn(),
  onEditCity: vi.fn(),
  onDeleteCity: vi.fn(),
};

describe("CityListTable (F1)", () => {
  it("로딩 중이면 로딩 텍스트를 표시하고 데이터/에러/빈 상태는 표시하지 않는다", () => {
    render(<CityListTable {...baseProps} cities={[]} isLoading />);

    expect(screen.getByText("불러오는 중...")).toBeInTheDocument();
    expect(screen.queryByText("등록된 도시가 없습니다.")).not.toBeInTheDocument();
  });

  it("에러 상태면 에러 메시지와 다시 시도 버튼을 표시하고, 클릭 시 onRetry가 호출된다 (F1 엣지케이스)", () => {
    const onRetry = vi.fn();
    render(
      <CityListTable
        {...baseProps}
        cities={[]}
        isError
        errorMessage="네트워크 오류"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("네트워크 오류")).toBeInTheDocument();
    screen.getByRole("button", { name: "다시 시도" }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("에러 메시지가 없으면 기본 에러 문구를 표시한다", () => {
    render(<CityListTable {...baseProps} cities={[]} isError />);

    expect(screen.getByText("목록을 불러오지 못했습니다.")).toBeInTheDocument();
  });

  it("검색어 없이 데이터가 0건이면 전체 빈 상태 문구와 도시 추가 버튼을 표시한다 (F1 빈 상태)", () => {
    const onAddCity = vi.fn();
    render(<CityListTable {...baseProps} cities={[]} onAddCity={onAddCity} />);

    expect(screen.getByText("등록된 도시가 없습니다.")).toBeInTheDocument();
    screen.getByRole("button", { name: "도시 추가" }).click();
    expect(onAddCity).toHaveBeenCalledTimes(1);
  });

  it("검색어가 있는 상태에서 데이터가 0건이면 검색 결과 없음 문구를 표시한다 (F2 엣지케이스)", () => {
    render(<CityListTable {...baseProps} cities={[]} keyword="존재하지않음" />);

    expect(screen.getByText("'존재하지않음'에 대한 검색 결과가 없습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "도시 추가" })).not.toBeInTheDocument();
  });

  it("정상 목록: 동일 국가의 여러 도시를 포함해 각 행을 표시한다 (F1 엣지케이스)", () => {
    render(<CityListTable {...baseProps} cities={sampleCities} />);

    expect(screen.getByText("Seoul")).toBeInTheDocument();
    expect(screen.getByText("Busan")).toBeInTheDocument();
    expect(screen.getAllByText("South Korea")).toHaveLength(2);
  });

  it("각 행의 수정/삭제 버튼 클릭 시 해당 city와 함께 콜백을 호출한다", () => {
    const onEditCity = vi.fn();
    const onDeleteCity = vi.fn();
    render(
      <CityListTable
        {...baseProps}
        cities={sampleCities}
        onEditCity={onEditCity}
        onDeleteCity={onDeleteCity}
      />,
    );

    screen.getByRole("button", { name: "Seoul 수정" }).click();
    expect(onEditCity).toHaveBeenCalledWith(sampleCities[0]);

    screen.getByRole("button", { name: "Busan 삭제" }).click();
    expect(onDeleteCity).toHaveBeenCalledWith(sampleCities[1]);
  });
});
