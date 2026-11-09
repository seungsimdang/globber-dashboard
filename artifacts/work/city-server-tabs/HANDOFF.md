# Handoff: city-server-tabs

## 먼저 읽을 순서

1. `artifacts/work/city-server-tabs/STATUS.md`
2. `artifacts/task-team/requirements.md`의 "2차" 절(S-01~S-09, 2-9 사용자 결정 U-1~U-5, 확인 필요 C-1~C-7)
3. `artifacts/task-team/api-spec.md`의 "# 2차: 운영·개발 서버 분리" 절(2-A~2-H, 사용자 승인)
4. `artifacts/task-team/design-spec.md`의 "2차: 운영·개발 탭" 절(2-A~2-I, 2-I에 사용자 결정)
5. `artifacts/task-team/implementation-3.md`(백엔드), `implementation-4.md`(프런트)의 "리뷰 확인 필요"·"확인하지 못한 것"

## 핵심 결정

- 대시보드 `/cities`에 운영·개발 탭. 기본 운영, 선택 유지 안 함, 검색어 유지, 모달 열린 동안 탭 전환 불가
- 모든 `/api/cities*`에 필수 쿼리 `server=prod|dev`. 누락·미지 값 400, 기본값 대체 없음
- 판정 순서: 세션 401 → server 400 → 운영 쓰기 403(본문·환경 변수 읽기 전, 상류 호출·토큰 발급 0회) → 기존 검증 → 상류 호출
- 환경 변수 `CITY_API_PROD_BASE_URL`(값이 `/api`로 끝남), `CITY_API_DEV_BASE_URL`, `CITY_API_TEST_EMAIL`(개발 쓰기 전용). `CITY_API_BASE_URL`은 폴백 없이 제거
- 운영 쓰기 버튼: 네이티브 `disabled` + 안내 줄 "운영 서버는 쓰기 인증 준비 전이라 조회만 할 수 있습니다." + `aria-describedby`. `Button` 공용 컴포넌트 변경 없음
- 모달·삭제 다이얼로그 제목 접두어 `[개발] `
- 빈 목록 안내 속 중복 `도시 추가` 버튼과 `CityListTable`의 `onAddCity` prop 제거(두 탭 공통, 사용자 결정)
- 개발 목록 미리 조회 안 함(프런트 구현 판단, implementation-4.md)
- 서버별 주소 읽기 함수는 순환 import 회피로 `cityServer.ts`가 아닌 `cityApiToken.ts`에 둠(명세와 다름, implementation-3.md)

## 변경 파일

메인 체크아웃, 미커밋.

- 백엔드: `src/lib/server/cityServer.ts`(신규), `src/lib/server/cityApiToken.ts`, `src/lib/server/cityUpstream.ts`, `src/app/api/cities/route.ts`, `src/app/api/cities/[cityId]/route.ts`, `.env.example`, `src/docs/city-api-reference.md`, `docs/agent-rules/project.md`
- 프런트: `src/components/common/Tabs.tsx`(신규), `src/components/cities/CitiesPageContent.tsx`, `CityListTable.tsx`, `CityFormModal.tsx`, `DeleteConfirmDialog.tsx`, `src/hooks/useCities.ts`, `useCityMutations.ts`, `src/lib/react-query/query-keys.ts`, `src/services/cityService.ts`, `src/utils/cityErrorMessage.ts`
- 공통: `src/types/city.ts`(`CityServer` 타입 한 줄)
- 기존 테스트 갱신(신규 케이스 없음): `tests/app/api/cities/route.test.ts`, `tests/app/api/cities/cityId/route.test.ts`, `tests/lib/server/cityApiToken.test.ts`, `cityUpstream.test.ts`, `tests/services/cityService.test.ts`, `tests/hooks/useCityMutations.test.tsx`, `tests/components/CityFormModal.test.tsx`, `CityListTable.test.tsx`, `DeleteConfirmDialog.test.tsx`
- 구현 기록: `artifacts/task-team/implementation-3.md`, `implementation-4.md`(신규)

