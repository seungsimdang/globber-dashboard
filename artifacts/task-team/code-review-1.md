# code-review-1 (T07)

범위: `git diff 940c8a1..HEAD` (ad528b0, 1fb9f69, db8e705). 코드는 수정하지 않았고 실서버 호출과 전체 테스트 재실행은 하지 않았다. lint/type-check/test/build 통과는 오케스트레이터가 전달한 사실을 그대로 따른다.

## 1차 판정: 통과 (Critical/High 없음, Medium 1건·Low 5건은 후속 정리 권장)

## 핵심 확인: cityErrorMessage.ts 문구 분기 vs 서버 실제 메시지

`src/utils/cityErrorMessage.ts:12-23`의 분기를 서버 메시지와 대조했다. 불일치 없음.

| 서버 메시지 (위치) | 상태 | 클라이언트 분류 | 근거 |
| --- | --- | --- | --- |
| `서버 인증에 실패했습니다.` (cityUpstream.ts:75, 상류 401/토큰 재시도 실패/발급 실패) | 502 | auth | `startsWith("서버 인증에 실패")` 일치 |
| `서버 설정 오류: 도시 API 주소가...`, `...테스트 계정이...` (cityApiToken.ts:15,24) | 500 | config | `startsWith("서버 설정 오류")` 일치 |
| `도시 서버에 연결할 수 없습니다.` (cityUpstream.ts:74, 연결 실패·비 JSON·형태 불일치) | 502 | network | `includes("연결할 수 없습니다")` 일치 |
| `도시 서버 응답이 지연되고 있습니다.` (cityUpstream.ts:143, 타임아웃) | 504 | network | `includes("지연")` 일치 |
| `도시 서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.` (상류 5xx) | 502 | server | 위 어느 접두어/포함어도 없음 |

- 서버 메시지 어디에도 "지연" 또는 "연결할 수 없습니다"가 server/auth/config 문구에 섞여 있지 않아 오분류 경로가 없다. 앞쪽 접두어 검사가 먼저라 포함어 검사와 충돌하지 않는다.
- `withSession`의 401 `로그인이 필요합니다.`는 4xx라 client로 분류되고 apiClient가 `/login`으로 이동시킨다. 의도와 일치.
- 한계(Low, 아래 L2): 분류가 한국어 문자열 일치라 한쪽만 바뀌면 조용히 깨진다. 현재는 결합을 보호하는 테스트가 없다.

## 구현 기록 "리뷰 확인 필요" 판정

### implementation-1 (서버)

1. 타입 이름 `CityApiData` vs `CityResponse`: 타당. 서버 코드는 `ApiFail/ApiSuccess/CityRequest`만 import한다(cityUpstream.ts:3). 다만 병합 결과 `src/types/city.ts:4,14`에 같은 타입이 두 이름으로 존재하고 `CityResponse`는 어디서도 import되지 않는다(코드 참조는 `src/docs/city-api-reference.md` 문서뿐). M1로 올림.
2. 비 401 4xx는 상태 유지, 3xx 등은 502: 타당. cityUpstream.ts:96-114에서 4xx는 상태·상류 메시지(500자 절단)를 유지하고 나머지는 502. 상류 메시지를 그대로 사용자에게 보이는 점은 api-spec 4절을 따른 것이다.
3. GET이 401이면 재시도 없이 502: 타당. 조회는 `authenticated: false`(route.ts:6)이고 cityUpstream.ts:96이 401을 AUTH_FAIL로 매핑한다. 토큰이 필요 없는 엔드포인트라 재시도가 무의미하다.
4. `Bearer ` 접두사 방어 분기: 타당. cityApiToken.ts:62-63. 실서버 미검증이지만 어느 쪽 형식이든 안전하게 동작한다.
5. 성공 시 `data` 통과, status 항상 `"success"`: 타당. 배열/객체 형태만 확인(cityUpstream.ts:86-92). 필드 단위 검증이 없어 상류 필드가 바뀌면 클라이언트 `transformApiDataToCity`에서 undefined가 조용히 흐르지만, 이 프록시의 범위에서는 허용 가능하다.
6. 전역 `RouteContext` 헬퍼: 타당. `[cityId]/route.ts:4`가 typegen 타입을 쓰고 type-check를 통과했다.

### implementation-2 (프론트)

