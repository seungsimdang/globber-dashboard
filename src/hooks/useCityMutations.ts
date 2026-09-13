"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/query-keys";
import { addCity, deleteCity, updateCity } from "@/services/cityService";
import type { AddCityRequest, UpdateCityRequest } from "@/types/city";

/** 도시 추가 mutation. 성공 시 도시 목록 쿼리를 무효화해 즉시 갱신한다. */
export const useAddCityMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: AddCityRequest) => addCity(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cities.all });
    },
  });
};

/**
 * 도시 수정 mutation.
 *
 * 성공/실패와 무관하게 도시 목록 쿼리를 무효화한다 - 실패(대상 없음 등) 시에도 목록을
 * 최신 상태로 강제 refetch해야 하기 때문이다(design-spec.md §3.1).
 */
export const useUpdateCityMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cityId, params }: { cityId: string; params: UpdateCityRequest }) =>
      updateCity(cityId, params),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cities.all });
    },
  });
};

/**
 * 도시 삭제 mutation.
 *
 * 성공/실패와 무관하게 도시 목록 쿼리를 무효화한다 - 이미 삭제된 대상을 다시 삭제 시도하는
 * 경우에도 최신 목록으로 수렴해야 한다(design-spec.md §5-4).
 */
export const useDeleteCityMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cityId: string) => deleteCity(cityId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cities.all });
    },
  });
};
