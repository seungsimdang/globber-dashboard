"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/query-keys";
import { getCities, searchCities } from "@/services/cityService";
import type { City } from "@/types/city";

/**
 * 도시 목록 조회 쿼리 옵션 팩토리.
 *
 * `keyword`가 비어 있으면(공백 trim 후) 전체 목록(`getCities`)을, 그렇지 않으면 검색
 * (`searchCities`)을 호출한다. 컴포넌트에서 인라인 `queryKey`/`queryFn`을 만들지 않도록
 * 이 팩토리를 통해서만 쿼리를 구성한다.
 */
export const citiesQueryOptions = (keyword: string) => {
  const trimmedKeyword = keyword.trim();

  return queryOptions({
    queryKey: queryKeys.cities.list(trimmedKeyword),
    queryFn: (): Promise<City[]> =>
      trimmedKeyword ? searchCities(trimmedKeyword) : getCities(),
  });
};

/** 도시 목록/검색 결과를 조회하는 훅. */
export const useCities = (keyword: string) => useQuery(citiesQueryOptions(keyword));
