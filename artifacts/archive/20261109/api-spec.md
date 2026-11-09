# T04 - API 명세서: 도시 관리 대시보드 (목업 기준)

## 0. 전제 및 범위

- **현재는 전부 목업이다.** `src/services/cityService.ts`는 아래 명세된 함수 시그니처를
  그대로 구현하되, 내부에서는 실제 네트워크 호출(`apiGet`/`apiPost`/`apiPut`/`apiDelete`) 대신
  `src/mocks/mockCities.ts`의 인메모리 저장소를 조작하고 `src/mocks/mockDelay.ts`로 지연을
  흉내낸다.
- 실제 백엔드 API가 준비되면 **`cityService.ts` 내부 구현만 실제 API 호출 코드로 교체**하면
  된다. 함수 시그니처(파라미터/반환 타입)는 유지되므로 이를 호출하는 컴포넌트/훅은 변경할
  필요가 없다.
- 아래 "실제(예상) 엔드포인트"는 원본 저장소(`17th-team1-client`)의 실제 계약
  (`src/types/city.ts`, `src/services/cityService.ts`)을 기준으로 하되, 목록 조회 경로는
  이 대시보드의 용도(전체 목록 관리)에 맞게 별도로 정리했고, 수정(PUT) 엔드포인트는 원본에
  존재하지 않아 이번 문서에서 신규로 확정한다.

---

## 1. 실제(예상) 엔드포인트 및 스키마

### 1.1 GET /api/v1/cities/favorites - 전체 목록 조회

원본 계약: `fetchCities()` → `GET /api/v1/cities/favorites`

**Query Params**: `CityApiParams` (`limit?`, `offset?`) - 이번 대시보드에서는 페이지네이션을
사용하지 않으므로(§확인 필요 참고) 파라미터 없이 호출한다.

**Response**
```ts
interface CityApiResponse {
  cityResponseList: CityApiData[];
}

interface CityApiData {
  cityId: number;
  cityName: string;
  countryName: string;
  lat: number;
  lng: number;
  countryCode: string;
}
```

### 1.2 GET /api/v1/cities?keyword= - 검색

원본 계약: `searchCities(keyword)` → `GET /api/v1/cities`

**Query Params**
```ts
interface CitySearchParams {
  keyword: string;
}
```

**Response**
```ts
interface CitySearchResponse {
  cities: CityApiData[];
}
```

- `keyword`가 빈 문자열이면 전체 목록과 동일한 결과를 반환한다(요구사항 F2).
- 대소문자 구분 없이 부분 문자열 포함 검색(요구사항 §5-5 기본값 채택).

### 1.3 POST /api/v1/cities - 추가

원본 계약: `addCity(request, token)` → `POST /api/v1/cities`

**Request Body**
```ts
interface AddCityRequest {
  cityName: string;
  countryName: string;
  lat: number;
  lng: number;
  countryCode: string;
}
```

**Response**
```ts
interface AddCityResponse {
  status: string;      // 예: "SUCCESS"
  data: CityApiData;
}
```

**에러 케이스**: 필수 필드 누락(400), 위경도 범위 초과(400), 도시명+국가명 중복(409 상당).

### 1.4 PUT /api/v1/cities/{cityId} - 수정 (신규 확정, 원본에 없음)

원본 저장소에는 수정 엔드포인트가 존재하지 않는다. `AddCityRequest`/`AddCityResponse`와
대칭되는 형태로 아래와 같이 확정한다 (requirements.md §5-1 제안 기본값을 그대로 채택).

**Path Param**: `cityId` (number, path segment)

**Request Body**
```ts
interface UpdateCityRequest {
  cityName: string;
  countryName: string;
  lat: number;
  lng: number;
  countryCode: string;
}
```

`AddCityRequest`와 필드 구성이 완전히 동일하다 - 도시 추가 시 입력받는 필드를 그대로
전량 교체(PUT, full replace)하는 방식으로 정의한다. 부분 수정(PATCH)은 이번 범위에서
고려하지 않는다.

**Response**
```ts
interface UpdateCityResponse {
  status: string;      // 예: "SUCCESS"
  data: CityApiData;
}
```

`AddCityResponse`와 형태가 동일하며, `data.cityId`는 경로의 `cityId`와 동일한 값이다.

