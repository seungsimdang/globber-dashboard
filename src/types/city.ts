/**
 * 도시 관리 대시보드의 도시 관련 타입 정의.
 *
 * 실제 백엔드 API는 아직 개발 중이라 현재는 목업 서비스 레이어(`src/services/cityService.ts`)가
 * 이 타입들을 그대로 사용해 인메모리 데이터를 다룬다. 실제 API가 준비되면 서비스 내부 구현만
 * 교체하면 되도록, 아래 타입은 실제(예상) 백엔드 계약(`artifacts/task-team/api-spec.md`)과
 * 동일하게 유지한다.
 */

/** 백엔드 API가 반환하는 단일 도시 데이터. */
export type CityApiData = {
  cityId: number;
  cityName: string;
  countryName: string;
  lat: number;
  lng: number;
  countryCode: string;
};

/** GET /api/v1/cities/favorites 응답 (전체 목록 조회). */
export type CityApiResponse = {
  cityResponseList: CityApiData[];
};

/** GET /api/v1/cities?keyword= 응답 (검색). */
export type CitySearchResponse = {
  cities: CityApiData[];
};

/** 프론트엔드 컴포넌트/훅에서 사용하는 도시 타입. */
export type City = {
  id: string;
  name: string;
  country: string;
  flag: string;
  lat: number;
  lng: number;
  countryCode: string;
  selected?: boolean;
};

/** POST /api/v1/cities 요청 (도시 추가). */
export type AddCityRequest = {
  cityName: string;
  countryName: string;
  lat: number;
  lng: number;
  countryCode: string;
};

/** POST /api/v1/cities 응답 (도시 추가). */
export type AddCityResponse = {
  status: string;
  data: CityApiData;
};

/**
 * PUT /api/v1/cities/{cityId} 요청 (도시 수정).
 *
 * 원본 저장소(17th-team1-client)에는 수정 엔드포인트가 존재하지 않아, 이 대시보드용으로
 * `AddCityRequest`와 대칭되는 형태로 신규 확정한 계약이다(api-spec.md §1.4 참고).
 */
export type UpdateCityRequest = {
  cityName: string;
  countryName: string;
  lat: number;
  lng: number;
  countryCode: string;
};

/** PUT /api/v1/cities/{cityId} 응답 (도시 수정). */
export type UpdateCityResponse = {
  status: string;
  data: CityApiData;
};

/** DELETE /api/v1/cities/{cityId} 요청 (도시 삭제). path param으로만 사용되며 별도 body는 없다. */
export type DeleteCityRequest = {
  cityId: number;
};

/** DELETE /api/v1/cities/{cityId} 응답 (도시 삭제). 삭제 직전 데이터를 담는다. */
export type DeleteCityResponse = {
  status: string;
  data: CityApiData;
};
