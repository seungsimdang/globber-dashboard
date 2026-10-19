# Next.js 16 핵심 규칙

> 이 저장소의 Next.js는 학습 데이터와 다를 수 있다. 새 API/규칙이 불확실하면
> `node_modules/next/dist/docs/`의 해당 문서를 먼저 읽는다.

1. **클라이언트/서버 분리**: 클라이언트 컴포넌트는 별도 파일로 분리하고 `"use client"`를
   최상단에 선언한다. `page.tsx`(Server)는 `<XxxContent>`(Client)를 렌더하는 얇은 셸로 둔다.
2. **params / searchParams는 `Promise` 타입**: `async/await`로 추출(Server), Client에서는 `use()`.
   - ✅ `const { id } = await params;` / ❌ `const { id } = params;`
3. **단일 계정 인증** - 내부 전용 어드민 도구이므로 회원가입/아이디·비밀번호 찾기는
   구현하지 않는다. 계정 정보(`ADMIN_USERNAME`/`ADMIN_PASSWORD`)와 세션 서명 키
   (`AUTH_SECRET`)는 환경 변수로만 관리하고 코드에 하드코딩하지 않는다. 세션은
   `src/lib/session.ts`의 서명된 쿠키(`globber_session`)로 관리하며, 라우트 보호는
   `src/proxy.ts`(Next.js 16의 `middleware.ts` 대체)에서 일괄 처리한다 - 개별
   Server Action도 자체적으로 세션을 검증한다(Proxy만 믿지 않는다).
4. **`<Image>`는 `width`/`height` 명시 또는 `fill`**. `<img>` 직접 사용 금지.
5. **클라이언트 HTTP는 `src/lib/apiClient.ts`**를 통해서만 호출한다(목업이어도 동일 경로 유지).
6. **Server Component에서 목업 상태를 직접 import 금지** - 목업 데이터는 클라이언트
   서비스 레이어(`"use client"` 경계 안쪽 또는 API-shape 함수)를 통해서만 접근한다.
