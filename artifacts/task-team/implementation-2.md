# T05 구현 기록 2 - 실제 도시 API 연동 (프론트엔드)

## 변경 파일

수정
- `src/types/city.ts` (CityRequest, CityResponse, ApiSuccess, ApiFail 추가, 목업용 타입 삭제)
- `src/services/cityService.ts` (fetch 기반 4개 함수, searchCities 제거)
- `src/hooks/useCities.ts` (전체 목록 1회 조회 + 클라이언트 필터, `cities`/`totalCount` 제공)
- `src/hooks/useCityMutations.ts` (중복 사전 검사, `DUPLICATE_CITY_MESSAGE` export)
- `src/lib/react-query/query-keys.ts` (`list`가 키워드 없는 상수)
- `src/utils/countryFlagMapping.ts` (alpha-3 249개 표 + 국기 계산)
- `src/components/cities/CitiesPageContent.tsx`, `CityListTable.tsx`, `CityFormModal.tsx`, `DeleteConfirmDialog.tsx`, `SearchInput.tsx`
- `tests/services/cityService.test.ts`, `tests/components/CityFormModal.test.tsx`, `CityListTable.test.tsx`, `DeleteConfirmDialog.test.tsx`, `SearchInput.test.tsx`
- `package.json`, `pnpm-lock.yaml`
- `docs/agent-rules/project.md`, `react-query.md`, `project-structure.md`, `nextjs.md`

신규
- `src/lib/apiClient.ts`, `src/utils/cityFilter.ts`, `src/utils/cityDuplicate.ts`
- `src/utils/cityErrorMessage.ts` (api-spec에 없는 추가 파일, 아래 "리뷰 확인 필요" 참고)

삭제
- `src/mocks/mockCities.ts`, `src/mocks/mockDelay.ts`, `tests/mocks/mockCities.test.ts`

## 의존성

`@tanstack/react-virtual@3.14.23` (배포일 2026-10-26, 오늘 2026-11-09 기준 14일 경과, 범위 지정자 없이 고정). 3.14.24(10-29)와 3.14.25(11-01), 3.14.26(11-03)은 14일 미만이라 제외했다. 설치 후 해석된 하위 의존성은 `@tanstack/virtual-core@3.19.8`이다.

## 구현 요약

- 서비스: `getCities/addCity/updateCity/deleteCity`가 `/api/cities*`를 `apiClient`로 호출하고 도메인 타입(`City`)만 반환한다. 서비스는 trim과 국가코드 대문자 변환만 하고 검증은 하지 않는다.
- `apiClient`: `{status,data}` 래퍼를 벗기고 실패는 `ApiError(status, message)`로 던진다. fetch 실패는 status 0. 401은 `/login`으로 이동 후 에러를 던진다.
- 검색: `filterCities`(도시명+국가명, NFC, 모든 공백 제거, 소문자, 서버 순서 유지). `useCities(keyword)`가 같은 캐시를 `useMemo`로 필터링한다. 쿼리는 키워드와 무관하게 1회.
- 결과 수 줄: 검색 입력과 같은 줄 오른쪽 끝, `aria-live="polite"`, 천 단위 쉼표, 로딩·에러 중 숨김.
- 가상 스크롤: `CityListTable`이 `h-screen` 세로 flex 페이지에서 남은 높이를 차지하는 스크롤 컨테이너가 되고, `thead`는 sticky. 위아래 spacer `tr`로 기본 table 레이아웃 유지. 행 높이는 `measureElement`로 실측해 긴 이름 줄바꿈(`break-words`)에도 대응. 검색어가 바뀌면 `scrollTop = 0`.
- 폼: 국가코드 alpha-3(`maxLength=3`, placeholder `예: KOR`, 오류 문구 갱신), 이름 100자 제한과 `maxLength` 제거, 서버 오류는 배너에 원인별 문구로 표시, 404는 기존처럼 모달 닫기 + 토스트.
- 중복 사전 검사: 추가·수정 `mutationFn` 안에서 쿼리 캐시의 전체 목록으로 `findDuplicateCity`(trim, 대소문자 무시, 수정은 자기 제외) 실행. 캐시가 없으면 건너뜀. 요청을 보내지 않고 `이미 등록된 도시입니다.` 에러.
- 삭제: 404만 토스트 `대상을 찾을 수 없습니다.` + 다이얼로그 닫기. 그 외(네트워크, 5xx, 인증, 설정)는 원인별 토스트만 띄우고 다이얼로그를 유지해 재시도 가능. 모든 경우 `onSettled`에서 목록 무효화.
- 국기: alpha-3 -> alpha-2 249개 표에서 Regional Indicator로 계산, 미매핑은 `🏳️`.
- 규칙 문서 4개의 목업 서술을 실제 API 프록시 기준으로 갱신(`src/lib/server/` 항목 포함).

## 리뷰 확인 필요

