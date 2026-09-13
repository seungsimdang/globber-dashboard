import {
  addMockCity,
  deleteMockCity,
  findMockCityById,
  getAllMockCities,
  isDuplicateCityName,
  searchMockCities,
  updateMockCity,
} from "@/mocks/mockCities";
import { mockDelay } from "@/mocks/mockDelay";
import type { AddCityRequest, City, CityApiData, UpdateCityRequest } from "@/types/city";
import { getCountryFlag } from "@/utils/countryFlagMapping";

/**
 * 도시 관리 대시보드의 도시 CRUD 서비스 레이어.
 *
 * 현재는 전부 목업이다 - 실제 네트워크 호출(`apiGet`/`apiPost`/`apiPut`/`apiDelete`) 대신
 * `src/mocks/mockCities.ts`의 인메모리 저장소를 조작하고 `mockDelay`로 지연을 흉내낸다.
 * 실제 백엔드 API가 준비되면 이 파일 내부 구현만 실제 API 호출 코드로 교체하면 되며, 아래
 * 5개 함수의 시그니처(파라미터/반환 타입)는 그대로 유지된다(artifacts/task-team/api-spec.md 참고).
 *
 * 검증 → 저장소 쓰기 → 지연(mockDelay) 순서를 반드시 지킨다. JS는 단일 스레드이므로 지연 이전에
 * 중복 검사와 쓰기를 동기적으로 완료하면 동시 요청 간 경쟁 조건 없이 유일성이 보장된다.
 */

const LATITUDE_MIN = -90;
const LATITUDE_MAX = 90;
const LONGITUDE_MIN = -180;
const LONGITUDE_MAX = 180;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

type CityInputFields = {
  cityName: string;
  countryName: string;
  lat: number;
  lng: number;
  countryCode: string;
};

const transformApiDataToCity = (apiData: CityApiData): City => ({
  id: apiData.cityId.toString(),
  name: apiData.cityName,
  country: apiData.countryName,
  flag: getCountryFlag(apiData.countryCode),
  lat: apiData.lat,
  lng: apiData.lng,
  countryCode: apiData.countryCode,
});

const hasMissingRequiredField = (input: CityInputFields): boolean => {
  const { cityName, countryName, lat, lng, countryCode } = input;

  if (!cityName?.trim() || !countryName?.trim() || !countryCode?.trim()) {
    return true;
  }

  return lat === undefined || lat === null || lng === undefined || lng === null || Number.isNaN(lat) || Number.isNaN(lng);
};

/** 도시 추가/수정 공통 입력 검증. 실패 시 api-spec.md §3.2 표의 메시지로 Error를 throw한다. */
const validateCityInput = (input: CityInputFields): void => {
  if (hasMissingRequiredField(input)) {
    throw new Error("필수 항목을 모두 입력해주세요.");
  }

  if (input.lat < LATITUDE_MIN || input.lat > LATITUDE_MAX) {
    throw new Error("위도는 -90에서 90 사이여야 합니다.");
  }

  if (input.lng < LONGITUDE_MIN || input.lng > LONGITUDE_MAX) {
    throw new Error("경도는 -180에서 180 사이여야 합니다.");
  }

  if (!COUNTRY_CODE_PATTERN.test(input.countryCode.trim())) {
    throw new Error("국가 코드는 2자리 대문자 형식이어야 합니다.");
  }
};

const toNormalizedCityInput = (input: CityInputFields): CityInputFields => ({
  cityName: input.cityName.trim(),
  countryName: input.countryName.trim(),
  lat: input.lat,
  lng: input.lng,
  countryCode: input.countryCode.trim().toUpperCase(),
});

/** 등록된 전체 도시 목록을 조회한다. */
export const getCities = async (): Promise<City[]> => {
  const cities = getAllMockCities().map(transformApiDataToCity);

  await mockDelay();

  return cities;
};

/** 도시명 기준으로 목록을 검색한다. keyword가 빈 문자열(공백 trim 후)이면 전체 목록과 동일. */
export const searchCities = async (keyword: string): Promise<City[]> => {
  const cities = searchMockCities(keyword).map(transformApiDataToCity);

  await mockDelay();

  return cities;
};

/** 새 도시를 추가한다. 실패 시 Error를 throw한다(api-spec.md §3.2 참고). */
export const addCity = async (params: AddCityRequest): Promise<City> => {
  validateCityInput(params);

  const normalized = toNormalizedCityInput(params);

  if (isDuplicateCityName(normalized.cityName, normalized.countryName)) {
    throw new Error("이미 등록된 도시입니다.");
  }

  const created = addMockCity(normalized);

  await mockDelay();

  return transformApiDataToCity(created);
};

/** 기존 도시를 수정한다. cityId는 City.id(string)를 그대로 전달한다. */
export const updateCity = async (cityId: string, params: UpdateCityRequest): Promise<City> => {
  const numericCityId = Number(cityId);

  if (!findMockCityById(numericCityId)) {
    throw new Error("대상을 찾을 수 없습니다.");
  }

  validateCityInput(params);

  const normalized = toNormalizedCityInput(params);

  if (isDuplicateCityName(normalized.cityName, normalized.countryName, numericCityId)) {
    throw new Error("이미 등록된 도시입니다.");
  }

  const updated = updateMockCity(numericCityId, normalized);

  if (!updated) {
    throw new Error("대상을 찾을 수 없습니다.");
  }

  await mockDelay();

  return transformApiDataToCity(updated);
};

/** 도시를 삭제한다. 성공 시 별도 반환값 없음. */
export const deleteCity = async (cityId: string): Promise<void> => {
  const numericCityId = Number(cityId);
  const deleted = deleteMockCity(numericCityId);

  if (!deleted) {
    throw new Error("대상을 찾을 수 없습니다.");
  }

  await mockDelay();
};
