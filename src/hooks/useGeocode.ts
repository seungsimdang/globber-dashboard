"use client";

import { useMutation } from "@tanstack/react-query";
import { searchGeocode } from "@/services/geocodeService";

// 클릭 때만 호출하는 폼 보조 값이라 캐시 키 없이 mutation 상태로 다루며 서버 데이터를 바꾸지 않아 무효화할 쿼리 없음
export const useGeocode = () =>
  useMutation({
    mutationFn: ({ city, country }: { city: string; country: string }) => searchGeocode(city, country),
  });
