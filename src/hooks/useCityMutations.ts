"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { citiesQueryOptions } from "@/hooks/useCities";
import { queryKeys } from "@/lib/react-query/query-keys";
import { addCity, deleteCity, updateCity } from "@/services/cityService";
import type { CityRequest, CityServer } from "@/types/city";
import { findDuplicateCity } from "@/utils/cityDuplicate";

export const DUPLICATE_CITY_MESSAGE = "이미 등록된 도시입니다.";

// 해당 서버의 목록 캐시가 있을 때만 중복 사전 검사, 없으면 서버 판단에 맡김
const useAssertNotDuplicate = (server: CityServer) => {
  const queryClient = useQueryClient();

  return (params: CityRequest, excludeId?: string) => {
    const cities = queryClient.getQueryData(citiesQueryOptions(server).queryKey);

    if (!cities) return;

    // 수정 시 도시명·국가명이 원본과 같으면 검사 생략
    const original = cities.find((city) => city.id === excludeId);

    if (original && findDuplicateCity([original], params)) return;

    if (findDuplicateCity(cities, params, excludeId)) {
      throw new Error(DUPLICATE_CITY_MESSAGE);
    }
  };
};

/** 도시 추가 mutation, 성공 시 해당 서버 목록 쿼리만 무효화 */
export const useAddCityMutation = (server: CityServer) => {
  const queryClient = useQueryClient();
  const assertNotDuplicate = useAssertNotDuplicate(server);

  return useMutation({
    mutationFn: (params: CityRequest) => {
      assertNotDuplicate(params);

      return addCity(server, params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cities.list(server) });
    },
  });
};

/** 도시 수정 mutation, 대상 없음 등 실패에도 목록을 최신화하려고 성공 여부와 무관하게 무효화 */
export const useUpdateCityMutation = (server: CityServer) => {
  const queryClient = useQueryClient();
  const assertNotDuplicate = useAssertNotDuplicate(server);

  return useMutation({
    mutationFn: ({ cityId, params }: { cityId: string; params: CityRequest }) => {
      assertNotDuplicate(params, cityId);

      return updateCity(server, cityId, params);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cities.list(server) });
    },
  });
};

/** 도시 삭제 mutation, 이미 삭제된 대상도 최신 목록으로 수렴하도록 성공 여부와 무관하게 무효화 */
export const useDeleteCityMutation = (server: CityServer) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cityId: string) => deleteCity(server, cityId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cities.list(server) });
    },
  });
};
