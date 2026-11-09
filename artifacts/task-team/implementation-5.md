# 구현 기록 5 (3차: 도시 입력 보조, 프런트)

## 변경 파일

수정
- `src/components/cities/CityFormModal.tsx`: 국가명·국가코드 입력칸을 `CountryCombobox`와 읽기 전용 `국가코드 XXX` 줄로 교체, 위치 찾기 블록(버튼, 후보 목록, 상태 문구, OSM 출처) 추가, 모달 폭 `max-w-lg`
- `src/utils/cityErrorMessage.ts`: 건수 줄에서 서버 이름 제거, `geocodeMessages` 묶음 추가
- `tests/components/CityFormModal.test.tsx`: 깨진 기존 테스트만 갱신(새 케이스 없음)

신규
- `src/components/cities/CountryCombobox.tsx`: 인라인 ARIA combobox
- `src/utils/countryOptions.ts`: `getCountryOptions`, `findCountryByCode`, `filterCountries`
- `src/services/geocodeService.ts`: `searchGeocode(city, country)` -> `GET /api/geocode?city=&country=`
- `src/hooks/useGeocode.ts`: `useMutation` 래퍼

## 구현 요약

- 국가 목록: `ALPHA3_CODES` x `toAlpha2` x `Intl.DisplayNames(['ko'])`, 이름이 코드 문자열이면 제외, 가나다순. 선택이 `countryName`(Intl 이름)과 `countryCode`를 채운다. 수정 모드에서 코드가 목록에 없으면 미선택으로 열고 amber 안내를 표시한다.
- 위치 찾기: 클릭 때만 호출. 요청 중 또는 클릭 후 1초, 저장 중, 도시명/국가 미입력이면 버튼 비활성(사유 문구는 `aria-describedby`). 후보는 최대 5개, 선택 시 위경도를 서버 값 문자열로 채우고 위도 칸으로 포커스 이동, 자동 확정 없음. 출처 `© OpenStreetMap 기여자`는 후보가 보일 때와 선택 줄 이후에 표시한다.
- 늦은 응답 무시: 도시명·국가 변경, 모달 닫힘, 저장 시작 때 `mutation.reset()`으로 결과 상태를 비워 이전 요청의 응답이 화면에 반영되지 않는다. 위경도는 사용자가 후보를 눌러야만 바뀐다.
- useMutation 선택 이유: 클릭 시 호출하고 결과가 캐시 대상이 아닌 폼 보조 값이라 `queryClient.fetchQuery`보다 pending/error/data 상태와 `reset()`을 그대로 쓸 수 있다. 서버 데이터를 바꾸지 않으므로 무효화할 쿼리는 없다.

## 명세와 다른 점

- Esc 처리: Radix Dialog는 document 캡처 단계에서 Esc를 처리해 combobox의 `stopPropagation`으로 막을 수 없다. `Dialog` 파일은 수정 범위 밖이라, `CityFormModal`의 `onOpenChange`에서 국가 목록이 열려 있으면(ref) 닫기 요청을 무시하는 방식으로 "Esc는 목록만 닫음"을 구현했다.
- 3-F 10번(같은 입력 재조회 시 결과 재사용)은 클라이언트에 두지 않았다. 서버 캐시(api-spec 3-F)가 담당하고 권장 사항이라 중복 구현을 피했다.
- 후보 영역은 `aria-live="polite"` 안에 후보 목록까지 포함했다(명세는 후보·로딩·0건·선택 공용 영역).
- 국가명 필드 blur 시 필수 검증은 하지 않는다(타이핑 중 이탈이 오류로 보이지 않게). 제출 시에만 검사한다.

## 리뷰 확인 필요

- 목록 잘림: 국가 목록(`max-h-60`)을 Dialog 안 인라인 absolute로 그렸다. 1024x768에서 시각 확인은 하지 못했다. Dialog content가 `overflow-y-auto`라 잘리면 스크롤 영역이 늘어나는 형태일 수 있다. 문제가 있으면 명세대로 Popover로 대체해야 한다.
- 제출 시작 때 위치 후보와 `선택한 위치` 줄을 비운다. 저장 실패 후에도 후보가 돌아오지 않는다(명세 "저장 중 응답 버림"의 해석).
- `Intl.DisplayNames` 한국어 이름이 환경(Node/브라우저 ICU)에 따라 다를 수 있다. 테스트는 `대한민국`, `일본` 이름에 의존한다.
- 수정 모드에서 기존 도시의 국가명이 `Intl` 이름과 다르면 중복 검사(`findDuplicateCity`, 이름 비교)가 같은 도시를 놓칠 수 있다(명세 D-2, 범위 밖). 기존 중복 테스트는 캐시 도시의 국가명을 `Intl` 이름으로 바꿔 의도를 유지했다.
- 위 목록 밖 기존 파일 수정 필요 사항: 없음.

## 확인하지 못한 것

- 실제 `/api/geocode` 응답(백엔드 병렬 구현)과의 연동은 확인하지 않았다. 모킹 없이는 호출 경로를 실행한 테스트가 없다(새 테스트는 qa-engineer 담당).
- 브라우저에서의 시각·키보드 동작(목록 잘림, 스크롤 하이라이트, 포커스 이동)은 jsdom 외에 확인하지 않았다.
- OSM 저작권 링크 주소는 열어 확인하지 않았다.

## 검증 결과

- `pnpm lint`: 오류 없음
- `pnpm type-check`: 오류 없음
- `pnpm test`: 14 파일, 130 테스트 통과
