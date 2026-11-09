# Security Review 1 — City CRUD (mock service layer)

## 결과 요약

**판정: 통과 (No Critical/High)**

리뷰 대상 파일에서 Critical/High 등급 취약점은 발견되지 않았다. 이 앱은 요구사항(§4, requirements.md:134)에 따라 인증/인가를 명시적으로 범위 밖으로 두고 있고, 실제 네트워크 호출이나 DB가 없는 인메모리 mock이므로 SQL injection, SSRF, 인증 우회 등은 해당 사항 없음(N/A)으로 처리한다. Medium/Low 등급으로 몇 가지 개선 권고 사항이 있으며, 특히 **실제 API 전환 시 반드시 함께 다뤄야 할 항목**을 별도로 정리했다.

- Critical: 0건
- High: 0건
- Medium: 3건
- Low: 3건
- N/A (해당 없음, 근거와 함께 명시): 인증/인가, SQL injection, SSRF, CSRF, 시크릿 노출

---

## 1. 인증/인가

**N/A** — requirements.md §4, 134행에서 "인증/로그인은 이번 범위에서 제외"하도록 명시적으로 정의되어 있고, api-spec.md 177~178행도 동일하게 확인한다. 내부 전용 도구로 실제 배포 시에도 별도 접근 제어(VPN, 사내망, reverse proxy 인증 등) 레벨에서 처리되는 것으로 가정한다. 코드 레벨의 인증 부재는 이번 리뷰의 지적 대상이 아니다.

다만 api-spec.md 240~242행이 이미 "실제 API 전환 시 5개 함수 시그니처에 토큰 파라미터 추가 필요"를 명시해 두었으므로, 이 부분은 **아래 "실제 API 전환 시 고려사항"**에서 다시 짚는다.

## 2. 입력 유효성 검사

### [Medium] cityName/countryName에 길이 제한이 없음
- 파일: `src/services/cityService.ts:50-58` (`hasMissingRequiredField`), `src/components/cities/CityFormModal.tsx:53-79` (`validate`)
- 클라이언트 폼과 서비스 레이어 모두 `cityName`, `countryName`에 대해 trim 후 공백 여부만 검사하고, 최대 길이 제한이 없다. `countryCode`만 `maxLength={2}` 및 정규식 검증이 걸려 있다(CityFormModal.tsx:250, cityService.ts:74).
- 영향: 현재는 인메모리 배열에 저장되므로 즉각적인 위험(DoS, DB 컬럼 오버플로우 등)은 없다. 그러나 실제 API로 교체되면 서버 측 컬럼 길이 제약 위반, 또는 매우 긴 문자열로 인한 UI 레이아웃 깨짐(CityListTable.tsx:104-106에서 그대로 렌더링)의 원인이 될 수 있다.
- 권고: `cityName`/`countryName`에 합리적인 최대 길이(예: 100자)를 클라이언트·서비스 양쪽에 추가.

### [Low] lat/lng이 유한하지 않은 값(Infinity)을 통과시킬 가능성
- 파일: `src/services/cityService.ts:57` (`hasMissingRequiredField`), `66-72` (`validateCityInput`)
- `Number.isNaN(lat)`만 검사하고 `Number.isFinite`는 검사하지 않는다. 다만 바로 다음 줄에서 `lat < -90 || lat > 90` 범위 체크가 있어 `Infinity`/`-Infinity`는 이 조건에 걸려 결국 거부된다(Infinity > 90이므로). 따라서 실질적 우회 경로는 없음 — 정보 제공 차원의 낮은 우선순위 항목.
- 권고: 방어적 코딩 관점에서 `Number.isFinite(lat) && Number.isFinite(lng)`를 `hasMissingRequiredField` 또는 `validateCityInput` 초입에 명시적으로 추가해 두면 향후 범위 체크 로직이 바뀌어도 안전하다.

### [Medium] countryCode 정규식이 클라이언트/서버 간 불일치
- 파일: `src/components/cities/CityFormModal.tsx:48` (`/^[A-Za-z]{2}$/`, 대소문자 허용) vs `src/services/cityService.ts:30` (`/^[A-Z]{2}$/`, 대문자만) 및 `toNormalizedCityInput`(84행)에서 `.toUpperCase()`로 정규화 후 서비스 레이어에서 재검증.
- 영향: 실제로는 서비스 레이어가 최종 검증·정규화를 하므로 우회는 불가능하다(정상 동작). 다만 두 정규식이 다른 이유가 코드만 봐서는 불명확해 유지보수 시 혼동 가능성이 있다.
- 권고: 주석으로 "클라이언트는 대소문자 허용 후 서버가 upper-case 정규화 및 재검증"임을 명시하거나, 공통 상수/유틸로 정규식을 공유.

## 3. XSS

**이상 없음.** 프로젝트 전역에서 `dangerouslySetInnerHTML`, `innerHTML`, `eval(`, `new Function(` 사용이 전혀 없음을 확인했다(`grep -rn` 결과 0건). 사용자 입력값(`city.name`, `city.country`, `city.countryCode` 등)은 모두 JSX 텍스트 노드(`{city.name}` 등, CityListTable.tsx:104-109)로 렌더링되어 React가 자동으로 이스케이프한다. `city.flag`(CityListTable.tsx:102)는 `getCountryFlag(countryCode)` 유틸리티가 반환하는 고정된 이모지 문자열로, 사용자 입력이 직접 삽입되지 않는다(코드베이스 내 미리 정의된 매핑 테이블로 확인).

