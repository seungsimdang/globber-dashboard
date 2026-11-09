# Code Review 4 — 2·3차 전체 리뷰

## 판정

**재작업 필요.** 범위는 `dddfd83..HEAD`의 `src`·`tests` 전체 diff이며, 현재 브랜치는 `feature/real-city-api`입니다. 운영 API 기준 주소와 경로 조립 규칙의 불일치(High), 모달이 열린 상태에서 탭 전환을 허용하는 요구사항 위반(Medium)을 확인했습니다.

실서버 요청과 테스트 실행은 하지 않았습니다. 이 보고서는 코드·명세 정적 검토 결과이며 실제 배포 환경의 주소 설정 및 상류 동작은 확인하지 않았습니다.

## 수정 필요 항목

### [High] 운영 기준 주소와 상류 경로가 중복되어 운영 목록 요청이 잘못된 URL로 갈 수 있음

- 근거: `src/lib/server/cityApiToken.ts:10-12`는 운영 기준 주소 환경 변수를 선택하고, `src/lib/server/cityUpstream.ts:96`은 그 값에 경로를 문자열로 붙입니다. 기본 설정 예시는 `.env.example:8-9`의 `CITY_API_PROD_BASE_URL=https://prod.example.com/api`이고 목록 경로는 [`src/app/api/cities/route.ts:9`]의 `/api/v1/cities/all`입니다. 두 계약을 그대로 조합하면 `/api/api/v1/cities/all`이 됩니다.
- 명세 대조: `requirements.md`의 운영 조회 경로는 `/api/v1/cities/all`이며, `api-spec.md` 2-C/2-H와 `requirements.md` U-1은 운영 기준 주소에 `/api`를 포함한다고 적어 서로 일치하지 않습니다. `implementation-3.md`도 이 URL을 직접 확인하지 못했다고 기록했습니다.
- 영향: 배포 환경이 `.env.example`의 주소 형식을 따르면 운영 탭의 목록 조회가 잘못된 경로로 요청됩니다. 실제 배포 환경 변수와 상류 응답은 확인하지 않았으므로, 배포에서도 반드시 실패한다고 단정하지 않습니다.
- 조치: 운영 기준 주소와 접미 경로 중 어느 쪽에 `/api`를 둘지 명세와 설정 예시에서 하나로 확정하고, 프록시 조립 및 주소 단언을 함께 맞춰야 합니다.

### [Medium] 쓰기 모달이 열려 있어도 서버 탭을 전환할 수 있음

- 근거: `src/components/cities/CitiesPageContent.tsx:72-75`에서 탭 변경은 모달 상태와 무관하게 `server`를 바꿉니다. 열린 상태의 두 쓰기 다이얼로그에도 현재 `server`를 전달합니다(`src/components/cities/CitiesPageContent.tsx:117-125`). `src/components/common/Tabs.tsx:14-26`은 `TabsTrigger`의 props를 Radix trigger로 전달하지만, 호출부에서 모달 상태에 따른 비활성 prop은 전달하지 않습니다.
- 사용자 경로 및 영향: 운영의 추가·수정·삭제 진입점은 네이티브 `disabled`입니다(`src/components/cities/CitiesPageContent.tsx:60-64`, `src/components/cities/CityListTable.tsx:149-165`). 따라서 확인 가능한 경로는 개발 모달을 연 뒤 운영 탭으로 전환하는 경우입니다. 다이얼로그가 열린 채 남아 저장·삭제 요청의 `server`가 `prod`로 바뀌며, API의 운영 쓰기 거부가 이를 403으로 차단합니다(`src/lib/server/cityServer.ts:31-37`). 데이터 변경 위험은 확인되지 않았지만, 사용자는 요구된 대로 탭을 잠글 수 없고 열린 작업이 다른 서버 대상으로 바뀌어 실패합니다.
- 명세 대조: `requirements.md` U-3은 추가·수정·삭제 모달이 열린 동안 탭 전환 불가를 확정했고, `api-spec.md` 2-E도 모달 중 전환 차단을 프런트 책임으로 지정했습니다.
- 조치: 쓰기 다이얼로그가 열려 있는 동안 탭 전환을 차단하거나, 확정된 다른 동작으로 다이얼로그를 닫고 입력을 폐기해야 합니다.

## 구현 기록의 리뷰 확인 필요 항목

