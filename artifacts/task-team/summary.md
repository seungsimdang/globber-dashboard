# 사이클 요약: 실제 도시 API 연동

브랜치 `feature/real-city-api` (기준 `f2ae642`, 로컬 커밋 17개, 미푸시)

## 결과

목업 서비스 레이어를 실제 Globber 도시 API로 교체했다. 브라우저는 Next 서버의 내부 엔드포인트(`/api/cities*`)만 호출하고, Route Handler가 세션을 확인한 뒤 상류 API를 호출한다.

- 조회: 전체 목록(3,791건)을 1회 받아 클라이언트에서 도시명·국가명으로 필터링(공백·대소문자 무시), 가상 스크롤로 렌더링
- 쓰기: 서버 메모리 토큰(dev `/dev/test-login`)으로 호출, 토큰 없음·401이면 재발급 후 1회 재시도, 동시 발급 합류
- 국가코드 ISO alpha-3 전환, 국기 변환 표 교체
- 오류: 상류 오류를 고정 메시지·상태 코드로 매핑, 화면 문구는 `cityErrorMessage.ts`로 통일
- 보안: 모든 Route Handler 세션 강제, 415(비 JSON 쓰기), `redirect: "error"`, 응답 `no-store`, 클라이언트 번들에 상류 주소·토큰 모듈 없음
- 의존성: `@tanstack/react-virtual@3.14.23` 추가, Next.js 16.3.5 → 16.4.3(Critical 권고 해소), `source-map-js` 1.2.2 고정. `pnpm audit --prod` 0건

## 검증

lint 0건, type-check 통과, 테스트 14파일 131개 통과(신규 86개), build 성공. 실데이터 조회·가상 스크롤·검색은 로컬 서버와 브라우저로 확인(`qa-report-1.md` orchestrator 추가 검증).

## 리뷰

| 단계 | 결과 | 기록 |
| --- | --- | --- |
| 1차 코드·보안 | 타당 finding 재작업, 기각 5건 | `code-review-1.md`, `security-review-1.md`, `triage-1.md` |
| 2차 코드 재리뷰 | 통과, 재작업 6건 모두 해소 | `code-review-2.md` |
| 사이클 최종 코드·보안 | 통과·배포 승인, Low 5건 사용자 결정으로 수정 | `code-review-3.md`, `security-review-2.md`, `triage-3.md` |
| QA | 신규 86개 통과, 실패 0 | `qa-report-1.md` |

사이클 밖 기존 문제 중 사용자 결정으로 포함: Next.js 보안 업그레이드, 하네스 테스트의 실제 이메일 교체.

## 배포 전 확인 필요 (미검증)

1. 운영 쓰기 방법: 운영 서버에는 `/dev/test-login`이 없다(404 확인). 운영에서 쓰기를 하려면 별도 방법이 필요하다
2. 실서버 쓰기 동작: 테스트 이메일 미제공, 데이터 변경 승인 없음. 토큰 발급·401 재시도·중복/없는 id 응답·토큰 만료·`Bearer` 접두사 미확인
3. 환경 변수 `CITY_API_BASE_URL`, `CITY_API_TEST_EMAIL` 배포 환경 설정
4. `providers.tsx` 재시도 규칙 단위 테스트 없음(비공개 함수, 코드 읽기로만 확인)
5. 한 글자씩 입력 시 지연, 스크린리더 검증

## 남은 정리

- 로컬 브랜치 `worktree-agent-a0cf1b628afc8362a`(이전 사이클 잔여, amend 전 커밋을 가리켜 `-d` 실패): 삭제에 `-D` 승인 필요
- 브랜치 전략상 병합 대상은 `develop`이나 이 저장소에는 `develop`이 없다. push·PR·병합 대상은 사용자 결정
