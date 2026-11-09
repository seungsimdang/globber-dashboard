import { failResponse, parseCityRequest, proxyCityApi } from "@/lib/server/cityUpstream";
import { withSession } from "@/lib/server/withSession";

export const GET = withSession(async () =>
  proxyCityApi("/api/v1/cities/all", {
    method: "GET",
    authenticated: false,
    expect: "array",
  }),
);

export const POST = withSession(async (request) => {
  // JSON이 아닌 요청은 본문을 읽기 전에 거절함
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return failResponse(415, "요청 형식이 올바르지 않습니다.");
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = parseCityRequest(body);
  if (!parsed.ok) return failResponse(400, parsed.message);

  return proxyCityApi("/api/v1/cities", {
    method: "POST",
    authenticated: true,
    body: parsed.value,
    expect: "object",
  });
});
