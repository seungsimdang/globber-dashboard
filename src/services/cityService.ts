import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/apiClient";
import type { City, CityApiData, CityRequest, CityServer } from "@/types/city";
import { getCountryFlag } from "@/utils/countryFlagMapping";

// 도시 CRUD 서비스, Next 서버의 내부 엔드포인트(/api/cities*)를 호출하고 도메인 타입만 반환

const transformApiDataToCity = (apiData: CityApiData): City => ({
  id: String(apiData.cityId),
  name: apiData.cityName,
  country: apiData.countryName,
  flag: getCountryFlag(apiData.countryCode),
  lat: apiData.lat,
  lng: apiData.lng,
  countryCode: apiData.countryCode,
});

// 필수값, 범위, 형식 검증은 서버 Route Handler와 폼이 담당하고 여기서는 정규화만 수행
const normalizeRequest = (params: CityRequest): CityRequest => ({
  cityName: params.cityName.trim(),
  countryName: params.countryName.trim(),
  lat: params.lat,
  lng: params.lng,
  countryCode: params.countryCode.trim().toUpperCase(),
});

/** 등록된 전체 도시 목록 조회 */
export const getCities = async (server: CityServer): Promise<City[]> => {
  const data = await apiGet<CityApiData[]>(`/api/cities?server=${server}`);

  return data.map(transformApiDataToCity);
};

/** 새 도시 추가 */
export const addCity = async (server: CityServer, params: CityRequest): Promise<City> => {
  const data = await apiPost<CityApiData>(
    `/api/cities?server=${server}`,
    normalizeRequest(params),
  );

  return transformApiDataToCity(data);
};

/** 기존 도시 수정, cityId는 City.id(string)를 그대로 전달 */
export const updateCity = async (
  server: CityServer,
  cityId: string,
  params: CityRequest,
): Promise<City> => {
  const data = await apiPut<CityApiData>(
    `/api/cities/${encodeURIComponent(cityId)}?server=${server}`,
    normalizeRequest(params),
  );

  return transformApiDataToCity(data);
};

/** 도시 삭제, 응답의 삭제된 도시 데이터는 버림 */
export const deleteCity = async (server: CityServer, cityId: string): Promise<void> => {
  await apiDelete<CityApiData>(`/api/cities/${encodeURIComponent(cityId)}?server=${server}`);
};