**에러 케이스**:
- 존재하지 않는 `cityId` → 404 상당 ("대상을 찾을 수 없습니다")
- 필수 필드 누락 / 위경도 범위 초과 → 400 상당 (추가와 동일한 검증 규칙)
- 수정 결과가 자기 자신을 제외한 다른 도시와 도시명+국가명이 중복 → 409 상당

### 1.5 DELETE /api/v1/cities/{cityId} - 삭제

원본 계약: `deleteCity(cityId, token)` → `DELETE /api/v1/cities/{cityId}`

**Request**: `DeleteCityRequest`는 원본 서비스 함수에서는 path param(`cityId`)으로만
사용되고 별도 body는 없다.
```ts
type DeleteCityRequest = {
  cityId: number;
};
```

**Response**
```ts
interface DeleteCityResponse {
  status: string;      // 예: "SUCCESS"
  data: CityApiData;   // 삭제된 도시의 삭제 직전 데이터
}
```

**에러 케이스**: 존재하지 않는 `cityId` → 404 상당 ("대상을 찾을 수 없습니다").

---

## 2. `cityService.ts` 함수 시그니처 (프론트엔드 계약)

프론트엔드 컴포넌트/훅은 아래 시그니처만 알면 되고, 목업 → 실제 API 전환 시에도 이 시그니처는
유지된다. 원본 저장소의 `City` 타입(`id: string`, `name`, `country`, `flag`, `lat`, `lng`,
`countryCode`)으로 변환된 값을 반환한다 (`transformApiDataToCity` 대응 로직을
`src/utils/`에도 동일하게 둔다).

```ts
// src/services/cityService.ts

/** 등록된 전체 도시 목록을 조회한다. */
export const getCities = (): Promise<City[]> => { ... };

/** 도시명 기준으로 목록을 검색한다. keyword가 빈 문자열(공백 trim 후)이면 전체 목록과 동일. */
export const searchCities = (keyword: string): Promise<City[]> => { ... };

/** 새 도시를 추가한다. 실패 시 Error를 throw한다 (§3 에러 정책 참고). */
export const addCity = (params: AddCityRequest): Promise<City> => { ... };

/** 기존 도시를 수정한다. cityId는 City.id(string)를 그대로 전달한다. */
export const updateCity = (cityId: string, params: UpdateCityRequest): Promise<City> => { ... };

/** 도시를 삭제한다. 성공 시 별도 반환값 없음. */
export const deleteCity = (cityId: string): Promise<void> => { ... };
```

- 원본과 달리 목업 서비스에는 `token` 파라미터를 포함하지 않는다 - 이번 범위는 인증을
  다루지 않기 때문이다(요구사항 §4). 실제 API 전환 시 인증이 필요해지면 이 5개 함수의
  시그니처에 `token?: string` 등을 추가하는 변경이 필요할 수 있다 (요구사항 §5-6 권고 참고,
  "확인 필요" §4 참고).
- `cityId`를 `string`으로 받는 이유: 프론트엔드 `City.id`가 `string`이기 때문이다(원본
  `transformApiDataToCity`에서 `cityId.toString()` 변환). 서비스 내부에서 실제 API 호출 시
  `Number(cityId)`로 변환해 path param에 사용한다.
- 반환 타입은 API 응답 wrapper(`{status, data}`)를 벗기고 프론트엔드용 `City`(또는
  `City[]`)로 변환한 값이다. wrapper의 `status` 필드는 서비스 레이어에서 흡수하고, 실패 시
  `Error`를 throw하는 방식으로 통일한다(성공/실패를 `status` 문자열로 분기하지 않는다).

---

## 3. 목업 정책

### 3.1 지연 시뮬레이션

requirements.md §5-2의 project-manager 제안 기본값을 채택한다.

- 모든 요청(`getCities`, `searchCities`, `addCity`, `updateCity`, `deleteCity`)에
  **300~800ms 사이 랜덤 지연**을 적용한다.
- 지연은 `src/mocks/mockDelay.ts`의 공통 유틸(`mockDelay(): Promise<void>`)로 구현하고,
  각 서비스 함수는 검증/쓰기 완료 후 반환 직전에 `await mockDelay()`를 호출한다.

### 3.2 에러 시뮬레이션

requirements.md §5-2 기본값을 채택한다.

