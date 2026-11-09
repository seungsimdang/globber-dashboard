# 재작업 추가 테스트 diff 리뷰 6

## 사용자 지적 후 D-2 판정 정정

이 보고서의 D-2 제외 수용은 철회한다. 디자인 명세의 D-2는 권장안이며 사용자 승인 기록이 확인되지 않았다. CodeRabbit 추가 finding 0건과 별개로 QA가 재현한 중복 누락은 VALID 결함으로 남고, 현재 보완/보류 사용자 결정 대기다. `triage-4.md`의 정정이 우선한다.

## 판정

**통과.** 검토 범위는 `coderabbit review --agent --uncommitted`가 대상으로 삼은 현재 staged/unstaged 추적 변경입니다. 좌표 가드, 추가 QA 테스트와 앞서 확인된 문서 보완을 검토했습니다. CodeRabbit 결과는 finding 0건입니다.

## 자체 확인

- `src/lib/server/geocode.ts` 좌표 타입 가드는 숫자·숫자 문자열만 변환하고 기존 유한성·범위 검사를 유지합니다. 정상 좌표 `0`도 허용됩니다.
- 신규 테스트는 실제 소스 모듈을 import하거나 동적 import합니다: Route Handler, `CitiesPageContent`, `CityFormModal`, `CountryCombobox`/`countryOptions`, `cityServer`, 서버 `geocode` 함수. 테스트 내부에 프로덕션 로직을 복사해 그 복사본만 검증하는 패턴은 확인하지 않았습니다.
- CodeRabbit의 `reviewedFiles` 결과에 `src/lib/server/geocode.ts`와 변경·신규 테스트 파일 10개가 포함되어 신규 QA 테스트도 외부 리뷰 대상이었음을 확인했습니다.
- 이전 CodeRabbit Low finding은 현재 문서에서 정리된 상태입니다. `00-input.md`, `requirements.md`, `api-spec.md`의 실제 개발 주소 문자열은 마스킹됐고, `city-server-tabs` STATUS/HANDOFF에는 미커밋 상태를 나타내던 stale 문구가 없습니다. 주소 값은 이 보고서에 적지 않습니다.
- 이전에 triage된 승인 계약은 재평가 finding으로 올리지 않았습니다: D-2 중복검사 위험, 클라이언트 1,000ms·서버 1,100ms 간격, 도시/국가 변경 후 좌표 보존, 실측된 운영 URL 경로.

## CodeRabbit 교차검토

- 실행 명령: `coderabbit review --agent --uncommitted`
- 상태: **완료(exit 0).** 사용자 승인에 따라 외부 리뷰를 수행했습니다. `--include-untracked`는 사용하지 않았고, CodeRabbit 상태는 `reviewType: uncommitted`였습니다.
- 범위 증거: 완료 결과의 `reviewedFiles`에는 재작업 소스와 신규·수정된 테스트 10개가 포함됐습니다. 미추적 산출물은 검토 범위에 포함하지 않았습니다.
- 결과: finding 0건. **VALID 0건, SKIP 0건.**

## 검증 한계

- 테스트 실행은 QA가 진행 중이므로 이 리뷰에서 실행하지 않았습니다. QA의 최종 전체 테스트 결과는 별도 산출물에서 확인해야 합니다.
- 실서버 요청 및 브라우저 동작 검증은 포함하지 않았습니다.
