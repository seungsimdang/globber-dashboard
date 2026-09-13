# Task Team 최종 요약 — 도시 CRUD 관리자 대시보드

## 1. 구현 범위

Globber 도시 데이터를 관리하는 관리자 대시보드(`/cities`)를 mock 서비스 레이어 위에
구현했다. 실 백엔드 API는 개발 중이므로, 실제 REST API와 동일한 함수 시그니처를 가진
인메모리 mock으로 전체 CRUD를 구현하고, 이후 내부 구현만 교체하면 되도록 설계했다.

### 화면/컴포넌트
- `src/app/cities/page.tsx` — 얇은 Server 셸
- `src/components/cities/CitiesPageContent.tsx` — 목록/검색/추가/수정/삭제를 조합하는
  메인 클라이언트 컴포넌트
- `src/components/cities/{CityListTable,SearchInput,CityFormModal,DeleteConfirmDialog}.tsx`
- `src/app/page.tsx` — `/cities`로 리다이렉트
- `src/components/common/*` — Dialog/AlertDialog/Button/Input/Label/Toast 공용 프리미티브
  (Radix 기반)

### 데이터 레이어
- `src/types/city.ts` — `City`, `CityApiData`, `AddCityRequest`/`UpdateCityRequest` 등
- `src/services/cityService.ts` — `getCities`/`searchCities`/`addCity`/`updateCity`/
  `deleteCity` 5개 함수. **실 API 전환 시 이 파일 내부 구현만 `fetch` 호출로 교체하면
  되며, 함수 시그니처는 변경할 필요가 없다.**
- `src/mocks/mockCities.ts` — 인메모리 저장소(15개 시드 도시), 동기적 검증/쓰기 보장
- `src/hooks/useCities.ts`, `src/hooks/useCityMutations.ts` — React Query 훅

## 2. 코드/보안 리뷰 및 반영 내역 (9-1 게이트)

| 항목 | 판정 | 처리 |
| --- | --- | --- |
| 검색 클리어 버튼이 디바운스 타서 즉시 반영 안 됨 | 반영 | 클리어 시 즉시 재조회하도록 수정 |
| 폼 필드 재검증 시 무조건 에러 삭제 | 반영 | 실제 재검증 결과로 에러 갱신 |
| Toast 성공/실패 모두 assertive로 안내(접근성) | 반영 | 성공=polite, 실패=assertive로 분기 |
| 도시명/국가명 길이 제한 없음(보안 리뷰) | 반영 | 클라이언트+서비스 양쪽에 100자 제한 추가 |
| 위경도 `Number.isFinite` 미검사(보안 리뷰) | 반영 | 명시적 finite 체크 추가 |
| 클라이언트/서버 국가코드 정규식 대소문자 불일치 | 반려 | 최종 결과에 영향 없음(서버가 재검증) |
| design-spec/api-spec 중복 배너 문구 불일치 | 반려 | 문서 정합성 이슈일 뿐 코드 문제 아님 — 아래 §4 참고 |

전체 리뷰 리포트: `artifacts/task-team/code-review-1.md`, `artifacts/task-team/security-review-1.md`

**보안 리뷰 결론**: Critical/High 0건. 인증/DB/네트워크 관련 항목은 이 앱의 범위(내부
mock 도구, 인증 없음)상 해당 없음으로 처리했고, "실 API 전환 시 반드시 다뤄야 할
사항"(인증 재도입, 서버 측 재검증, CSRF, 에러 메시지 정보 노출 방지 등) 6개를 체크리스트로
남겨두었다.

## 3. QA (T09)

`tests/` 아래 vitest + @testing-library/react로 **88개 테스트, 전부 통과**:
- `tests/mocks/mockCities.test.ts`, `tests/services/cityService.test.ts` — 실제 서비스/
  저장소 코드를 그대로 통과시키는 통합 테스트 (mockDelay만 즉시 resolve로 대체)
- `tests/components/*.test.tsx` — 폼 검증, 로딩/에러/빈 상태 분기, 삭제 확인 플로우 등

