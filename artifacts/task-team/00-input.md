# T01 - 사용자 요청 Intake

## 사용자 요청 원문

> candanta의 하네스 내용과 현재 프로젝트(17th-team1-client) 내용을 참고하여 도시 추가/수정/삭제를
> 할 수 있는 관리자 대시보드를 만들어줘. 참고로 도시 추가/수정/삭제 API는 개발중이야. 일단 목업으로
> 구성해줘.

## 추가로 제공된 맥락 (오케스트레이터가 사용자로부터 그대로 전달받음)

- 목록 조회(Read)는 명시되지 않았지만 CRUD의 자명한 전제로 범위에 포함한다.
- 실제 백엔드 API 계약은 `src/docs/city-api-reference.md`에 17th-team1-client 원본
  (`src/types/city.ts`, `src/services/cityService.ts`)에서 정리되어 있다.
  `AddCityRequest`/`DeleteCityRequest`/`CityApiData`/`City` 타입과 실제 엔드포인트 경로 포함.
  "수정(update)" 계약은 원본 저장소에도 없어 backend-developer가 추론해 `api-spec.md`에 확정한다.
- `src/services/cityService.ts`는 목업으로 구현하되 함수 시그니처(파라미터/반환 타입)는 실제 API
  계약과 동일하게 유지한다 - 추후 실제 fetch 호출로 내부 구현만 교체 가능해야 한다.
- 목업 데이터/지연/에러 시뮬레이션은 `src/mocks/`에 둔다.
- 인증/로그인은 이번 범위에서 제외한다 (내부 전용 도구로 가정).
- 스택: Next.js 16 App Router, TypeScript strict, Tailwind v4, clsx/tailwind-merge(`cn()`),
  class-variance-authority, zustand, @tanstack/react-query, lucide-react.
  테스트: vitest + @testing-library/react (`pnpm test`, `pnpm test:watch`).
  `pnpm type-check`, `pnpm lint`, `pnpm build` 사용 가능.

## 실행 모드 확인

- `artifacts/bug-team/postmortem-*.md`: 없음 (초기 실행).
- `artifacts/task-team/`: 비어 있음 (초기 실행).
- → **초기 실행**으로 진행.

## 모호한 항목 (플래그)

1. 도시 "수정" API의 실제 계약이 원본 저장소에 없음 - backend-developer가 `AddCityRequest`와
   대칭되는 형태로 추론해 확정해야 함.
2. 목업 에러 시뮬레이션 정책(실패율, 어떤 케이스에서 에러를 던질지)이 명시되지 않음 -
   project-manager/backend-developer가 결정 필요.
3. 관리자 대시보드의 인증 방식은 이번 범위 밖이라고 명시되었으나, 향후 확장 여지를 어떻게
   남길지는 미정 (이번 범위에서는 고려하지 않음).
4. 도시 검색/페이지네이션 등 목록 조회의 상세 UX(정렬, 필터, 페이지 크기)는 명시되지 않음.

## 승인 지점 플래그

- 원래 SKILL.md 절차상 T02(requirements.md) 완료 후 사용자 확인 게이트가 있으나, **이번 실행에서는
  오케스트레이터를 스폰한 상위 세션이 전체 자동 진행을 이미 승인**했으므로 생략한다. 대신
  project-manager는 requirements.md의 "확인 필요" 섹션에 위 모호한 항목들을 명확히 남기고,
  오케스트레이터는 최종 보고에서 이를 요약해 사용자에게 전달한다.
