# 도시 API 계약 참조 (실제 Globber API, Swagger 기준)

이 문서는 실제 Globber 백엔드의 OpenAPI(Swagger) 스펙 중 도시 관련 부분을 옮긴 것이다.
스냅샷 원본은 `artifacts/task-team/openapi-snapshot.json`이며, 이 대시보드는 아래 계약을
Next 서버 경유(`/api/cities*` Route Handler)로 호출한다. 브라우저는 상류 주소를 알지 못한다.

상세 설계와 에러 매핑은 `artifacts/task-team/api-spec.md`를 따른다.

## 응답 래퍼

```typescript
type ApiSuccess<T> = { status: string; data: T };
type ApiFail = { status: "fail"; data: string }; // data = 메시지
```

## 타입

```typescript
// 응답 (CityResponse)
type CityResponse = {
  cityId: number;
  cityName: string;
  countryName: string;
  lat: number;
  lng: number;
  countryCode: string; // ISO 3166-1 alpha-3
};

// 요청 (CityRequest) - 필수 5개
type CityRequest = {
  cityName: string;
  countryName: string;
  lat: number; // -90 ~ 90
  lng: number; // -180 ~ 180
  countryCode: string; // ^[A-Z]{3}$
};
```

## 사용하는 상류 엔드포인트

| 동작 | 메서드 | 경로 | 요청 | 성공 `data` | 토큰 |
| --- | --- | --- | --- | --- | --- |
| 전체 목록 | GET | `/api/v1/cities/all` | - | `CityResponse[]` | 불필요 |
| 도시 추가 | POST | `/api/v1/cities` | `CityRequest` | `CityResponse` | 필수 |
| 도시 수정 | PUT | `/api/v1/cities/{cityId}` | `CityRequest` | `CityResponse` | 필수 |
| 도시 삭제 | DELETE | `/api/v1/cities/{cityId}` | - | 삭제된 `CityResponse` | 필수 |
| 토큰 발급 | POST | `/dev/test-login?email=` | query `email` | `{ accessToken, refreshToken }` | - |

- 전체 목록은 페이지네이션 없이 전체를 반환하고 `Cache-Control: public, max-age=86400`과 ETag를 응답한다.
- 스펙에는 수정·삭제의 `Authorization`이 선택으로 적혀 있으나 실제로는 토큰 없이 401을 반환한다(서버 호출로 확인).
- `/dev/test-login`은 dev/local 환경 전용이다.
- 대시보드가 쓰지 않는 도시 엔드포인트: `GET /api/v1/cities?keyword=`(최대 20개 검색), `GET /api/v1/cities/findCity`, `GET /api/v1/cities/favorites`.

## `id` 필드 규칙

`City.id`는 `CityResponse.cityId`(number)를 문자열로 변환한 값이다.

## flag 매핑

`countryCode`(alpha-3)를 alpha-2로 바꾼 뒤 국기 이모지를 계산한다(`src/utils/countryFlagMapping.ts`).

## 미확인 사항

- 일반 회원(test-login) 토큰으로 쓰기가 허용되는지
- `accessToken` 만료 시간과 `Bearer ` 접두사 포함 여부
- 중복 도시 추가, 없는 id 수정·삭제 시 상류의 상태 코드와 메시지
