# 배포 체크리스트 — Vercel 배포 준비

## 배포 준비 상태

**QA 및 보안 리뷰 결과**: 
- vitest 88개 테스트: 전부 통과 ✅
- 코드 리뷰: Critical 없음, Minor 4건 수정 완료 ✅
- 보안 리뷰: Critical/High 0건 ✅

**배포 게이트 상태**: 통과 ✅

---

## I. 사람이 반드시 직접 수행해야 하는 항목

### 1. Vercel 계정 및 조직 준비
- **상태**: 수동 작업 필요
- **내용**:
  - Vercel 계정 생성 (https://vercel.com/signup)
  - 기존 계정이 있는 경우 해당 계정/팀 선택
- **필요 정보**: Vercel 계정 이메일, 조직 ID (아래 "5번"에서 사용)

### 2. Vercel GitHub 앱 설치
- **상태**: 수동 작업 필요
- **내용**:
  1. Vercel 대시보드(https://vercel.com/dashboard) 로그인
  2. "Add New..." 버튼 → "Project" 선택
  3. "Import Git Repository" 버튼 클릭
  4. GitHub 저장소 선택 창에서 "Configure GitHub App" 클릭
  5. GitHub 앱 설치 프롬프트 → "Install" 승인
  6. 저장소 접근 권한 범위 선택:
     - **권장**: 해당 저장소(`globber-dashboard`)만 선택
     - 또는 조직 전체(필요에 따라 판단)
- **확인 방법**: GitHub 계정 → Settings → Applications → "Vercel" 앱이 설치되어 있는지 확인

### 3. Vercel 대시보드에서 GitHub 저장소 Import
- **상태**: 수동 작업 필요
- **내용**:
  1. Vercel 대시보드 → "Add New..." → "Project"
  2. GitHub 저장소 목록에서 `leeseunghyun/globber-dashboard` (또는 해당 저장소명) 선택
  3. "Import" 클릭
  4. 다음 단계로 진행
- **참고**: Import 과정에서 자동으로 Next.js Framework 감지 (별도 설정 필요 없음)

### 4. 프레임워크 및 빌드 설정 확인
- **상태**: 수동 확인 필요
- **확인 항목**:
  - **Framework Preset**: "Next.js" 자동 감지됨 (변경 불필요)
  - **Build Command**: `pnpm build` 자동 감지 (vercel.json에서 지정)
  - **Install Command**: `pnpm install --frozen-lockfile` (vercel.json에서 지정)
  - **Output Directory**: `.next` (Next.js 기본값, 변경 불필요)
  - **Node.js Version**: `package.json`의 `engines.node`(`22.x`)로 지정됨. `engines.node`가 대시보드 드롭다운 설정보다 우선 적용되므로 이것만으로 충분하지만, 대시보드도 맞춰두는 걸 권장(아래 확인 방법 참고). Node.js 20.x는 2026-10-01부로 Vercel에서 deprecated 예정이라 22.x로 지정했다. (`vercel.json`에는 Node 버전 지정 키가 없음 — `nodeVersion`은 존재하지 않는 키라 초안에서 제거함)
- **확인 방법**: 
  - Vercel 대시보드 → **Settings → Build and Deployment** 탭(← "General" 탭 아님, 여기로 이동됨) → "Node.js Version" 드롭다운
  - 22.x로 되어 있는지 확인(다르게 되어 있어도 `engines.node`가 우선 적용되지만, 혼선 방지를 위해 맞춰두는 걸 권장)
  - 위 항목들이 올바른지 확인 후 "Save" (수정 사항 없으면 그대로 진행)

### 5. Production Branch 설정
- **상태**: 수동 확인 필요
- **내용**:
  1. Vercel 대시보드 → Project Settings → "Git"
  2. "Production Branch"가 `main`으로 설정되어 있는지 확인
  3. 설정되지 않은 경우 `main` 선택 후 저장
- **확인 후**: `main` 브랜치에 push할 때 자동으로 Production 배포 트리거

### 6. Preview Deployment 설정 (선택사항)
- **상태**: 수동 설정 권장
- **내용**:
  1. Vercel 대시보드 → Project Settings → "Git"
  2. "Deploy on push to any branch except Production"가 활성화되어 있는지 확인
  3. 활성화된 경우:
     - PR을 열 때 자동으로 Preview URL 생성
     - 마지막 커밋이 배포되어 협업자들이 검토 가능
- **권장**: 활성화 (기본값은 활성화됨)

### 7. 환경 변수 설정
- **현재 상태**: 필요한 환경 변수 없음 (인메모리 mock 서비스 레이어, 실제 API 없음)
- **설정 방법** (향후 필요 시):
  1. Vercel 대시보드 → Project Settings → "Environment Variables"
  2. 환경 변수 추가:
     - **이름**: 변수명 (예: `NEXT_PUBLIC_API_URL`)
     - **값**: 값 입력
     - **스코프**: "Production", "Preview", "Development" 중 선택
  3. "Save"
- **주의**: 
  - `NEXT_PUBLIC_*` 접두사가 있는 변수만 브라우저 접근 가능
  - 민감한 정보(토큰, 시크릿)는 `NEXT_PUBLIC_` 없이 설정하고 서버 코드에서만 사용
  - 지금은 불필요하므로 건너뛰어도 됨

### 8. Deployment Protection (선택사항)
- **상태**: 수동 설정 권장
- **내용**:
  - 이 프로젝트는 **내부 어드민 도구**이므로 Production 배포 보호는 선택사항
  - 만약 조직 내 여러 사람이 배포하는 경우:
    1. Vercel 대시보드 → Project Settings → "Environment"
    2. "Deployment Protection" 설정
    3. 옵션:
       - **사용 안 함 (권장, 현재)**: 누구나 배포 가능
       - **Password**: 비밀번호 입력 후 배포 필요 (간단한 보호)
       - **SSO/SAML**: 엔터프라이즈 계정 필요
- **권장 판단**:
  - 팀 규모 작은 경우(현재): 사용 안 함
  - 팀 규모 크거나 엄격한 배포 정책 필요: Password 또는 SSO 활성화

### 9. 커스텀 도메인 설정 (선택사항)
- **현재 상태**: 필요 없음
- **내용**:
  - 이 프로젝트는 내부 어드민 도구이므로 Vercel의 자동 할당 도메인(`*.vercel.app`) 사용 권장
  - 조직 내 자체 도메인이 있는 경우만 필요
- **설정 방법** (필요 시):
  1. Vercel 대시보드 → Project Settings → "Domains"
  2. "Add Domain" 클릭
  3. 도메인 입력 후 DNS 레코드 설정 (안내 따름)

### 10. GitHub Actions CI 워크플로 확인
- **상태**: 코드에 이미 작성됨 (자동)
- **파일**: `.github/workflows/ci.yml`
- **동작 방식**:
  - PR 또는 main 브랜치 push 시 자동 트리거
  - lint → type-check → test → build 순서로 실행
  - 모든 단계 통과 시에만 PR 머지 가능 (설정 시)
  - 실패 시 GitHub UI에 빨간 ✗ 표시, 로그 제공
- **확인 방법**:
  1. GitHub 저장소 → Pull requests 탭
  2. 임의의 PR 선택 → "Checks" 탭
  3. "Lint, Type Check, Test & Build" 워크플로 실행 현황 확인

---

## II. 이미 코드에 자동화된 항목 (확인만 필요)

### ✅ GitHub Actions CI 파이프라인
- **파일**: `.github/workflows/ci.yml`
- **트리거**: main 브랜치 push, PR 생성
- **실행 단계**:
  1. 코드 체크아웃
  2. pnpm 10.15.1 설치
  3. Node.js 22.x 설치
  4. 의존성 설치 (`pnpm install --frozen-lockfile`)
  5. **lint** (`pnpm lint`) — ESLint 실행, 스타일 검사
  6. **type-check** (`pnpm type-check`) — TypeScript 타입 체크
  7. **test** (`pnpm test`) — vitest 테스트 실행 (88개 테스트)
  8. **build** (`pnpm build`) — Next.js 프로덕션 빌드
- **소요 시간**: ~5-10분 (초기 설치 제외)
- **성공 조건**: 모든 단계가 통과

### ✅ Vercel 빌드 설정
- **파일**: `vercel.json`, `package.json`(`engines.node`)
- **설정 내용**:
  ```json
  // vercel.json
  {
    "buildCommand": "pnpm build",
    "installCommand": "pnpm install --frozen-lockfile"
  }
  ```
  ```json
  // package.json (일부)
  {
    "engines": { "node": "22.x" }
  }
  ```
- **자동화 항목**:
  - pnpm 기반 빌드 명령어
  - Node.js 22.x 버전 고정(`engines.node`로 지정 — `vercel.json`에는 Node 버전 키가 없어 `package.json`으로 옮김. 20.x는 2026-10-01 Vercel deprecated 예정이라 22.x 선택)
  - Frozen lockfile로 재현 가능한 빌드
- **참고**: 초안에서 `vercel.json`에 `"nodeVersion": "20.x"`를 넣었으나, 이는 Vercel 공식 스키마에 존재하지 않는 키(Bun 전용 `bunVersion`만 존재)라 제거했다. Node 버전은 대시보드 Project Settings의 **Build and Deployment 탭**(General 탭 아님) 또는 `package.json`의 `engines.node`로만 지정 가능하며, 후자가 우선 적용된다.

### ✅ Vercel Git 통합 자동 배포
- **트리거**:
  - **Preview**: 모든 PR/비-main 브랜치 push → 자동 Preview URL 생성
  - **Production**: main 브랜치 push (GitHub Actions CI 통과 후) → 자동 Production 배포
- **자동화 이유**:
  - Vercel의 자체 Git 통합이 있으므로 GitHub Actions에서 `vercel deploy` 이중화 불필요
  - Vercel CLI로 배포하려면 `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`가 필요하지만, Git 통합이 더 간단하고 자동화 정도가 높음
  - GitHub Actions은 **품질 게이트(CI)** 역할만 담당하고 배포는 Vercel에 위임

---

## III. 배포 흐름도

```
개발자 작업
    ↓
git push / PR 생성
    ↓
GitHub Actions CI 자동 실행
├─ lint (ESLint)
├─ type-check (TypeScript)
├─ test (vitest 88개)
└─ build (Next.js)
    ↓
[성공] ─────────────────────→ Vercel Git 통합 감지
                              ├─ Preview 배포 (PR의 경우)
                              └─ Production 배포 (main의 경우)
    ↓
[실패] ─→ GitHub UI 빨간 ✗ / 이메일 알림
        └─ 개발자가 로그 확인 후 수정 → 다시 push
```

---

## IV. 배포 실행 확인 및 검증

### 첫 배포 후 확인 체크리스트

1. **Vercel 대시보드 확인**
   - 프로젝트 → "Deployments" 탭
   - Production/Preview 배포 상태 확인 (검은색 ✓ = 성공)

2. **배포된 앱 접속**
   - Preview URL: `https://<pr-number>-globber-dashboard.vercel.app`
   - Production URL: `https://globber-dashboard.vercel.app` (도메인 설정 후)
   - 대시보드가 정상 작동하는지 확인 (/cities 페이지 접근)

3. **GitHub Actions 로그 확인**
   - GitHub 저장소 → "Actions" 탭
   - 최근 PR/commit의 CI 워크플로 로그 확인
   - 모든 단계가 "✓ Passed"인지 확인

4. **에러 발생 시 대응**
   - GitHub Actions 로그에서 에러 메시지 확인
   - Vercel 배포 로그에서 추가 정보 확인 (Vercel 대시보드 → Deployments → 해당 배포 클릭)

---

## V. 정책 및 주의사항

### CI 통과 없이 main 병합 방지 (권장)
- GitHub 저장소 → Settings → Branches → "Add rule"
- Branch name pattern: `main`
- Require status checks to pass before merging: **활성화**
- Required checks: "Lint, Type Check, Test & Build" 선택
- 이렇게 하면 CI 실패 시 강제로 병합 방지

### 배포 전 수동 승인 (선택사항)
- 현재 Vercel 설정에서는 main push 시 **자동 배포**
- 만약 수동 승인 단계가 필요하다면:
  1. Vercel 대시보드 → Project Settings → "Deployment Environments"
  2. Production 환경에 "Deployment Protection" 추가 (비밀번호 또는 SSO)
  3. 배포 시 승인 필요 (팀 규모나 정책에 따라)

### 환경 변수 관리
- 토큰, API 키, 시크릿은 **절대로 코드에 하드코딩하지 말 것**
- 환경 변수는 Vercel 대시보드 또는 `.env.local` (로컬 개발만)에서 관리
- `NEXT_PUBLIC_*` 접두사는 브라우저 노출 가능, 공개 정보만 사용

---

## VI. 다음 단계 (사람 승인 대기)

배포 파이프라인 설정 완료. **사람 승인 대기 중**:

1. 위 "I. 사람이 반드시 직접 수행해야 하는 항목" 1~10번 중:
   - **필수**: 1, 2, 3, 4, 5 (Vercel 프로젝트 연결)
   - **권장**: 6, 10 (Preview, GitHub Actions 연동 확인)
   - **선택**: 7, 8, 9 (환경 변수, 배포 보호, 커스텀 도메인)

2. 모든 필수 항목 완료 후:
   - 첫 테스트 배포: main 브랜치로 PR 생성 → 머지
   - Vercel 대시보드 및 배포된 앱 접속 확인
   - Production 배포 성공 확인

3. 완료 후:
   - 대시보드 URL(`*.vercel.app` 또는 커스텀 도메인) 팀과 공유
   - 개발자에게 배포 절차 안내

---

## 참고 자료

- **Vercel Next.js 배포 가이드**: https://vercel.com/docs/frameworks/nextjs
- **Vercel 환경 변수**: https://vercel.com/docs/projects/environment-variables
- **GitHub Actions 기본 문법**: https://docs.github.com/en/actions
- **이 프로젝트의 CI/CD 설정**:
  - `.github/workflows/ci.yml` — GitHub Actions 워크플로
  - `vercel.json` — Vercel 빌드 설정
  - `package.json` — pnpm 스크립트 (lint, type-check, test, build)
