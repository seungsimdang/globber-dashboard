# 프로젝트 규칙

이 파일은 프로젝트 소유다. 범용 하네스(seungness)와 동기화하지 않는다. 범용 역할·스킬·규칙 문서가 "`docs/agent-rules/project.md`의 ~"라고 가리키는 값을 여기에 적는다. 비어 있는 항목은 에이전트가 추측하지 않고 사용자에게 묻는다.

## 스택과 프레임워크 문서

- 스택: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, TanStack Query v5, Zustand, Radix UI(`radix-ui`), CVA·`clsx`·`tailwind-merge`, Vitest·Testing Library(jsdom), pnpm
- 구현 전 확인할 프레임워크 문서: `node_modules/next/dist/docs/` (이 저장소의 Next.js는 학습 데이터와 다를 수 있음, 규칙은 `nextjs.md`)
- 백엔드: 실제 도시 API(dev 서버)를 Next 서버(Route Handler `src/app/api/cities*`)가 프록시한다. DB는 없고 영속 데이터는 실제 API가 가진다. 상류 계약과 내부 엔드포인트 계약은 `artifacts/task-team/api-spec.md`와 `src/docs/city-api-reference.md`가 기준이며, 확인되지 않은 서버 동작은 "확인 필요"로 표시한다. 상류 주소·토큰·테스트 계정 이메일은 서버 환경 변수(`.env.example` 참고)로만 다루고 코드·문서에 실제 값을 적지 않는다. 필수 필드·위경도·alpha-3 형식 검증은 Route Handler가 권위 있게 수행하고, 폼은 즉시 피드백용으로 같은 규칙을 검사한다.
- 인증: 환경 변수 기반 단일 계정 로그인(`src/lib/session.ts`, `src/proxy.ts`). 상세는 `nextjs.md` 3번

## 디렉터리

| 경로 | 용도 |
| --- | --- |
| `src/` | 소스 (`app/`, `components/`, `hooks/`, `services/`, `lib/`, `types/`, `utils/`) |
| `src/components/common/` | 공용 컴포넌트 |
| `src/services/` | API 호출 레이어(`cityService.ts`). 내부 엔드포인트를 `apiClient`로 호출하고 도메인 타입만 반환 |
| `src/lib/server/` | 서버 전용 모듈(세션 래퍼, 상류 토큰, 상류 호출). `"use client"` 파일에서 import 금지 |
| `src/types/city.ts` | API 요청/응답 계약의 단일 소스 |
| `tests/` | 테스트 (`src/` 구조를 따라 `components/`, `services/` 등) |

전체 디렉터리 규칙은 `project-structure.md`를 따른다.

## 검증 명령

| 구분 | 명령 |
| --- | --- |
| 정적 검사 | `pnpm lint` |
| 타입 검사 | `pnpm type-check` (`next typegen && tsc --noEmit`) |
| 전체 테스트 | `pnpm test` (`vitest run`) |
| 빌드 | `pnpm build` |

CI(`.github/workflows/ci.yml`)도 lint → type-check → test → build 순서로 실행한다.

## 테스트 위치

`tests/` 아래에 `src/`의 경로를 따라 `*.test.ts`·`*.test.tsx`로 둔다(예: `src/services/cityService.ts` → `tests/services/cityService.test.ts`). Vitest 기본 수집 패턴을 쓰며 `vitest.config.ts`가 `.claude/worktrees/**`를 제외한다. 설정 파일은 `vitest.setup.ts`(jest-dom)다.

## 스타일 규칙

- Tailwind v4 표준 스케일을 그대로 쓴다(`p-4`=1rem). 표준 클래스 우선, 임의값 `[]` 최소화, `cn()`은 조건부 클래스에만, CVA는 `defaultVariants` 필수. 상세는 `tailwind.md`
- 데스크톱 우선(최소 지원 너비 1024px)
- 인터랙티브 컴포넌트는 `src/components/common/`에 없으면 Radix UI primitive(`radix-ui`)로 구현 가능한지 먼저 확인한다.
- 데이터 페칭은 서비스 → 훅 → 컴포넌트 계층과 `queryKeys`·`queryOptions()` 규칙을 따른다. 상세는 `react-query.md`

## 커밋

- scope 예시: `cities`, `ui`, `auth`, `hooks`, `ci`, `deploy`, `deps`, `harness`
- pre-commit 훅은 없다(Husky에는 하네스용 commit-msg·post-commit·post-merge만 있음).

## Git 훅

Husky(`.husky/`, `prepare` 스크립트로 `pnpm install` 때 설치)에 아래 세 훅이 등록돼 있다. 범용 하네스 동기화용이다.

- commit-msg: `sh .harness/check-scope.sh "$1"`
- post-commit: `sh .harness/sync.sh commit`
- post-merge: `sh .harness/sync.sh commit`

## 프로젝트 전용 규칙 문서

`docs/agent-rules/`에 프로젝트 전용 규칙 파일을 추가하면 이 표에 적고, `.harness/paths` 끝에 `!docs/agent-rules/{name}.md` 줄을 추가한다.

| 규칙 | 읽는 시점 |
| --- | --- |
| `nextjs.md` | 페이지·라우팅·인증·Server/Client 컴포넌트 작업 전 |
| `tailwind.md` | UI 스타일 작업 전 |
| `react-query.md` | 데이터 페칭·서비스·훅 작업 전 |
| `project-structure.md` | 파일 추가·이동, 서비스·서버 모듈 작업 전 |

프로젝트 전용 에이전트 `devops-engineer`(`.claude/agents/devops-engineer.md`, `.codex/agents/devops-engineer.toml`)도 동기화에서 제외한다.


## 공용 커밋 검사

`.husky/pre-commit`은 `node .harness/pre-commit.mjs`를 실행한다. 공용 검사기가 `.harness/checks.json`의 프로젝트 추가 검사, 경고 차단 lint, 타입 검사와 공용 하네스 테스트를 순서대로 실행한다. 신원 제한은 설정된 프로젝트의 로컬 커밋에 적용한다. CI는 같은 검사기를 PR 기준 임시 Git 인덱스로 실행하고 파일 자동 수정이 발생하면 실패한다.
