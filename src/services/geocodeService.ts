import { apiGet } from "@/lib/apiClient";
import type { GeocodeCandidate } from "@/types/city";

// 위치 검색 서비스, Next 서버의 내부 엔드포인트(/api/geocode)를 호출하고 후보 목록만 반환

/** 도시명과 alpha-3 국가코드로 위치 후보 조회, 사용자가 버튼을 누를 때만 호출 */
export const searchGeocode = (city: string, country: string): Promise<GeocodeCandidate[]> =>
  apiGet<GeocodeCandidate[]>(`/api/geocode?${new URLSearchParams({ city, country }).toString()}`);
