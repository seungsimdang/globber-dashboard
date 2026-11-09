import type { City } from "@/types/city";

const normalize = (text: string): string => text.trim().toLowerCase();

/** 도시명과 국가명 쌍이 같은 도시를 찾음, 앞뒤 공백 제거와 대소문자 무시, excludeId는 수정 중인 자기 자신 제외 */
export const findDuplicateCity = (
  cities: City[],
  target: { cityName: string; countryName: string },
  excludeId?: string,
): City | undefined => {
  const cityName = normalize(target.cityName);
  const countryName = normalize(target.countryName);

  return cities.find(
    (city) =>
      city.id !== excludeId &&
      normalize(city.name) === cityName &&
      normalize(city.country) === countryName,
  );
};