requirements.md의 F1~F5 수용 기준과 엣지케이스(위경도 경계값, 도시명+국가명 중복,
존재하지 않는 id 수정/삭제, 중복 삭제 idempotency, 동시 추가/수정-삭제 경쟁 조건)를
모두 커버한다.

**알려진 한계 (수정하지 않음, 재사용 시 주의)**: `CityFormModal`은 "닫힘→열림 전환"
시점에만 폼을 초기화하는 패턴이라, 컴포넌트가 처음부터 `open=true`로 마운트되면
`mode='edit'`이어도 빈 폼이 표시될 수 있다. 현재 유일한 소비처(`CitiesPageContent`)는
항상 `open=false`로 먼저 마운트하므로 실사용 경로에서는 발생하지 않는다. 이 컴포넌트를
다른 초기 상태로 재사용할 계획이 있다면 `key` prop 기반 재마운트나 `useEffect` 방식으로
바꿔야 한다.

## 4. 확인 필요 (사용자 결정 필요)

1. **수정(update) API 형태**: 실제 저장소에는 PUT 엔드포인트가 없어 `api-spec.md`에서
   `PUT /api/v1/cities/{cityId}`를 추론해 정의했다. 실 백엔드 완성 시 실제 스펙과
   대조 필요.
2. **목업 에러/지연 정책**: 현재 300~800ms 랜덤 지연 + 결정적 비즈니스 규칙 위반에만
   에러(랜덤 5xx 시뮬레이션 없음)로 설계했다. 실 API의 실패율/지연 특성이 다르면 조정
   필요.
3. **목록 UX 기본값**: 페이지네이션/정렬 없음(id 순서 그대로), 검색은 대소문자 무관
   부분 문자열. 도시 수가 많아지면 페이지네이션 도입을 고려할 것.
4. **반응형 범위**: 데스크톱 우선(1024px+), 모바일은 범위 밖으로 명시. 태블릿은 최소
   레이아웃 안 깨지는 수준까지만 확인.
5. **design-spec.md와 api-spec.md의 중복 도시 에러 배너 문구 불일치**: design-spec은
   "이미 등록된 도시입니다 (도시명 + 국가명 중복)", api-spec/코드는 "이미 등록된
   도시입니다."로 확정. 코드는 api-spec을 따르고 있음 — 두 문서 중 하나로 정리 필요.
6. **인증 확장 가능성**: 현재 범위에서 인증은 완전히 제외했지만, 실 API 전환 시
   `cityService.ts`의 5개 함수에 토큰 파라미터를 추가해야 한다(보안 리뷰 §"실제 API
   전환 시 고려사항" 참고).

## 5. 하네스 실행 관련 참고

원래 `.claude/skills/task-team-orchestrator/SKILL.md`는 T05/T06 구현을 격리된 git
worktree(`Agent(isolation: "worktree")`)에서 진행하도록 정의하지만, 실제로는 백그라운드
오케스트레이터의 rate-limit 실패 이후 사용자 지시에 따라 오케스트레이터 역할을 인터랙티브
세션이 직접 맡으면서 구현 작업 대부분이 메인 체크아웃에 직접 반영되었다(충돌은 없었음).
문서화된 절차와의 편차이지만 재작업이 필요한 문제는 아니라고 판단해 기록만 남긴다.

## 6. 커밋 이력

- `9ee3188` chore(init): 프로젝트 스캐폴드 + 하네스
- `b162a55` docs(task-team): 요구사항/디자인/API 명세
- `80dacd7` feat(cities): 목업 서비스 레이어 및 공용 UI 프리미티브
- `2c50608` feat(cities): 목록/검색/추가/수정/삭제 UI 구현
- `bb007e3` fix(cities): 코드/보안 리뷰 지적사항 반영
- `c293f74` docs(task-team): 코드 리뷰 결과 문서화
- `f85c302` test(cities): vitest 테스트 88개 추가

`origin/main`에 모두 push 완료.
