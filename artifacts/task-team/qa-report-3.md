# T09 QA 보고서 3 — D-2 중복 검사와 지오코드 로딩

## 판정

**통과.** 승인된 후속 요구사항인 국가명 표기와 무관한 도시 중복 판정, 기존 수정 자기 자신 제외, 위치 검색 단일 로딩 표시를 실제 소스 import 기반 테스트로 검증했다. 전체 lint·type-check·test·build가 모두 통과했다.

## 요구사항 검증

| 기능 | 결과 | 확인 내용 |
|---|---|---|
| D-2 중복 기준 | 통과 | `findDuplicateCity`는 앞뒤 공백·대소문자를 정규화한 도시명과 국가코드를 비교한다. 같은 도시명/국가코드에 국가명 표기만 다른 추가는 mutation에서 거부되어 service 호출이 없다. |
| 국가코드 경계 | 통과 | 도시명이 같아도 국가코드가 다르면 추가가 허용되어 service에 전달된다. |
| 수정 시 자기 자신 제외 | 통과 | 기존 도시의 표시 국가명이 달라도 같은 도시명/국가코드 수정은 허용된다. 다른 도시와 국가코드가 같으면 표시 국가명이 달라도 중복으로 거부된다. |
| 위치 검색 로딩 상태 | 통과 | 실제 `CityFormModal`에서 대기 중 버튼 비활성화, `aria-busy="true"`, 버튼 내부 단일 스피너를 확인했다. 별도 로딩 문구가 live 영역에 중복 표시되지 않는다. |
| 위치 후보 적용·초기화 | 통과 | 실제 위치 검색 service 호출 후 후보 선택 시 위·경도와 위도 포커스를 확인했다. 모달을 닫은 뒤 도착한 응답은 다시 연 모달에 남지 않는다. |
| 결과·오류 알림 영역 | 통과 | 테스트에서 `aria-live="polite"` 영역이 로딩 문구 없이 유지되는 것을 확인했다. 실제 컴포넌트에서 후보와 `role="alert"` 오류 분기가 같은 live 영역 아래 남아 있다. |

## 실행 결과

| 명령 | 결과 |
|---|---|
| `pnpm lint` | 통과, ESLint 오류 없음 |
| `pnpm type-check` | 통과, `next typegen` 및 `tsc --noEmit` 오류 없음 |
| `pnpm test` | 통과, 20개 파일·183개 테스트 |
| `pnpm build` | 통과, 최적화 빌드 및 정적 페이지 생성 완료 |

Vitest는 위치 검색 service를 mock해 UI 상태 계약을 확인했다. 실서버·외부 지오코더 호출과 브라우저 검증은 수행하지 않았다.

## 확인 범위

- 대상 테스트: `tests/utils/cityDuplicate.test.ts`, `tests/hooks/useCityMutations.test.tsx`, `tests/components/CityFormGeocode.test.tsx`.
- 테스트는 실제 `findDuplicateCity`, `useAddCityMutation`, `useUpdateCityMutation`, `CityFormModal`을 import해 호출한다. 테스트용 복사 로직은 없다.
- QA는 소스 코드를 수정하지 않았고, 커밋하지 않았다.
- TaskUpdate 도구는 제공되지 않아 상태 갱신은 수행하지 않았다.
