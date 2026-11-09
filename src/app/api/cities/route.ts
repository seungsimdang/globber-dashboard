import { resolveCityServer } from "@/lib/server/cityServer";
import { failResponse, parseCityRequest, proxyCityApi } from "@/lib/server/cityUpstream";
import { withSession } from "@/lib/server/withSession";

export const GET = withSession(async (request: Request) => {
  const resolved = resolveCityServer(request, { write: false });
  if ("response" in resolved) return resolved.response;

  return proxyCityApi("/api/v1/cities/all", {
    server: resolved.server,
    authenticated: false,
    method: "GET",
    expect: "array",
  });
});

export const POST = withSession(async (request: Request) => {
  // 운영 쓰기 거부는 본문과 환경 변수를 읽기 전에 처리함
  const resolved = resolveCityServer(request, { write: true });
  if ("response" in resolved) return resolved.response;

  // JSON이 아닌 요청은 본문을 읽기 전에 거절함
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return failResponse(415, "요청 형식이 올바르지 않습니다.");
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = parseCityRequest(body);
  if (!parsed.ok) return failResponse(400, parsed.message);

  return proxyCityApi("/api/v1/cities", {
    server: resolved.server,
    method: "POST",
    authenticated: true,
    body: parsed.value,
    expect: "object",
  });
});