1. `cityErrorMessage.ts` 신규 추가와 서버 메시지 의존: 타당(위 표로 일치 확인). 파일 추가 자체는 문구 단일화 규칙(project-structure 4번)에 부합한다. 결합 보호 테스트 부재는 L2.
2. 목록 조회 실패에서 auth/config를 일반 서버 문구로 묶음: 타당. cityErrorMessage.ts:34-36, 사용자에게 내부 설정 정보를 노출하지 않는 쪽이라 오히려 안전하다.
3. 삭제 설정 오류 문구 변형: 타당. cityErrorMessage.ts:48, 쓰기 문구와 동일 구조.
4. 중복 강조 `formError === DUPLICATE_CITY_MESSAGE`: 부분 타당. CityFormModal.tsx:100은 클라이언트 사전 검사 문구와 정확 일치할 때만 강조한다. 서버(상류)가 400으로 중복을 거부할 때의 실제 메시지가 이 문구와 같은지 확인된 바 없다(implementation-1 확인 못한 것: 중복 시 상류 상태 코드 미확인). 서버 중복 거부는 배너만 뜨고 테두리 강조는 안 될 수 있다. Low(L3).
5. `useCities` 반환 형태 변경: 타당. 사용처는 CitiesPageContent.tsx:31 하나뿐.
6. 401 시 `new URL("/login", origin).href`: 타당. apiClient.ts:34. 다만 리다이렉트 직후에도 `ApiError`를 던져 토스트/배너가 순간 표시될 수 있고, 목록 쿼리는 React Query 기본 재시도로 이동 전까지 반복 호출될 수 있다. 이동 후 페이지가 사라지므로 영향은 미미(Low, L5).
7. `eslint-disable react-hooks/incompatible-library`: 타당. CityListTable.tsx:51. 한 줄 예외이고 사유 주석이 있다. virtualizer 반환값을 메모이즈 자식에 넘기지 않아 위험 없음.
8. `h-screen`: 타당. 임의값 없이 남은 높이를 얻는 표준 클래스. 단 `CitiesPageContent.tsx:47`의 클래스 순서(`w-full h-screen max-w-5xl`)가 일관되지 않을 뿐 기능 문제 없음.
9. 테스트 갱신 범위: 타당. 서비스 테스트의 검증 단언이 사라진 것은 검증이 서버 Route Handler로 이동했기 때문이다. 그러나 이동한 `parseCityRequest`, `parseCityId`, 토큰 재시도, 에러 매핑을 검증하는 테스트가 서버 쪽에는 전혀 없다(tests/ 아래 `src/lib/server`, `src/app/api` 대응 파일 없음). M2로 올림.

## 지시된 개별 확인 결과

- 타입 이름 일관성: `docs/agent-rules/project-structure.md:26`이 가리키는 `CityApiData`는 `src/types/city.ts:4`에 존재하므로 "존재하지 않는 이름" 문제는 없다. 반대로 `CityResponse` 별칭이 중복 export로 남아 있다(M1).
- 사이클 한정 식별자 인용: 소스(`src/`)에는 F-xx, B-x, A-x, finding, 게이트 ID 인용 없음. 확인한 잔여분은 아래와 같다.
  - `src/types/city.ts:1` 주석이 `artifacts/task-team/api-spec.md 1절`을 인용, `src/docs/city-api-reference.md:4,7`도 `artifacts/task-team/` 파일을 가리킨다. 산출물 폴더는 사이클마다 바뀔 수 있고 `globals.css`가 artifacts를 소스에서 제외하므로 경로가 영구 보장되지 않는다(L4).
  - `tests/` 제목의 `F1~F5`는 기준 커밋 940c8a1에도 이미 있던 기능 ID로 이번 변경 도입분이 아니다. 이번 사이클의 신규 식별자 도입은 없다.
- 수정 시 자기 제외 중복 검사: 정상. `findDuplicateCity`가 `city.id !== excludeId`로 자기 자신을 제외하고(cityDuplicate.ts:15) `useUpdateCityMutation`이 `cityId`를 전달한다(useCityMutations.ts:49). `City.id`와 `cityId`가 모두 문자열이라 비교 형식도 맞다. 캐시가 없으면 건너뛰고 서버 판단에 맡기는 설계도 일관됨.
- 삭제 다이얼로그 유지: 정상. DeleteConfirmDialog.tsx:36-47은 404만 `onOpenChange(false)`, 나머지는 토스트만 띄우고 유지한다. pending 중 닫기도 막는다(DeleteConfirmDialog.tsx:54).
- 가상 스크롤: 정상. `count`가 `showRows ? length : 0`, 위아래 spacer, `measureElement`+`data-index`, 검색어 변경 시 `scrollTop=0` 모두 맞다. 사소한 점은 spacer `tr`이 마지막 자식이 되어 `last:border-b-0`가 실제 마지막 데이터 행에 적용되지 않는 경우가 있다(스타일, 브라우저 미확인, 판정에서 제외).
- 401 리다이렉트: 정상. `withSession`이 세션 없으면 401, apiClient가 `/login`으로 이동. `src/proxy.ts`의 matcher가 `api`를 제외하므로 `withSession`이 유일한 방어선이라는 주석(withSession.ts:2)도 실제와 일치.
- 데드코드·미사용 export: M1, L1 참조. 목업 3개 파일(mockCities, mockDelay, 목업 테스트)은 깨끗이 삭제됨, 잔여 import 없음.
- 이미 확인된 사실(HKR/ZYC 자리표시 항목, 나머지 61개 코드 매핑 완료)은 재검증하지 않고 인정한다. 자리표시 항목은 폼에서 수정 가능하며 국가코드 `HKR`이 3자 대문자라 검증을 통과한다. 데이터 정리는 이 변경 범위 밖.

## Findings

### Medium