## 검증 결과

| 명령 | 결과 | 실행 여부 | 비고 |
| --- | --- | --- | --- |
| `pnpm lint` | 오류 출력 없음 | 실행(병합 후 메인) | |
| `pnpm type-check` | 통과 | 실행(병합 후 메인) | |
| `pnpm test` | 14파일 131개 통과 | 실행(병합 후 메인) | 새 동작 전용 테스트 없음 |
| `pnpm build` | 성공 | 실행(병합 후 메인) | |
| 운영 조회 경로 GET | `{운영 기준 주소}/api/v1/cities/all` 200, `/api` 뺀 경로 404 | 실행 | 운영 기준 주소가 `/api`로 끝나는 설계 확인 |
| 백엔드·프런트 설정 오류 문구 대조 | `서버 설정 오류` 접두어 일치 | 실행(grep) | `cityApiToken.ts:27,37`, `cityErrorMessage.ts:13` |
| 브라우저(Playwright, 사용자 dev 서버 3000) | 탭 운영·개발, 기본 운영. 운영: `운영 서버 전체 4,204개`, 안내 줄 표시, `도시 추가` disabled + `aria-describedby`, 수정·삭제 아이콘 비활성. 개발: `개발 서버 전체 3,791개`, 안내 줄 없음, 모달 제목 `[개발] 도시 추가`. 방향키로 탭 전환, 검색어 `서울` 유지(운영 1개·개발 1개), 모달 열린 동안 탭 클릭 불가. 콘솔 오류 없음 | 실행 | 로컬 `.env`에 두 기준 주소 변수 추가 후. 쓰기 요청은 보내지 않음 |
| 운영 응답 envelope GET | `{status:"success", data:[4,204건]}`, 필드 `cityId·cityName·countryCode·countryName·lat·lng` | 실행 | `src/types/city.ts`의 `CityApiData` 필드와 일치(requirements C-5 해소) |
| 실서버 쓰기(토큰·401 재시도 등) | - | 미실행 | 사용자 승인 없음(1차부터 이월) |

## 참조 산출물

- `artifacts/task-team/00-input.md`: "T01 (2차)" 절이 사용자 요청 원문
- `artifacts/task-team/summary.md`, `improvement-log.md`: 1차 사이클 결과. 2차 결과는 아직 반영 안 함
- `artifacts/task-team/triage-*.md`, `code-review-*.md`, `security-review-*.md`, `qa-report-1.md`: 1차 사이클 기록. 2차 리뷰는 다음 번호(`code-review-4.md`, `security-review-3.md`, `qa-report-2.md`)부터

## 미해결 항목과 사람 승인

- 구현 변경 커밋·push 승인(PR #19, `feature/real-city-api`). 미푸시 커밋 `a876e65`, `43f22ef`도 함께
- requirements C-1~C-7 확인 필요 항목(IP·도메인 개발 서버 동일 여부, 서버 간 id 의미, 운영 쓰기 인증 수단, 운영 응답 형식·호출 허용량, 배포 환경 변수 재설정)
- 1차 이월 미검증: 실서버 쓰기 동작, `providers.tsx` 재시도 규칙 단위 테스트, 입력 지연·스크린리더
- 구현 기록의 리뷰 확인 필요: 검색 입력·건수 줄을 탭 패널 밖에 둔 점(design-spec 2-C와 차이), 안내 줄 `-mt-3` 등 화면 미확인 스타일
- 병합 대상: `docs/agent-rules/branch-strategy.md`는 `develop`을 요구하나 저장소에 `develop` 없음. PR #19 병합은 사용자 결정

## 다음 담당자가 할 일

1. `git status`로 위 변경 파일이 메인 체크아웃에 그대로 있는지 확인
2. 사용자 승인 후 관심사별로 커밋(`.claude/skills/git-commit` 규칙, 한 Bash 호출당 커밋 1개)하고 push
3. task-team-orchestrator 9번부터 진행: T07·T08 병렬 리뷰 → 9-1 게이트 → T09 QA → summary·improvement-log 갱신
