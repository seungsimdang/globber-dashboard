# Next.js 16 핵심 규칙

> 이 저장소의 Next.js는 학습 데이터와 다를 수 있다. 새 API/규칙이 불확실하면
> `node_modules/next/dist/docs/`의 해당 문서를 먼저 읽는다.

1. **클라이언트/서버 분리**: 클라이언트 컴포넌트는 별도 파일로 분리하고 `"use client"`를
   최상단에 선언한다. `page.tsx`(Server)는 `<XxxContent>`(Client)를 렌더하는 얇은 셸로 둔다.
2. **params / searchParams는 `Promise` 타입**: `async/await`로 추출(Server), Client에서는 `use()`.
   - ✅ `const { id } = await params;` / ❌ `const { id } = params;`
3. **인증 없음** - 내부 전용 어드민 도구이므로 이번 범위에서 로그인/인가를 구현하지 않는다.
   추후 인증이 필요해지면 요구사항 문서에서 별도로 명시한다.
4. **`<Image>`는 `width`/`height` 명시 또는 `fill`**. `<img>` 직접 사용 금지.
5. **클라이언트 HTTP는 `src/lib/apiClient.ts`**를 통해서만 호출한다(목업이어도 동일 경로 유지).
6. **Server Component에서 목업 상태를 직접 import 금지** - 목업 데이터는 클라이언트
   서비스 레이어(`"use client"` 경계 안쪽 또는 API-shape 함수)를 통해서만 접근한다.
