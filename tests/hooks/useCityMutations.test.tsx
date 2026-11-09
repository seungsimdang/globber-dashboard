import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { citiesQueryOptions } from "@/hooks/useCities";
import { queryKeys } from "@/lib/react-query/query-keys";
import { DUPLICATE_CITY_MESSAGE, useAddCityMutation, useUpdateCityMutation } from "@/hooks/useCityMutations";
import * as service from "@/services/cityService";
import type { City } from "@/types/city";

vi.mock("@/services/cityService", () => ({
  addCity: vi.fn(),
  updateCity: vi.fn(),
  deleteCity: vi.fn(),
  getCities: vi.fn(),
}));

const c = (id: string, name: string, country: string): City => ({
  id, name, country, flag: "", lat: 0, lng: 0, countryCode: "KOR",
});
const params = (cityName: string, countryName: string) => ({ cityName, countryName, lat: 1, lng: 2, countryCode: "KOR" });

const setup = (cities?: City[]) => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  if (cities) client.setQueryData(citiesQueryOptions("dev").queryKey, cities);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return Wrapper;
};

beforeEach(() => vi.clearAllMocks());

describe("중복 사전 검사", () => {
  const cities = [c("1", "Seoul", "Korea"), c("2", "Busan", "Korea")];

  it("운영과 개발 목록은 서로 다른 React Query 캐시 키를 사용한다", () => {
    expect(citiesQueryOptions("prod").queryKey).not.toEqual(citiesQueryOptions("dev").queryKey);
  });

  it("추가 시 중복이면 서비스를 호출하지 않고 오류를 던진다", async () => {
    const { result } = renderHook(() => useAddCityMutation("dev"), { wrapper: setup(cities) });
    await act(async () => {
      await expect(result.current.mutateAsync(params("seoul", "korea"))).rejects.toThrow(DUPLICATE_CITY_MESSAGE);
    });
    expect(service.addCity).not.toHaveBeenCalled();
  });

  it("목록 캐시가 없으면 사전 검사를 건너뛰고 서버에 맡긴다", async () => {
    const { result } = renderHook(() => useAddCityMutation("dev"), { wrapper: setup() });
    await act(async () => {
      await result.current.mutateAsync(params("Seoul", "Korea"));
    });
    expect(service.addCity).toHaveBeenCalledTimes(1);
  });

  it("개발 쓰기 성공은 개발 목록 캐시만 무효화한다", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useAddCityMutation("dev"), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(params("Osaka", "Japan"));
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.cities.list("dev") });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: queryKeys.cities.list("prod") });
  });

  it("국가명 표기가 달라도 도시명과 국가코드가 같으면 추가를 거부한다", async () => {
    const legacy = [c("1", "Seoul", "South Korea")];
    const { result } = renderHook(() => useAddCityMutation("dev"), { wrapper: setup(legacy) });
    const paramsWithCurrentLabel = params("Seoul", "대한민국");

    await act(async () => {
      await expect(result.current.mutateAsync(paramsWithCurrentLabel)).rejects.toThrow(DUPLICATE_CITY_MESSAGE);
    });

    expect(service.addCity).not.toHaveBeenCalled();
  });

  it("도시명이 같아도 국가코드가 다르면 추가를 허용한다", async () => {
    const { result } = renderHook(() => useAddCityMutation("dev"), { wrapper: setup(cities) });
    const request = { ...params("Seoul", "Korea"), countryCode: "USA" };
    await act(async () => { await result.current.mutateAsync(request); });
    expect(service.addCity).toHaveBeenCalledWith("dev", request);
  });

  it("수정 시 국가명이 달라도 원본 도시명과 국가코드가 같으면 허용한다", async () => {
    const { result } = renderHook(() => useUpdateCityMutation("dev"), { wrapper: setup(cities) });
    const request = params("Seoul", "대한민국");
    await act(async () => { await result.current.mutateAsync({ cityId: "1", params: request }); });
    expect(service.updateCity).toHaveBeenCalledWith("dev", "1", request);
  });

  it("수정 시 국가명 표기가 다른 기존 도시와 겹치면 거부한다", async () => {
    const { result } = renderHook(() => useUpdateCityMutation("dev"), { wrapper: setup(cities) });
    await act(async () => {
      await expect(result.current.mutateAsync({ cityId: "1", params: params("Busan", "대한민국") })).rejects.toThrow(DUPLICATE_CITY_MESSAGE);
    });
    expect(service.updateCity).not.toHaveBeenCalled();
  });

  it("수정 시 이름과 국가가 그대로면 통과한다", async () => {
    const { result } = renderHook(() => useUpdateCityMutation("dev"), { wrapper: setup(cities) });
    await act(async () => {
      await result.current.mutateAsync({ cityId: "1", params: params("Seoul", "Korea") });
    });
    expect(service.updateCity).toHaveBeenCalledWith("dev", "1", params("Seoul", "Korea"));
  });

  it("수정 시 다른 도시와 겹치는 이름으로 바꾸면 거부한다", async () => {
    const { result } = renderHook(() => useUpdateCityMutation("dev"), { wrapper: setup(cities) });
    await act(async () => {
      await expect(
        result.current.mutateAsync({ cityId: "1", params: params("Busan", "Korea") }),
      ).rejects.toThrow(DUPLICATE_CITY_MESSAGE);
    });
    expect(service.updateCity).not.toHaveBeenCalled();
  });

  it("수정 시 원본과 이름이 같으면 목록에 같은 쌍이 또 있어도 검사를 생략한다", async () => {
    const dup = [c("1", "Dup", "X"), c("2", "Dup", "X")];
    const { result } = renderHook(() => useUpdateCityMutation("dev"), { wrapper: setup(dup) });
    await act(async () => {
      await result.current.mutateAsync({ cityId: "1", params: params("Dup", "X") });
    });
    expect(service.updateCity).toHaveBeenCalledTimes(1);
  });
});
