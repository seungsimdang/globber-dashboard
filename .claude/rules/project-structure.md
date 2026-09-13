# globber-dashboard 프로젝트 구조 규칙

Globber 도시 데이터 관리용 Next.js 16 App Router 어드민 대시보드. 백엔드 API가 아직
없으므로 DB/서버 레이어 없이 순수 프론트엔드 + 목업 서비스 레이어로 구성한다.

## 디렉터리

| 경로 | 용도 |
| --- | --- |
| `src/app/` | App Router 페이지. `cities/`(도시 관리 메인 화면) |
| `src/components/common/` | 도메인 무관 공용 컴포넌트 (Button, Input, Dialog, Table 등) |
| `src/components/cities/` | 도시 관리 도메인 컴포넌트 (CityTable, CityFormModal 등) |
| `src/services/` | API 호출 레이어. `cityService.ts` - 지금은 목업 구현, 시그니처는 실제 API와 동일 |
| `src/mocks/` | 목업 데이터/지연·에러 시뮬레이션 유틸 (`mockCities.ts`, `mockDelay.ts`) |
| `src/lib/` | `apiClient.ts`(fetch 래퍼), `react-query/query-keys.ts` |
| `src/hooks/` | 커스텀 훅. `useCities.ts`, `useCityMutations.ts` 등 |
| `src/types/` | 도메인별 타입. `city.ts`가 API 요청/응답 계약의 단일 소스 |
| `src/schemas/` | Zod 스키마 (폼 유효성 검사) |
| `src/constants/`, `src/utils/` | 공용 상수 / 클라이언트 유틸(`cn.ts`) |
| `src/docs/city-api-reference.md` | 17th-team1-client의 실제 도시 API 계약 참조 문서 |

## 핵심 규칙

1. **파일 네이밍**: 컴포넌트 파일은 PascalCase(`CityTable.tsx`), 그 외는 camelCase
   (`cityService.ts`, `useCities.ts`).
2. **목업과 실제 API 계약 분리 금지** - `src/services/cityService.ts`의 함수 시그니처
   (파라미터·반환 타입)는 `src/types/city.ts`에 정의된 실제 API 계약과 동일하게 유지한다.
   실제 백엔드가 준비되면 함수 내부의 목업 로직만 `fetch` 호출로 교체하면 되어야 한다.
3. **목업 지연/에러는 `src/mocks/mockDelay.ts`로 통일** - 컴포넌트마다 임의의
   `setTimeout`/`Math.random` 에러율을 만들지 않는다.
4. **목업 데이터는 모듈 스코프 배열로 상태 유지** - 새로고침 전까지는 추가/수정/삭제가
   반영되어야 자연스러운 CRUD 데모가 된다 (`src/mocks/mockCities.ts`).
5. 죽은 코드·미사용 export는 즉시 제거한다.
6. 커밋은 `.claude/skills/git-commit/SKILL.md` 규칙을 따른다.
