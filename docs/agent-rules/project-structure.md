# globber-dashboard 프로젝트 구조 규칙

Globber 도시 데이터 관리용 Next.js 16 App Router 어드민 대시보드. DB는 없고 Next 서버가 실제 도시 API를
프록시한다(Route Handler `src/app/api/cities*`, 서버 전용 모듈 `src/lib/server/`).

## 디렉터리

| 경로 | 용도 |
| --- | --- |
| `src/app/` | App Router 페이지. `cities/`(도시 관리 메인 화면) |
| `src/components/common/` | 도메인 무관 공용 컴포넌트 (Button, Input, Dialog, Table 등) |
| `src/components/cities/` | 도시 관리 도메인 컴포넌트 (CityTable, CityFormModal 등) |
| `src/services/` | API 호출 레이어. `cityService.ts` - 내부 엔드포인트를 호출하고 도메인 타입만 반환 |
| `src/lib/server/` | 서버 전용 모듈(세션 래퍼, 상류 토큰, 상류 호출). `"use client"` 파일에서 import 금지 |
| `src/lib/` | `apiClient.ts`(fetch 래퍼), `react-query/query-keys.ts` |
| `src/hooks/` | 커스텀 훅. `useCities.ts`, `useCityMutations.ts` 등 |
| `src/types/` | 도메인별 타입. `city.ts`가 API 요청/응답 계약의 단일 소스 |
| `src/utils/` | 클라이언트 유틸(`cn.ts`, `countryFlagMapping.ts`) |
| `src/docs/city-api-reference.md` | 17th-team1-client의 실제 도시 API 계약 참조 문서 |

## 핵심 규칙

1. **파일 네이밍**: 컴포넌트 파일은 PascalCase(`CityTable.tsx`), 그 외는 camelCase
   (`cityService.ts`, `useCities.ts`).
2. **API 계약의 단일 소스** - `src/services/cityService.ts`의 함수 시그니처와 Route Handler는
   `src/types/city.ts`의 타입(`CityRequest`, `CityApiData`, `ApiSuccess`, `ApiFail`)을 함께 쓴다.
3. **브라우저는 상류 API를 직접 호출하지 않는다** - `src/lib/apiClient.ts`로 내부 엔드포인트만
   호출하고, 상류 호출과 토큰 관리는 `src/lib/server/`에만 둔다.
4. **사용자 문구는 `src/utils/cityErrorMessage.ts`로 통일** - 컴포넌트마다 오류 원인별
   문구를 따로 만들지 않는다.
5. 죽은 코드·미사용 export는 즉시 제거한다.
6. 커밋은 `.claude/skills/git-commit/SKILL.md` 규칙을 따른다.
