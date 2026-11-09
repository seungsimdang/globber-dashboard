"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { citiesQueryOptions } from "@/hooks/useCities";
import { queryKeys } from "@/lib/react-query/query-keys";
import { addCity, deleteCity, updateCity } from "@/services/cityService";
import type { CityRequest } from "@/types/city";
import { findDuplicateCity } from "@/utils/cityDuplicate";

export const DUPLICATE_CITY_MESSAGE = "이미 등록된 도시입니다.";

// 목록 캐시가 있을 때만 중복 사전 검사, 없으면 서버 판단에 맡김
const useAssertNotDuplicate = () => {
  const queryClient = useQueryClient();

  return (params: CityRequest, excludeId?: string) => {
    const cities = queryClient.getQueryData(citiesQueryOptions().queryKey);

    if (cities && findDuplicateCity(cities, params, excludeId)) {
      throw new Error(DUPLICATE_CITY_MESSAGE);
    }
  };
};

/** 도시 추가 mutation, 성공 시 목록 쿼리 무효화 */
export const useAddCityMutation = () => {
  const queryClient = useQueryClient();
  const assertNotDuplicate = useAssertNotDuplicate();

  return useMutation({
    mutationFn: (params: CityRequest) => {
      assertNotDuplicate(params);

      return addCity(params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cities.all });
    },
  });
};

/** 도시 수정 mutation, 대상 없음 등 실패에도 목록을 최신화하려고 성공 여부와 무관하게 무효화 */
export const useUpdateCityMutation = () => {
  const queryClient = useQueryClient();
  const assertNotDuplicate = useAssertNotDuplicate();

  return useMutation({
    mutationFn: ({ cityId, params }: { cityId: string; params: CityRequest }) => {
      assertNotDuplicate(params, cityId);

      return updateCity(cityId, params);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cities.all });
    },
  });
};

/** 도시 삭제 mutation, 이미 삭제된 대상도 최신 목록으로 수렴하도록 성공 여부와 무관하게 무효화 */
export const useDeleteCityMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cityId: string) => deleteCity(cityId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cities.all });
    },
  });
};