1. `src/utils/cityErrorMessage.ts` 신규 추가: design-spec §5의 원인별 문구를 한 곳에 모으려고 만들었다(api-spec 파일 목록에는 없음). 5xx를 세분하는 기준이 서버 메시지 접두어(`서버 인증에 실패`, `서버 설정 오류`)와 포함어(`연결할 수 없습니다`, `지연`)에 의존한다. api-spec §4의 고정 메시지가 바뀌면 문구 분기가 깨진다. T06의 실제 메시지와 일치하는지 병합 후 확인 필요. 상태 코드만으로는 502(인증/상류 5xx/연결 불가)와 500(설정)을 구분할 수 없어 택한 방식이다.
2. 목록 조회 실패에서 인증·설정 오류는 별도 문구가 없어 "서버에 문제가 발생했습니다" 문구로 묶었다(design-spec §5.0 표에 해당 행이 없음).
3. 삭제 설정 오류 문구 `서버 설정이 올바르지 않아 삭제할 수 없습니다. 관리자에게 문의해주세요.`는 design-spec §5.3 표에 없어 쓰기 문구를 변형했다.
4. 서버 400 중복 거부 시 도시명·국가명 테두리 강조(§5.2 "메시지가 `이미 등록된 도시입니다.`와 같을 때")는 `formError === DUPLICATE_CITY_MESSAGE` 비교로 사전 검사와 서버 응답 모두에 적용된다.
5. `useCities`가 `{...query, cities, totalCount}`를 반환하고 `data`를 노출하지 않는다. 반환 형태 변경이라 다른 사용처가 생기면 영향을 받는다(현재 사용처는 `CitiesPageContent` 하나).
6. `apiClient`의 401 처리: `window.location.assign`(상대 경로) 대신 `new URL("/login", origin).href`를 쓴다. lint 경고(`no-location-assign-relative-destination`)를 피하려는 선택이다.
7. `CityListTable`에 `eslint-disable-next-line react-hooks/incompatible-library`를 한 줄 넣었다. `useVirtualizer`가 React Compiler 경고를 내고, 경고가 있으면 pre-commit이 막기 때문이다. 반환 함수를 다른 메모이즈 컴포넌트에 넘기지 않아 실제 위험은 낮다고 판단했다.
8. 페이지 높이를 `h-screen`으로 고정했다. 표 영역이 "페이지 헤더·검색 줄 아래 남은 높이"가 되는 구조를 임의값 없이 얻으려는 선택이다.
9. 테스트 갱신 범위: 서비스 테스트에서 100자·2자리 검증, 중복·없는 id 단언은 서비스에서 사라져 fetch 응답 기반 단언(400/404 전달)으로 바꿨다. 폼 테스트에서 저장소 상태 단언은 요청 URL·메서드·본문 단언으로 바꿨다. `CityListTable.test.tsx`는 jsdom에 레이아웃이 없어 `clientHeight/offsetHeight` 스텁을 추가했다. 새 테스트 케이스는 추가하지 않았다(서버 오류 시 다이얼로그 유지, 서버 400 배너 등 일부 단언은 기존 케이스를 서버 응답 기반으로 바꾸면서 생긴 것이라 qa-engineer가 범위를 판단해 주길 바란다).

## 확인하지 못한 것

- 브라우저에서 가상 스크롤의 실제 동작(스크롤 부드러움, sticky 헤더 모서리 테두리, 3,791행 입력 지연)은 확인하지 못했다. jsdom 테스트는 일부 행 렌더링만 확인한다. design-spec §7 6번(실측 성능)은 미완.
- 실제 서버와의 통신. 요청대로 데이터 변경 요청은 보내지 않았고, 읽기 요청도 보내지 않았다. 모든 호출은 테스트의 fetch 스텁으로만 검증했다.
- T06의 Route Handler가 없어 `/api/cities`는 이 worktree에서 404다. 빌드 라우트 목록에도 `/api/cities`가 없다.
- 실데이터 63개 국가코드가 alpha-3 표에 모두 있는지. 63개 목록을 보지 못했다. 표는 ISO 3166-1 249개를 기억에서 작성했고 항목 수(249)와 alpha-2 중복 없음만 확인했으며, ISO 공식 목록과 대조하지 못했다.
- `ApiSuccess.status` 값이 `success` 외인 경우의 처리. 클라이언트는 `status`를 보지 않고 HTTP 상태와 `data`만 쓴다.
- 접근성 도구(스크린리더) 검증. `aria-live` 속성만 설정했다.

## 검증 결과

- `pnpm lint`: 출력 없이 종료(오류 0, 경고 0)
- `pnpm type-check`: `Types generated successfully`, tsc 오류 없음
- `pnpm test`: `Test Files 5 passed (5)`, `Tests 45 passed (45)`
- `pnpm build`: `Compiled successfully`, 라우트 `/`, `/_not-found`, `/cities`, `/login`. T06 파일이 없어 `/api/cities*`는 목록에 없지만 빌드 오류는 없다.
- T06 파일이 없어 생긴 오류는 없었다(클라이언트는 URL 문자열로만 호출하고 서버 모듈을 import하지 않는다).
