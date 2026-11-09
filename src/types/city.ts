// 실제 도시 API 계약을 따르는 공용 타입, 클라이언트와 Route Handler 공용

/** 백엔드 API가 반환하는 단일 도시 데이터 */
export type CityApiData = {
  cityId: number;
  cityName: string;
  countryName: string;
  lat: number;
  lng: number;
  countryCode: string;
};

/** 프론트엔드 컴포넌트와 훅에서 쓰는 도시 타입 */
export type City = {
  id: string;
  name: string;
  country: string;
  flag: string;
  lat: number;
  lng: number;
  /** ISO 3166-1 alpha-3 */
  countryCode: string;
  selected?: boolean;
};

/** POST /api/cities, PUT /api/cities/{cityId} 요청 본문, 추가와 수정이 같은 구조 */
export type CityRequest = {
  cityName: string;
  countryName: string;
  /** -90 ~ 90 */
  lat: number;
  /** -180 ~ 180 */
  lng: number;
  /** ISO 3166-1 alpha-3 (^[A-Z]{3}$) */
  countryCode: string;
};

/** 성공 응답 래퍼, status는 "success"만 관측됨 */
export type ApiSuccess<T> = {
  status: string;
  data: T;
};

/** 실패 응답 래퍼, data는 화면에 표시 가능한 메시지 문자열 */
export type ApiFail = {
  status: "fail";
  data: string;
};

export type CityServer = "prod" | "dev";

/** 위치 검색 후보 한 건. Nominatim 응답을 그대로 노출하지 않고 이 필드만 반환한다 */
export type GeocodeCandidate = {
  /** Nominatim place_id를 문자열로 바꾼 값(목록 key 용도) */
  id: string;
  /** 표시명(accept-language=ko). 같은 표시명이 여러 건일 수 있다 */
  displayName: string;
  /** 위도 -90~90 */
  lat: number;
  /** 경도 -180~180 */
  lng: number;
  /** 행정구역 구분용 보조 텍스트(addressdetails의 state/county 등 조합). 없으면 null */
  region: string | null;
  /** jsonv2 type 값(예: city, administrative). 없으면 null */
  placeType: string | null;
};

export type GeocodeResponse = ApiSuccess<GeocodeCandidate[]>;

/** 실패 코드. 사유 문자열이 아니라 이 literal로 구분한다 */
export type GeocodeFailCode =
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "DISABLED"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_BAD_RESPONSE";

/** code가 없는 ApiFail(401 등)도 올 수 있으므로 소비자는 code를 optional로 읽는다 */
export type GeocodeFail = ApiFail & { code?: GeocodeFailCode };