아래 판정에서 “타당”은 기록된 미확인점·위험이 실제로 존재한다는 뜻입니다. 명세 준수 및 범위 제외 여부와 finding 여부를 별도로 적었습니다.

### `implementation-3.md`

- `getCityApiBaseUrl`의 URL 파싱 실패를 설정 오류로 변환: **타당한 동작 설명, finding 아님.** 주소 형식 오류를 설정 오류로 처리하라는 `api-spec.md` 2-C에 부합합니다. 근거: `src/lib/server/cityApiToken.ts:15-29`.
- 운영 기준 주소 `/api`와 `/api/v1/...` 접미 경로가 중복될 수 있음: **타당, High finding.** 두 값을 이어 붙이는 코드는 `src/lib/server/cityUpstream.ts:96`, 기본 운영 주소 형식은 `.env.example:8-9`에 있습니다. 운영의 실제 환경 값·응답은 확인하지 않았습니다.
- 운영 응답·실제 조회, 운영 쓰기 403 등 미확인: **타당한 제한.** 실서버 호출은 하지 않았고, 쓰기 차단은 코드에서만 확인했습니다(`src/lib/server/cityServer.ts:31-37`). 실제 상류 계약은 미확인입니다.

### `implementation-4.md`

- 목록 오류 판별이 `서버 설정 오류` 접두사에 의존: **타당한 구현 설명, 현재 근거상 finding 아님.** 서버 설정 오류 응답이 해당 접두사를 제공하는 경로가 있습니다(`src/lib/server/cityApiToken.ts:25-28`, `src/lib/server/cityUpstream.ts:139-142`).
- `-mt-3` 패널 배치 및 목록 영역의 시각적 잘림 미확인: **타당한 미검증 항목, finding 아님.** 브라우저 시각 검토는 수행하지 않았고 코드만으로 잘림을 단정하지 않습니다.
- 검색·건수 줄을 탭 패널 바깥에 배치: **타당한 구현 설명, finding 아님.** 검색어는 페이지 상태로 유지되고 양 서버 탭에서 공유됩니다(`src/components/cities/CitiesPageContent.tsx:35-42`, `95-103`).
- `cityErrorMessage` 전용 단위 테스트와 탭 자동 테스트가 없음: **타당한 테스트 범위 확인.** 이번 리뷰에서 테스트는 실행하지 않았습니다. 직접 소스를 쓰는 컴포넌트 테스트가 일부 존재합니다.
- 탭 키보드 동작 및 백엔드 연결 미확인: **타당한 제한, finding 아님.** Radix 기반 탭 코드는 확인했으나 브라우저·실서버 동작은 확인하지 않았습니다(`src/components/common/Tabs.tsx:3-27`).

### `implementation-5.md`

- 국가 목록 레이어가 Dialog 안에서 잘리는지 시각 확인 필요: **타당한 미검증 항목, finding 아님.** 브라우저 렌더링 확인을 하지 않았습니다.
- 제출 시작 시 후보를 비우고 실패 후에도 후보를 보존하지 않음: **타당한 설명, finding 아님.** 제출 중 진행 중인 검색 결과를 무시하고 좌표 입력을 유지하도록 상태를 초기화합니다(`src/components/cities/CityFormModal.tsx:202-215`).
- `Intl.DisplayNames` 국가명은 런타임 ICU에 따라 달라질 수 있음: **타당한 제한, finding 아님.** 국가명 원천을 `Intl`로 정한 사용자 결정 N-1과 일치합니다(`src/utils/countryOptions.ts:12-27`).
- 레거시 국가명과 `Intl` 국가명 차이로 중복 검사가 같은 도시를 놓칠 수 있음: **타당한 위험, 이번 finding에서는 제외.** `findDuplicateCity`는 도시명·국가명 문자열을 비교합니다(`src/utils/cityDuplicate.ts:14-19`). 다만 디자인 명세 D-2(`design-spec.md:487`)가 이 영향을 명시적으로 이번 범위 밖으로 두고 QA에서 확인하도록 정했습니다. 기존 서버의 자체 중복 검사도 미확인입니다. 구현자가 이를 숨기지 않고 기록한 것은 타당합니다.
- 위치 검색 응답과 브라우저 키보드·스크롤 동작 미확인: **타당한 제한.** 실서버 호출 및 브라우저 검증을 하지 않았습니다. 실제 후보 응답을 확인한 것처럼 판단하지 않습니다.

