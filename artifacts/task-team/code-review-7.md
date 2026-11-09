# 중복 기준·위치 검색 로딩 후속 리뷰 7

## 판정

**통과.** 이번 승인된 변경 범위에서 미해결 코드 finding은 없습니다. 검토는 `cityDuplicate`, mutation hook, CityFormModal의 로딩 표시와 관련 직접 호출부·테스트로 한정했습니다. 기존 전체 작업은 재검토하지 않았습니다.

## 자체 정적 검토

- `src/utils/cityDuplicate.ts:5-19`가 도시명과 `countryCode`를 trim·소문자화해 비교합니다. 기존 국가명 표기가 달라도 같은 국가 코드를 같은 국가로 취급하고, 도시명만 같고 코드가 다르면 중복이 아닙니다.
- `src/hooks/useCityMutations.ts:21-27`는 수정 대상 자신이 도시명·국가코드가 같을 때 기존과 같이 중복 검사를 건너뜁니다. 다른 행과 겹치는 경우는 `excludeId`로 자기 행만 제외하고 계속 검사합니다.
- 검토 중 `tests/utils/cityDuplicate.test.ts`의 네 호출이 이전 `countryName` 입력을 남긴 것을 발견했습니다. 메인이 네 호출을 모두 `countryCode` 입력으로 갱신했고, 재확인 결과 공백·대소문자 정규화, 다른 국가, 자기 자신 제외, 다른 행과의 중복을 실제 `findDuplicateCity` import로 검사합니다. 미해결 finding은 아닙니다.
- `tests/hooks/useCityMutations.test.tsx`는 실제 mutation hook을 import하고 레거시 국가명 + 동일 코드 중복 거부, 다른 코드 허용, 수정 시 자기 자신 제외 및 다른 행 중복 거부를 확인합니다. `tests/components/CityFormGeocode.test.tsx`는 실제 `CityFormModal`을 import합니다. 테스트 안에 소스 로직을 복사해 검증하는 패턴은 없습니다.
- 위치 검색 로딩 문구를 `aria-live` 영역에서 제거했지만 버튼에는 `isLoading={geocode.isPending}`과 `찾는 중...` 텍스트가 남습니다(`src/components/cities/CityFormModal.tsx:348-362`). 공용 Button은 로딩 중 spinner, `disabled`, `aria-busy`를 제공합니다(`src/components/common/Button.tsx:37-50`). 관련 테스트는 로딩 중 `aria-busy`, 단일 spinner, 빈 `aria-live` 영역을 확인합니다(`tests/components/CityFormGeocode.test.tsx:48-59`). 사용자가 요청한 중복 로딩 안내 제거와 접근 가능한 버튼 로딩 상태가 함께 유지됩니다.
- 중복 로딩 문구 상수도 제거되어 사용되지 않는 export가 남지 않았습니다(`src/utils/cityErrorMessage.ts:97-`).

## 검증 상태와 한계

- 테스트 실행은 하지 않았습니다. 기존 전달 정보에는 관련 테스트 14개 통과가 있으나, stale utility test 호출 4곳 수정 이후의 결과는 이 리뷰에서 확인하지 않았습니다. 메인이 예정한 단일 전체 검증 결과를 별도로 확인해야 합니다.
- CodeRabbit은 이번 범위에서 재실행하지 않았습니다. 이전 CodeRabbit finding의 재작업 diff만 확인하는 후속 리뷰로 처리했으며, 이전 리뷰의 finding 0건을 이번 diff 결과로 간주하지 않았습니다.
- 실서버 요청과 브라우저 조작 검증은 하지 않았습니다.
