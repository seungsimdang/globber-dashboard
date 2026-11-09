# Handoff: city-input-assist

## 먼저 읽을 순서

1. `artifacts/work/city-input-assist/STATUS.md`
2. `artifacts/task-team/00-input.md`의 "# T01 (3차)" 절
3. `artifacts/task-team/requirements.md`의 "# 3차" 절(I-01~I-09, 3-9 사용자 결정 확정)
4. `artifacts/task-team/api-spec.md`의 "# 3차: 위치 검색 프록시"(3-0 Nominatim 정책, 3-A~3-I)
5. `artifacts/task-team/design-spec.md`의 "# 3차: 도시 입력 보조"(3-A~3-I)
6. `artifacts/task-team/implementation-5.md`(프런트), `implementation-6.md`(백엔드)의 "리뷰 확인 필요"·"확인하지 못한 것"
7. 2차 미완료 항목: `artifacts/work/city-server-tabs/HANDOFF.md`

## 핵심 결정

- 건수 줄에서 서버 이름 제거: `전체 N개`, `검색 결과 N개 / 전체 N개`
- 국가 입력: 인라인 ARIA combobox(`CountryCombobox`). 목록은 alpha-3 표(`ALPHA3_CODES`) + `Intl.DisplayNames(['ko'])` 이름만 사용(사용자 결정 N-1, 기존 데이터 국가명 미사용). 국가명은 선택으로 자동 채움·수정 불가. 국기 없음
- N-1 영향(사용자 인지): 11개국은 저장 시 국가명이 `Intl` 이름으로 바뀜(예: 한국→대한민국). `HKR`·`ZYC` 도시 수정 시 국가를 다시 골라야 함
- `radix-ui` 1.6.7(설치 버전 확인)에 Combobox export 없음 → 직접 구현
- 위치 찾기: `GET /api/geocode?city=&country=`(alpha-3, `withSession`). 선택 국가로만 검색(`countrycodes`) + 국가 불일치·국가코드 없는 후보 서버 제외. 후보 최대 5, 자동 확정 없음, 위경도 수동 입력 유지, `© OpenStreetMap 기여자` 출처 표기
- Nominatim 정책(공식 페이지 확인): 초당 최대 1회, 앱 식별 User-Agent, 출처 표기, 자동완성 금지, 반복 질의는 캐시 필요
- 서버: 인스턴스 메모리 캐시(TTL 10분, 최대 100건), 최소 호출 간격 1,100ms 위반 시 429 `RATE_LIMITED`. 다중 인스턴스 전역 보장 없음(문서화). 선택 환경 변수 `NOMINATIM_USER_AGENT`, `NOMINATIM_DISABLED`
- 클라이언트: `useMutation` 기반 `useGeocode`, 입력 변경·모달 닫힘·저장 시작 시 `reset()`으로 늦은 응답 무시. 국가 목록이 열린 상태의 Esc는 목록만 닫음(Dialog `onOpenChange`에서 무시)

## 변경 파일 (메인 체크아웃, 로컬 커밋 완료)

Codex 인계 후 로컬 커밋: 서버 `8890586`, 프런트 `b00958c`. 각 커밋의 lint·타입·하네스 검사 훅 통과(109 통과, 5 건너뜀). 앱 전체 테스트·빌드는 아래 이전 세션 기록이며 이번 세션에서는 아직 재실행하지 않음.

- 백엔드: `src/app/api/geocode/route.ts`(신규), `src/lib/server/geocode.ts`(신규), `.env.example`, `src/docs/city-api-reference.md`
- 프런트: `src/components/cities/CountryCombobox.tsx`(신규), `src/components/cities/CityFormModal.tsx`, `src/utils/countryOptions.ts`(신규), `src/services/geocodeService.ts`(신규), `src/hooks/useGeocode.ts`(신규), `src/utils/cityErrorMessage.ts`
- 테스트: `tests/components/CityFormModal.test.tsx`(갱신, 형식 오류 테스트 1건 삭제)
- 구현 기록: `artifacts/task-team/implementation-5.md`, `implementation-6.md`(신규)
- 이미 커밋: `src/types/city.ts`(Geocode 타입), `src/utils/countryFlagMapping.ts`(`toAlpha2`, `ALPHA3_CODES`) - `6d05a2d`

