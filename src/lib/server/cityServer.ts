// 서버 전용: 내부 엔드포인트의 대상 서버(server 쿼리) 판정과 운영 쓰기 거부
import type { CityServer } from "@/types/city";
import { failResponse } from "./cityUpstream";

// 허용 목록 비교에만 쓰고 값으로 주소를 만들지 않음
// 누락·빈 값·중복·미지 값은 null
export function parseCityServer(request: Request): CityServer | null {
  const values = new URL(request.url).searchParams.getAll("server");
  if (values.length !== 1) return null;
  return values[0] === "prod" || values[0] === "dev" ? values[0] : null;
}

// server 판정과 운영 쓰기 거부를 한 곳에서 처리함
// 통과하면 server를, 아니면 그대로 반환할 응답을 돌려줌
export function resolveCityServer(
  request: Request,
  opts: { write: true },
): { server: "dev" } | { response: Response };
export function resolveCityServer(
  request: Request,
  opts: { write: false },
): { server: CityServer } | { response: Response };
export function resolveCityServer(
  request: Request,
  { write }: { write: boolean },
): { server: CityServer } | { response: Response } {
  const server = parseCityServer(request);
  if (!server) {
    return { response: failResponse(400, "대상 서버를 확인할 수 없습니다.") };
  }
  if (write && server === "prod") {
    return {
      response: failResponse(
        403,
        "운영 서버는 쓰기 인증 준비 전이라 조회만 할 수 있습니다.",
      ),
    };
  }
  return { server };
}
