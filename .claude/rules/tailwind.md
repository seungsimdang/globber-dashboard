# Tailwind CSS 핵심 규칙

Tailwind **v4** (표준 스케일 그대로 사용 - `p-4`=1rem 등, candanta류 1px 재정의 없음).

## 표준 클래스 우선

1. 표준 Tailwind 클래스 우선 사용, 임의 값 `[]` 최소화.
   - 크기: `w-36`, `h-20`, `p-4` (❌ `w-[144px]`)
   - 둥글기: `rounded-lg`, `rounded-2xl` (❌ `rounded-[12px]`)
   - 색상: 팔레트 클래스 사용, 이후 브랜드 토큰이 생기면 `@theme`에 추가 후 토큰 클래스로 전환.
2. 임의 값 `[]` 허용 예외: 디자인 명세의 정확한 1회성 값, 외부 라이브러리 CSS 변수 사용 시.

## `cn` 사용 규칙

`cn`은 `src/utils/cn.ts` (`twMerge(clsx(...))`).

```typescript
// Good - 조건부 클래스에만 cn 사용
<div className={cn("flex items-center gap-2", isActive && "bg-blue-500", className)} />

// Bad - 정적 문자열에 cn 불필요
<div className={cn("flex items-center gap-2")} />
```

## CVA 사용 규칙

1. `cva()` 첫 인자: 일반 문자열(백틱 금지).
2. `variants`는 명확한 이름, `defaultVariants`는 항상 설정.

```typescript
export const buttonVariants = cva("inline-flex items-center justify-center rounded-lg", {
  variants: {
    variant: { primary: "bg-blue-600 text-white", ghost: "bg-transparent text-gray-700" },
    size: { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm" },
  },
  defaultVariants: { variant: "primary", size: "md" },
});
```

## 모바일 우선 아님

관리자 대시보드는 데스크톱 우선(최소 지원 너비 1024px 기준)이다. `sm:`/`md:` 분기는
필요할 때만 추가한다.
