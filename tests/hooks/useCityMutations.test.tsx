import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { citiesQueryOptions } from "@/hooks/useCities";
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