### `implementation-6.md`

- `region`에서 `address.state`, `address.county`를 사용한 결정: **타당한 미확인점.** `api-spec.md` 3-D가 응답 구조에 따른 키 선택을 확인 필요로 남겼고, 실제 Nominatim 응답은 확인하지 않았습니다. 현재 코드는 두 필드를 조합합니다(`src/lib/server/geocode.ts:54-57`).
- 부분 형식 오류 후보를 버리고 전체가 형식 오류일 때 실패 처리: **명세 부합, finding 아님.** 정제 규칙이 `api-spec.md` 3-D/3-E에 적혀 있습니다(`src/lib/server/geocode.ts:69-83`).
- 호출 시작 시각 기준 간격 제한, 캐시 정책, 오류 로그, 타임아웃 분류: **명세와 일치, 미실서버 검증.** 코드 근거: `src/lib/server/geocode.ts:18-25`, `86-93`, `123-159`. 인스턴스별 제한이라는 한계도 문서와 주석에 적혀 있습니다.
- 새 Route Handler·캐시·간격 로직 동작 테스트 없음: **타당한 누락 사실, QA 확인 필요.** `requirements.md` I-09는 fetch 모킹 기반 Route Handler 테스트를 요구합니다. 리뷰 범위의 테스트 목록에는 geocode Route Handler/server 로직 테스트가 없습니다. 이번 지시대로 테스트를 실행하지 않았으며, 동작 검증 완료로 취급하지 않습니다.
- 다중 인스턴스 전역 호출 제한·배포 IP 제한 미확인: **타당한 제한.** 인스턴스별 동작과 문서상 한계만 확인했습니다(`src/lib/server/geocode.ts:1-2`, `src/docs/city-api-reference.md:111-115`).

## 테스트 파일의 검증 대상 연결

수정된 테스트는 실제 소스 모듈을 import하거나 동적 import합니다. 예를 들어 `CityFormModal.test.tsx`는 `CityFormModal`과 `citiesQueryOptions`를 import하고, `cityService.test.ts`는 `cityService`의 실제 함수들을 import하며, API 테스트는 Route Handler를 동적 import합니다. 복사한 프로덕션 로직만 검증하는 가짜 테스트 패턴은 확인하지 못했습니다. 새 국가 선택·위치 검색 서버 로직에 대한 테스트는 위에 적은 대로 누락되어 있습니다.

## CodeRabbit 교차검토

- 실행 예정 명령: `coderabbit review --agent --base dddfd83 --committed`
- 상태: **미실행(인증 정보 접근 실패).** `coderabbit auth status`가 `credentials_unavailable`로 실패해 저장된 로그인 정보를 이 환경에서 사용할 수 없었습니다. 리뷰 명령은 실행하지 않았습니다.
- base: 기본 병합 브랜치 `develop`는 로컬 브랜치로 존재하지 않음(`git show-ref --verify refs/heads/develop` 실패). 지시대로 범위 시작점인 `dddfd83`을 대체 base로 지정했습니다.
- 타당 항목: 없음(교차검토 미실행).
- 기각 항목: 없음(교차검토 미실행).

## 검토 범위의 추가 확인

- 서버 구분은 허용값 `prod`·`dev`만 파싱하며 중복·누락·기타 값은 400으로 거부합니다(`src/lib/server/cityServer.ts:7-10`).
- 운영 쓰기는 API에서 상류 호출 전에 403으로 거부되고 개발 토큰은 개발 주소만 사용합니다(`src/lib/server/cityServer.ts:31-37`, `src/lib/server/cityApiToken.ts:43-47`).
- 목록 캐시 키와 mutation 무효화는 서버별로 분리되어 있습니다(`src/lib/react-query/query-keys.ts:3-7`, `src/hooks/useCityMutations.ts:32-75`).
- 위치 후보 좌표 범위·국가코드 검증은 Route Handler의 서버 로직에 있습니다(`src/lib/server/geocode.ts:35-53`, `98-115`). 내부 응답의 `Cache-Control: no-store`는 공용 `jsonResponse`가 설정합니다(`src/lib/server/cityUpstream.ts:14-15`).
- UI 스타일은 확인한 변경분에서 표준 Tailwind 토큰을 사용하며, 이번 리뷰에서 임의값 사용 finding은 없습니다.