폼 에러 메시지(`formError`, CityFormModal.tsx:193-200)도 서비스 레이어에서 하드코딩된 한국어 문자열(`Error` throw 메시지)만 사용하며 사용자 입력을 그대로 반영하지 않는다.

## 4. CSRF / SSRF / SQL Injection

**N/A** — 실제 네트워크 호출(`fetch`, `apiGet/apiPost` 등)이나 DB 쿼리가 존재하지 않고, `src/mocks/mockCities.ts`는 순수 인메모리 배열 조작만 수행한다(1-9행 주석에서도 명시). CSRF는 상태 변경 요청이 서버로 전송되지 않으므로 해당 없음. SSRF/SQL injection 벡터 자체가 존재하지 않는다.

## 5. 시크릿/API 키 노출

**이상 없음.** 리뷰 대상 파일 및 관련 코드에 하드코딩된 API 키, 토큰, 자격증명이 없음을 확인했다.

## 6. 동시성/무결성 (참고, OWASP 범주 밖이나 데이터 무결성 관점에서 기록)

`src/mocks/mockCities.ts`는 단일 스레드 JS 가정 하에 검증→쓰기를 동기적으로 수행해 경쟁 조건 없이 유일성을 보장한다고 주석에 명시되어 있고(6-9행), 실제로 `cityService.ts`의 `addCity`/`updateCity`도 `mockDelay()` 호출 전에 중복 검사와 쓰기를 완료한다(111-119행, 134-146행). 코드 검토 결과 이 가정은 현재 구현과 일치한다. 보안 취약점은 아니나, 실제 API 전환 시에는 서버 측에서 동일한 원자성 보장(예: DB unique constraint)이 필요함을 함께 기록해 둔다.

## 7. 클라이언트 데이터 노출 (Low)

- 파일: `src/mocks/mockCities.ts:36`, `42-52`, `55-59`
- `getAllMockCities`, `searchMockCities`, `findMockCityById`가 원본 배열이 아닌 복사본(`{ ...city }`)을 반환하도록 이미 잘 구현되어 있어, 호출부에서 내부 저장소를 직접 변형할 수 없다. 방어적 복사 패턴이 일관되게 적용된 점은 긍정적이다. (지적 사항 아님 — 양호한 패턴으로 기록)

---

## 실제 API로 교체 시 반드시 함께 고려해야 할 보안 사항 (Forward-looking)

현재 mock 구조는 안전하지만, 실 백엔드 연동 시 아래 항목이 새로 발생하는 공격 표면이므로 이번 리뷰에서 명시적으로 짚어둔다.

1. **인증/인가 재도입** — api-spec.md 240-242행이 이미 지적한 대로 5개 함수(`getCities`, `searchCities`, `addCity`, `updateCity`, `deleteCity`)에 토큰/인증 컨텍스트 주입이 필요해진다. 이때 토큰을 localStorage에 평문 저장하지 말고, httpOnly 쿠키 또는 안전한 저장소 사용을 검토할 것.
2. **서버 측 재검증 필수** — 현재 `validateCityInput`(cityService.ts:61-77)의 lat/lng 범위, countryCode 패턴, 필수 필드 검사는 클라이언트/mock 레이어에만 존재한다. 실 API 전환 후에도 이 검증 로직이 클라이언트 편의성용으로만 남고 **서버가 동일하거나 더 엄격한 검증을 반드시 재수행**해야 한다(클라이언트 검증은 우회 가능).
3. **XSS 방어 가정의 재확인** — 지금은 React JSX 자동 이스케이프에 의존해 안전하지만, 실 API 응답 데이터를 그대로 신뢰해 렌더링 방식이 바뀌지 않는지(예: 서버 응답을 `dangerouslySetInnerHTML`로 렌더링하는 방식으로 리팩터링되지 않는지) 코드 리뷰 시 재확인 필요.
4. **CSRF 토큰** — 실 API가 쿠키 기반 세션을 쓴다면 상태 변경 엔드포인트(`addCity`/`updateCity`/`deleteCity`에 대응하는 POST/PUT/DELETE)에 CSRF 토큰 또는 SameSite 쿠키 정책 적용 필요.
5. **Rate limiting / 입력 길이 제한** — 위 Medium 이슈(cityName/countryName 길이 제한 없음)를 실 API 연동 전에 반드시 해결하고, 서버 측에도 동일한 제약을 걸어 과도한 payload로 인한 부하를 방지할 것.
6. **에러 메시지 정보 노출** — 현재 mock의 Error 메시지("대상을 찾을 수 없습니다." 등)는 한국어 사용자 메시지로 안전하다. 실 API 전환 시 서버 스택 트레이스나 내부 구현 세부사항이 `error.message`(CityFormModal.tsx:156, 171-178; DeleteConfirmDialog.tsx:33-35)를 통해 그대로 Toast/배너에 노출되지 않도록 API 클라이언트 레이어에서 에러 메시지를 필터링/매핑하는 절차가 필요하다.

---

## 결론

이번 스코프(mock 서비스 레이어, 인메모리 저장소, 폼/테이블/다이얼로그 컴포넌트, 프로젝트 전역 XSS 벡터)에 대해 **Critical/High 취약점 없음**을 확인했으며 배포(현재 mock 단계 기준) 승인 가능. Medium 3건은 실 API 전환 이전에 처리하는 것을 권장하며, "실제 API 전환 시 고려사항" 6개 항목은 백엔드 연동 작업 착수 시 체크리스트로 활용할 것을 제안한다.