- **조회(`getCities`, `searchCities`)**: 실패 시뮬레이션 없음. 항상 성공한다.
- **추가/수정/삭제**: 순수 랜덤 서버 오류(예: 5% 확률 500)는 기본값에 포함하지 않는다.
  아래 **결정적(deterministic) 비즈니스 규칙 위반**에 대해서만 에러를 던진다.

| 함수 | 에러 조건 | 에러 메시지(예시) |
| --- | --- | --- |
| `addCity` | 필수 필드 누락 | `"필수 항목을 모두 입력해주세요."` |
| `addCity` | 위도 범위(-90~90) 초과 | `"위도는 -90에서 90 사이여야 합니다."` |
| `addCity` | 경도 범위(-180~180) 초과 | `"경도는 -180에서 180 사이여야 합니다."` |
| `addCity` | 국가코드 형식(ISO 3166-1 alpha-2) 오류 | `"국가 코드는 2자리 대문자 형식이어야 합니다."` |
| `addCity` | 도시명/국가명 길이 초과(100자, 보안 리뷰 권고로 추가) | `` "도시명과 국가명은 100자 이하여야 합니다." `` |
| `addCity` | 도시명+국가명 중복 | `"이미 등록된 도시입니다."` |
| `updateCity` | 존재하지 않는 `cityId` | `"대상을 찾을 수 없습니다."` |
| `updateCity` | 필수 필드 누락 / 위경도 범위 / 국가코드 형식 | `addCity`와 동일 |
| `updateCity` | 수정 결과가 자기 자신 제외 다른 도시와 중복 | `"이미 등록된 도시입니다."` |
| `deleteCity` | 존재하지 않는 `cityId` | `"대상을 찾을 수 없습니다."` |

- 검증과 인메모리 저장소 쓰기는 **지연(`mockDelay`) 이전에 동기적으로** 완료한다
  (requirements.md §3 동시성 원칙 - 검증 → 쓰기 → 지연 순서를 지켜 경쟁 조건을 방지).
- 에러는 일반 `Error` 인스턴스로 throw하며, 서비스 함수를 호출하는 쪽(훅/컴포넌트)이
  `error.message`를 사용자에게 표시할 수 있게 한다.
- `id` 발급: 저장소 내 현재 최대 `cityId` + 1 (또는 모듈 스코프 단조 증가 카운터)로 처리한다.

### 3.3 검색 매칭 규칙

- 대소문자 구분 없이(`toLowerCase()` 비교) `cityName`에 `keyword`가 부분 문자열로 포함되는지
  확인한다.
- `keyword`를 trim한 결과가 빈 문자열이면 전체 목록을 반환한다.

---

## 4. 확인 필요 (T04 시점 기준)

1. **실제 백엔드 PUT 엔드포인트 확정 여부**: 이 문서의 `PUT /api/v1/cities/{cityId}`는
   추론된 제안이다. 실제 백엔드 팀이 다른 경로/필드명으로 확정할 경우 목업 계약과 실제 계약이
   달라질 수 있으므로, 실제 API 준비 시점에 재확인이 필요하다.
2. **인증 토큰 처리 방식**: 원본 `addCity`/`deleteCity`는 `token` 파라미터를 받으나, 이번
   목업 서비스 시그니처에서는 제외했다. 실제 API 전환 시 인증이 요구되면 5개 함수 시그니처에
   토큰 파라미터(또는 별도 인증 컨텍스트 주입 방식)를 추가하는 변경이 필요하다.
3. **`getCities`가 호출할 실제 엔드포인트**: 원본 `fetchCities`는
   `/api/v1/cities/favorites` (즐겨찾기 목록으로 추정)를 사용하는데, 이 대시보드는 "전체 도시
   관리"가 목적이라 의미가 다를 수 있다. 실제 백엔드에 전체 목록 조회용 별도 엔드포인트가
   있는지 확인이 필요하다 (현재는 동일 경로를 목업 응답 스키마 참고용으로만 사용).
4. **페이지네이션/정렬**: requirements.md §5-3 기본값(정렬 없음, 페이지네이션 없음)을
   목업 스펙에서도 그대로 따른다 - `CityApiParams`의 `limit`/`offset`은 이번 목업 구현에서는
   사용하지 않는다.
