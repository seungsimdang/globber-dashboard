# 구현 기록 6: 3차 위치 검색 프록시 (T06 백엔드)

기준: `api-spec.md` "3차: 위치 검색 프록시". 커밋하지 않았다(orchestrator가 병합·커밋).

## 변경 파일

- `src/app/api/geocode/route.ts` (신규): `GET`, `withSession`. 쿼리 `city`(getAll)·`country`를 읽어 `searchGeocode`에 넘긴다.
- `src/lib/server/geocode.ts` (신규): 입력 검증, Nominatim 호출(고정 호스트·경로, `URLSearchParams`, 5초 타임아웃, `redirect: "error"`), 후보 정제, 오류 매핑(`code`), 캐시(TTL 10분·100건), 최소 호출 간격 1,100ms, User-Agent 상수와 `NOMINATIM_USER_AGENT` 덮어쓰기, `NOMINATIM_DISABLED`.
- `.env.example`: 선택 변수 2개 placeholder.
- `src/docs/city-api-reference.md`: 새 엔드포인트 계약과 다중 인스턴스 한계.
- 기존 커밋된 `GeocodeCandidate` 등 타입과 `toAlpha2`를 import해 사용(수정 없음). 기존 테스트 수정 없음.

## 명세와 다른 점

- 파일명: 명세 3-C는 `nominatim.ts`였으나 지시에 따라 `src/lib/server/geocode.ts`로 만들었다.
- `NOMINATIM_DISABLED`는 `true`(대소문자 무시, trim)일 때만 비활성으로 본다. 명세는 "true이면"이라고만 적어 그대로 따랐다. 비활성 검사는 입력 검증보다 먼저 한다(상류 미호출은 어느 쪽이든 같음).
- 제어 문자 제거 범위는 `U+0000~U+001F`, `U+007F`로 정했다(명세는 "제어 문자"만 적음).

## 리뷰 확인 필요 (명세 근거 없이 추론으로 정한 결정)

- `region`은 `address.state`, `address.county` 순서로 있는 값을 쉼표로 합친다. 명세가 "구현 단계에서 실제 응답으로 확정"이라 했으나 Nominatim을 호출하지 않아 키 선택은 추론이다(비어 있으면 `null`).
- 일부 후보만 형식 오류(좌표 범위·표시명·place_id)이면 그 후보만 버리고 성공으로 응답한다. 상류 항목이 있고 전부 형식 오류일 때만 `UPSTREAM_BAD_RESPONSE`다. 국가 불일치로만 모두 버려지면 200 빈 배열(명세 3-D와 같음).
- 간격 기록은 상류 호출 시작 시점에 갱신하며 상류 실패(타임아웃 포함)도 간격 계산에 포함된다. 캐시 적중·검증 실패는 갱신하지 않는다.
- 캐시 만료 항목은 조회 시점에 삭제하고, 저장 시 한도(100건)를 넘으면 삽입 순서가 가장 오래된 항목을 제거한다(재저장하면 최신 위치로 이동).
- 오류 로그는 상태코드와 code만 남기고 도시명·URL은 남기지 않는다.
- 타임아웃 판정은 `DOMException`의 `name === "TimeoutError"`다. 그 외 fetch 예외(`redirect: "error"` 위반 포함)는 `UPSTREAM_ERROR`다.

## 확인하지 못한 것

- Nominatim을 실제로 호출하지 않았다(금지). 응답 형태(`address.country_code` 존재 여부, `type` 값, 한국어 이름)는 공식 문서 기준 가정이다.
- 새 Route Handler·캐시·간격 로직의 동작 테스트는 작성하지 않았다(qa-engineer 소관). 따라서 이 경로는 타입 검사만 통과했고 실행으로 검증되지 않았다.
- 다중 인스턴스에서의 실제 호출 빈도, 배포 IP 제한은 확인할 수 없다.

## 검증 (worktree에서 `pnpm install --frozen-lockfile` 후 폴더 지정 없이 실행)

- `pnpm lint`: 오류·경고 없음
- `pnpm type-check`: 오류 없음 (첫 실행에서 `code` 초과 속성 오류가 나 `GeocodeFail` 타입 변수로 고쳐 재실행)
- `pnpm test`: 14 파일, 131 테스트 통과