## 검증 결과

| 명령 | 결과 | 실행 여부 | 비고 |
| --- | --- | --- | --- |
| `pnpm lint` | 통과 | 실행(병합 후 메인) | |
| `pnpm type-check` | 통과 | 실행(병합 후 메인) | |
| `pnpm test` | 14파일 130개 통과 | 실행(병합 후 메인) | 새 동작 전용 테스트 없음 |
| `pnpm build` | 성공 | 실행(병합 후 메인) | |
| `/api/geocode` (로컬 dev 서버, curl) | 서울+KOR 200 1건, Paris+USA 200(미국만, region `텍사스, Lamar County`), 빈 도시명 400 `INVALID_INPUT`, `HKR` 400 `INVALID_INPUT`, 쿠키 없음 401, 서로 다른 질의 연속 호출 시 2번째 429 `RATE_LIMITED`, 같은 질의 재호출 200(캐시) | 실행 | Nominatim 실제 호출 포함 |
| 브라우저(Playwright, 1024x768, 개발 탭) | 건수 줄 `전체 3,791개`, 라벨 도시명·국가명·위도·경도, "대한" 입력 → `대한민국 KOR`, 선택 후 `국가코드 KOR` 줄, 부산 위치 찾기 → 후보 `1. 부산광역시, 대한민국` + 출처 표기, 후보 클릭 → 위도 35.1799528·경도 129.0752365 채움·위도 칸 포커스, 60개 목록(240px)이 모달 밖으로 겹쳐도 화면 안에 보임(잘림 없음), 목록 열린 상태 Esc → 목록만 닫히고 모달 유지, 콘솔 오류 없음, 쓰기 요청 없음 | 실행 | 저장 버튼은 누르지 않음 |
| 실서버 쓰기·저장 흐름 | - | 미실행 | 사용자 승인 없음 |

## 미해결 항목과 사람 승인

- 2026-11-09 Codex 인계 후 사용자가 로컬 커밋만 승인. push는 미승인
- 디자인 D-2: 국가명이 `Intl` 이름으로 바뀌면 `findDuplicateCity`가 기존 표기(예: 한국) 도시와의 중복을 놓칠 수 있음. 이번 범위에서 미변경, QA에서 확인 필요
- implementation-5 리뷰 확인 필요: 저장 시작 시 위치 후보를 비워 저장 실패 후 후보가 돌아오지 않음, `Intl` 이름이 ICU 버전에 따라 달라질 수 있고 테스트가 `대한민국`·`일본` 이름에 의존
- implementation-6 리뷰 확인 필요: 일부 후보만 형식 오류면 200, 상류 실패도 호출 간격에 포함, 타임아웃 판정(`TimeoutError`)
- 서울 결과의 `region`은 null(상위 행정구역 없음), 배포 환경(Vercel)에서 Nominatim 차단 여부 미확인
- 배포 환경 변수: 2차의 `CITY_API_PROD_BASE_URL`·`CITY_API_DEV_BASE_URL` 추가와 `CITY_API_BASE_URL` 삭제가 여전히 필요

## 다음 담당자가 할 일

1. `git status`로 위 변경 파일이 메인 체크아웃에 그대로 있는지 확인
2. 승인 범위에 따라 관심사별로 로컬 커밋(`.agents/skills/git-commit`, 한 호출당 커밋 1개). push하지 않음
3. task-team-orchestrator 9번부터: 2차·3차 diff를 함께 T07·T08 병렬 리뷰(다음 번호 `code-review-4.md`, `security-review-3.md`) → 9-1 게이트 → T09 QA(`qa-report-2.md`) → summary·improvement-log 갱신