- M1. `src/types/city.ts:4,13-14` 및 `docs/agent-rules/project-structure.md:26`: 같은 타입이 `CityApiData`와 `CityResponse` 두 이름으로 존재하고 `CityResponse`는 코드에서 미사용. 프로젝트 규칙 "미사용 export 즉시 제거"(project-structure.md 5번) 위반이며 이름 혼선의 원인이다. 수정 방향: 하나만 남긴다. 서비스·문서가 이미 `CityApiData`를 쓰므로 `CityResponse` 별칭 제거, 그리고 `src/docs/city-api-reference.md`의 `CityResponse` 표기를 `CityApiData`로 맞추거나 반대로 일괄 개명한다(양쪽 중 하나로 통일).
- M2. `tests/` 전체: 이번에 서버로 이동한 규칙(`parseCityRequest` 필수·범위·alpha-3, `parseCityId`, 토큰 1회 재시도·동시 발급 합류, 상류 상태 코드 매핑)과 `cityErrorMessage`의 서버 문구 분기를 검증하는 테스트가 없다. 기존 서비스 테스트의 검증 단언을 지웠으므로 검증 범위가 순감했다. 수정 방향: `tests/lib/server/cityUpstream.test.ts`에서 `parseCityRequest`와 `proxyCityApi`(fetch 스텁)를 실제 소스 import로 검증하고, `tests/utils/cityErrorMessage.test.ts`에서 서버가 실제로 쓰는 메시지 상수를 통해 분류를 검증한다. 실서버 호출은 하지 않는다.

### Low

- L1. `src/utils/cityFilter.ts:4`의 `normalizeSearchText`, `src/utils/cityErrorMessage.ts:5`의 `ErrorContext`는 export되지만 파일 밖에서 쓰이지 않는다. 수정 방향: export 제거(M1과 같은 규칙).
- L2. `src/utils/cityErrorMessage.ts:12-14`와 `src/lib/server/cityUpstream.ts:74-75`, `cityApiToken.ts:15,24`: 서버 메시지 문자열을 클라이언트가 접두어/포함어로 해석하는 암묵 결합. 현재는 일치하나 한쪽을 바꾸면 조용히 깨진다. 수정 방향: 서버 메시지 상수를 공유 모듈(예: `src/types` 또는 별도 상수 파일)로 빼서 양쪽이 import하거나, 최소한 M2의 테스트로 결합을 고정한다. 장기적으로는 응답에 에러 코드 필드를 두는 편이 낫지만 `ApiFail` 계약 변경이라 이번 범위 밖.
- L3. `src/components/cities/CityFormModal.tsx:100`, `src/hooks/useCityMutations.ts:10`: 서버 중복 거부 메시지와 `DUPLICATE_CITY_MESSAGE`가 같다는 보장이 없어 서버 경로에서 테두리 강조가 빠질 수 있다. 수정 방향: 서버 중복 거부의 실제 메시지를 확인한 뒤 맞추거나, 강조 조건을 문구 비교 대신 별도 상태로 둔다. 상류 동작은 미확인이라 확인 후 판단.
- L4. `src/types/city.ts:1`, `src/docs/city-api-reference.md:4,7`: 사이클 산출물(`artifacts/task-team/…`) 경로 인용. 수정 방향: 영구 문서(`src/docs/city-api-reference.md`)만 인용하거나 인용을 제거한다.
- L5. `src/lib/apiClient.ts:34`: 한 줄이 길고(프로젝트 포맷 기준 초과 가능), 401 리다이렉트 후에도 에러를 던져 짧은 시간 오류 UI가 보일 수 있다. 기능 영향 미미. 수정 방향: 줄바꿈 정리, 필요하면 401에서 pending Promise를 반환하거나 현 상태 유지.
- L6. `NOT_FOUND_MESSAGE = "대상을 찾을 수 없습니다."`가 `CityFormModal.tsx:51`, `DeleteConfirmDialog.tsx:9`, 서버 폴백(cityUpstream.ts:105)에 중복. 문구 단일화 규칙(project-structure 4번)에 맞게 `cityErrorMessage.ts`에서 export해 공유하는 편이 낫다. 수정 방향: 상수 하나로 통합.

## 확인하지 못한 것

- 브라우저 실동작(가상 스크롤, sticky 헤더 테두리), 실서버 응답 형태와 상류 오류 메시지는 확인하지 못했다. 서버 모듈은 코드 읽기 수준 검토다.
- 동시 요청에서 토큰 재발급 경합은 코드상 `inflight` 합류와 `accessToken === used` 조건으로 보호된다고 판단했으나 실행 검증은 없다.

## CodeRabbit 교차검토

- 실행: `coderabbit review --agent --committed --base 940c8a1` (develop 로컬 브랜치가 없고 base가 현 HEAD와 같은 `feature/real-city-api`라 diff가 비어, 사이클 기준 커밋으로 대체). 상태: 완료(`review_completed`, 38개 파일 검토, free CLI allowance).
- CodeRabbit 0건 중 0건 타당.
- 타당 판정 항목: 없음.
- 기각 항목: 없음.
