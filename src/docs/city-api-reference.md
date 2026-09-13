# 도시 API 계약 참조 (17th-team1-client 원본)

이 문서는 실제 Globber 클라이언트 저장소(`../17th-team1-client`)에 정의된 도시 관련
타입/서비스 계약을 그대로 옮긴 것이다. 실제 백엔드 API는 아직 개발 중이므로, 이
대시보드는 아래 계약과 동일한 시그니처의 **목업 서비스 레이어**로 동작한다. 실제 API가
준비되면 `src/services/cityService.ts` 내부 구현만 교체하면 되도록 이 계약을 그대로 따른다.

원본 위치: `../17th-team1-client/src/types/city.ts`, `../17th-team1-client/src/services/cityService.ts`

## 타입 (`src/types/city.ts`)

```typescript
// 백엔드 API 응답 타입
export interface CityApiResponse {
  cityResponseList: CityApiData[];
}

export interface CityApiData {
  cityId: number;
  cityName: string;
  countryName: string;
  lat: number;
  lng: number;
  countryCode: string;
}

// 프론트엔드에서 사용하는 도시 타입
export interface City {
  id: string;
  name: string;
  country: string;
  flag: string;
  lat: number;
  lng: number;
  countryCode: string;
  selected?: boolean;
}

// 도시 추가 API 요청/응답
export interface AddCityRequest {
  cityName: string;
  countryName: string;
  lat: number;
  lng: number;
  countryCode: string;
}

export interface AddCityResponse {
  status: string;
  data: CityApiData;
}

// 도시 삭제 API 요청/응답
export type DeleteCityRequest = { cityId: number };

export interface DeleteCityResponse {
  status: string;
  data: CityApiData;
}
```

## 실제 엔드포인트 (17th-team1-client `cityService.ts` 기준)

| 동작 | 메서드 | 경로 | 비고 |
| --- | --- | --- | --- |
| 즐겨찾기 도시 목록 | GET | `/api/v1/cities/favorites` | `CityApiResponse` 반환 |
| 도시 검색 | GET | `/api/v1/cities?keyword=` | `CitySearchResponse` 반환 |
| 도시 추가 | POST | `/api/v1/cities` | 인증 토큰 필요, `AddCityRequest` |
| 도시 삭제 | DELETE | `/api/v1/cities/{cityId}` | 인증 토큰 필요 |
| **도시 수정** | **미정** | **`PUT /api/v1/cities/{cityId}` (예상)** | 원본 저장소에 아직 없음 - 이 대시보드용으로 추가 계약과 대칭되는 형태로 추론해 사용한다(backend-developer가 `api-spec.md`에 확정) |

## `id` 필드 규칙

`City.id`는 `CityApiData.cityId`(number)를 문자열로 변환한 값이다
(`transformApiDataToCity`: `apiData.cityId.toString()`). 목업 구현도 동일한 변환을 거친다.

## flag 매핑

`countryCode` → 국기 이모지는 `COUNTRY_CODE_TO_FLAG` 매핑을 통해 계산된다
(`17th-team1-client/src/constants/countryMapping.ts`, `src/utils/countryFlagMapping.ts`).
이 대시보드는 자체 축소 매핑 또는 간단한 라이브러리로 동일한 역할을 하는
유틸리티를 별도로 둔다 (실제 매핑 테이블을 그대로 복사할 필요는 없다).
