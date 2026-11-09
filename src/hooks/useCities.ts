"use client";

import { useMemo } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/query-keys";
import { getCities } from "@/services/cityService";
import { filterCities } from "@/utils/cityFilter";

// 전체 목록 조회 쿼리 옵션, 검색은 같은 캐시를 클라이언트에서 필터링
export const citiesQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.cities.list,
    queryFn: getCities,
  });

/** 도시 목록 조회, cities는 검색어로 필터링한 결과이고 totalCount는 전체 건수 */
export const useCities = (keyword: string) => {
  const { data, ...query } = useQuery(citiesQueryOptions());
  const cities = useMemo(() => filterCities(data ?? [], keyword), [data, keyword]);

  return { ...query, cities, totalCount: data?.length ?? 0 };
};
