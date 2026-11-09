# Code Review 1 — City CRUD (mock service layer 포함 전체 구현)

## 결과 요약

**판정: 조건부 통과 (Critical 없음, Minor 4건 — 이번 사이클에서 처리)**

검토 범위: `src/types/city.ts`, `src/mocks/*`, `src/services/cityService.ts`, `src/utils/*`,
`src/lib/react-query/query-keys.ts`, `src/hooks/*`, `src/components/cities/*`,
`src/components/common/*`, `src/app/*` — `pnpm lint` / `tsc --noEmit` 모두 통과, `interface`/`any`/
`function` 키워드/`key={index}` 위반 없음.

## Critical / Major

없음. 경쟁 조건 방지 순서, 에러 메시지 문자열, 서비스 시그니처는 모두 명세와 정확히 일치.

## Minor (9-1 게이트 판단 결과: 모두 이번 사이클에서 수정)

1. **SearchInput 클리어 버튼이 디바운스(300ms)를 그대로 타 즉시 반영되지 않음**
   (`src/components/cities/SearchInput.tsx:22-28`) — design-spec §3.2 "클리어 시 즉시 전체
   목록 재조회" 요구와 불일치. → **수정함**: 클리어 클릭 시 `onSearch("")`를 즉시 호출.

2. **값 변경 시 무효한 값이어도 에러가 무조건 사라짐**
   (`src/components/cities/CityFormModal.tsx` `handleChange`) — design-spec §4 "재검증 후
   여전히 무효하면 에러 유지" 요구와 불일치. → **수정함**: `validate(nextValues)[field]`로
   재계산 후 조건부 반영.

3. **클라이언트 국가코드 정규식이 소문자 허용**(`CityFormModal.tsx:48` `/^[A-Za-z]{2}$/`)
   vs 서버(`cityService.ts:30` `/^[A-Z]{2}$/`) — 최종 결과는 `toUpperCase()` 정규화 후
   서버가 재검증하므로 실사용 영향 없음. → **반려**: 기능적 버그 아님, 우선순위 낮음.

4. **Toast `aria-live`가 성공/실패 모두 assertive로 안내됨**
   (`src/components/common/Toast.tsx`) — design-spec §6 "성공은 polite, 실패는 assertive로
   구분" 요구와 불일치(Radix 기본 `type="foreground"`가 assertive에 매핑됨). → **수정함**:
   `type={variant === "error" ? "foreground" : "background"}` 분기 추가.

5. **문서 간 불일치(코드 문제 아님)**: design-spec §4는 중복 배너 예시로 "이미 등록된
   도시입니다 (도시명 + 국가명 중복)"을 제시하지만 api-spec §3.2가 확정한 문자열은
   "이미 등록된 도시입니다."이다. 코드는 api-spec의 확정 문자열을 정확히 따름. → **반려**:
   문서 정합성 이슈일 뿐 코드 수정 대상 아님. 향후 문서 정리 시 참고.

## 검증 확인 사항 (문제 없음)

- F1~F5 수용 기준(목록/로딩/에러/빈 상태 분기, 검색 trim + 대소문자 무관, 5개 필드 필수
  검증 + 위경도 범위 + 국가코드 형식 + 중복 검증, 삭제 확인 + 실패 시 Toast + 강제 refetch)
  모두 요구사항대로 구현됨.
- 경쟁 조건 방지 순서(`cityService.ts`, `mockCities.ts`): "동기적 검증 → 동기적 쓰기 →
  `await mockDelay()`" 순서 정확히 준수.
- 에러 메시지 문자열: api-spec.md §3.2 표와 코드가 글자 하나까지 일치.
- CLAUDE.md 컨벤션: `type`만 사용, 화살표 함수, PascalCase/camelCase, `map key`에 `id`
  사용, import 경로 규칙 모두 준수.
- 접근성: Label 연결, `aria-invalid`/`aria-describedby`, 아이콘 버튼 `aria-label`, 모달
  오픈 시 첫 필드 자동 포커스, `role="alertdialog"`, `tbody aria-busy`, 제출/삭제 중
  버튼 비활성화 — Toast `aria-live` 이슈(위 4번, 수정 완료) 외에는 요구사항 충족.

## 재작업 결과

Minor 1, 2, 4는 코드 수정으로 반영 완료(commit `bb007e3`). Minor 3, 5는 반려(기능적 영향
없음/문서 정합성 이슈).
