import type { CityApiData } from "@/types/city";

/**
 * 도시 관리 대시보드의 인메모리 목업 데이터 저장소.
 *
 * 실제 DB가 없으므로 모듈 스코프의 단일 배열로 상태를 관리한다. JS는 단일 스레드이므로,
 * 이 파일이 노출하는 조작 함수들은 모두 동기적으로 검증과 쓰기를 완료한다 - 지연/에러
 * 시뮬레이션(`mockDelay`)은 반드시 이 함수 호출이 끝난 뒤 서비스 레이어(`cityService.ts`)에서
 * 적용해야 경쟁 조건 없이 유일성이 보장된다(requirements.md §3 참고).
 */

type CityInput = Omit<CityApiData, "cityId">;

const initialCities: CityApiData[] = [
  { cityId: 1, cityName: "Seoul", countryName: "South Korea", lat: 37.5665, lng: 126.978, countryCode: "KR" },
  { cityId: 2, cityName: "Tokyo", countryName: "Japan", lat: 35.6762, lng: 139.6503, countryCode: "JP" },
  { cityId: 3, cityName: "Paris", countryName: "France", lat: 48.8566, lng: 2.3522, countryCode: "FR" },
  { cityId: 4, cityName: "New York", countryName: "United States", lat: 40.7128, lng: -74.006, countryCode: "US" },
  { cityId: 5, cityName: "London", countryName: "United Kingdom", lat: 51.5074, lng: -0.1278, countryCode: "GB" },
  { cityId: 6, cityName: "Rome", countryName: "Italy", lat: 41.9028, lng: 12.4964, countryCode: "IT" },
  { cityId: 7, cityName: "Barcelona", countryName: "Spain", lat: 41.3851, lng: 2.1734, countryCode: "ES" },
  { cityId: 8, cityName: "Sydney", countryName: "Australia", lat: -33.8688, lng: 151.2093, countryCode: "AU" },
  { cityId: 9, cityName: "Toronto", countryName: "Canada", lat: 43.6532, lng: -79.3832, countryCode: "CA" },
  { cityId: 10, cityName: "Berlin", countryName: "Germany", lat: 52.52, lng: 13.405, countryCode: "DE" },
  { cityId: 11, cityName: "Bangkok", countryName: "Thailand", lat: 13.7563, lng: 100.5018, countryCode: "TH" },
  { cityId: 12, cityName: "Singapore", countryName: "Singapore", lat: 1.3521, lng: 103.8198, countryCode: "SG" },
  { cityId: 13, cityName: "Amsterdam", countryName: "Netherlands", lat: 52.3676, lng: 4.9041, countryCode: "NL" },
  { cityId: 14, cityName: "Rio de Janeiro", countryName: "Brazil", lat: -22.9068, lng: -43.1729, countryCode: "BR" },
  { cityId: 15, cityName: "Istanbul", countryName: "Turkey", lat: 41.0082, lng: 28.9784, countryCode: "TR" },
];

let cities: CityApiData[] = initialCities.map((city) => ({ ...city }));
let nextCityId = initialCities.length + 1;

/** 등록된 전체 도시 목록을 반환한다(원본 배열이 아닌 복사본). */
export const getAllMockCities = (): CityApiData[] => cities.map((city) => ({ ...city }));

/**
 * 도시명 기준으로 대소문자 구분 없이 부분 문자열 검색을 수행한다.
 * keyword를 trim한 결과가 빈 문자열이면 전체 목록을 반환한다.
 */
export const searchMockCities = (keyword: string): CityApiData[] => {
  const trimmedKeyword = keyword.trim().toLowerCase();

  if (!trimmedKeyword) {
    return getAllMockCities();
  }

  return cities
    .filter((city) => city.cityName.toLowerCase().includes(trimmedKeyword))
    .map((city) => ({ ...city }));
};

/** cityId로 도시를 조회한다. 없으면 undefined. */
export const findMockCityById = (cityId: number): CityApiData | undefined => {
  const found = cities.find((city) => city.cityId === cityId);

  return found ? { ...found } : undefined;
};

/**
 * 도시명 + 국가명 조합의 중복 여부를 확인한다(대소문자 무관).
 * excludeCityId를 지정하면 해당 id는 비교 대상에서 제외한다(수정 시 자기 자신 제외용).
 */
export const isDuplicateCityName = (
  cityName: string,
  countryName: string,
  excludeCityId?: number,
): boolean => {
  const normalizedName = cityName.trim().toLowerCase();
  const normalizedCountry = countryName.trim().toLowerCase();

  return cities.some(
    (city) =>
      city.cityId !== excludeCityId &&
      city.cityName.toLowerCase() === normalizedName &&
      city.countryName.toLowerCase() === normalizedCountry,
  );
};

/** 새 도시를 저장소에 동기적으로 추가하고, 발급된 cityId를 포함한 데이터를 반환한다. */
export const addMockCity = (input: CityInput): CityApiData => {
  const newCity: CityApiData = { cityId: nextCityId, ...input };

  nextCityId += 1;
  cities = [...cities, newCity];

  return { ...newCity };
};

/** 기존 도시를 동기적으로 전량 교체(full replace)한다. 대상이 없으면 undefined. */
export const updateMockCity = (cityId: number, input: CityInput): CityApiData | undefined => {
  const index = cities.findIndex((city) => city.cityId === cityId);

  if (index === -1) {
    return undefined;
  }

  const updatedCity: CityApiData = { cityId, ...input };
  cities = [...cities.slice(0, index), updatedCity, ...cities.slice(index + 1)];

  return { ...updatedCity };
};

/** 도시를 동기적으로 삭제하고, 삭제 직전 데이터를 반환한다. 대상이 없으면 undefined. */
export const deleteMockCity = (cityId: number): CityApiData | undefined => {
  const index = cities.findIndex((city) => city.cityId === cityId);

  if (index === -1) {
    return undefined;
  }

  const [removed] = cities.slice(index, index + 1);
  cities = [...cities.slice(0, index), ...cities.slice(index + 1)];

  return { ...removed };
};

/**
 * 테스트 전용 리셋 유틸리티. 모듈 스코프 저장소(`cities`, `nextCityId`)를 초기 시드 데이터로
 * 되돌린다. 이 저장소가 모든 호출 간에 공유되므로(module-scope 배열), 테스트 간 격리를 위해
 * 각 테스트 전에 호출한다. 프로덕션 코드 경로에서는 참조되지 않는다.
 */
export const __resetMockCitiesForTest = (): void => {
  cities = initialCities.map((city) => ({ ...city }));
  nextCityId = initialCities.length + 1;
};
