import type { City } from "@/types/city";

// NFC 정규화, 모든 공백 제거, 소문자 변환
export const normalizeSearchText = (text: string): string =>
  text.normalize("NFC").replace(/\s+/g, "").toLowerCase();

/** 도시명 또는 국가명에 검색어가 포함된 도시만 서버 순서 그대로 반환, 정규화한 검색어가 비면 전체 반환 */
export const filterCities = (cities: City[], keyword: string): City[] => {
  const needle = normalizeSearchText(keyword);

  if (!needle) return cities;

  return cities.filter(
    (city) =>
      normalizeSearchText(city.name).includes(needle) ||
      normalizeSearchText(city.country).includes(needle),
  );
};
