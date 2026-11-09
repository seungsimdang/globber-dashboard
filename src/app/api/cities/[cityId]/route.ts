import { resolveCityServer } from "@/lib/server/cityServer";
import { failResponse, parseCityRequest, proxyCityApi } from "@/lib/server/cityUpstream";
import { withSession } from "@/lib/server/withSession";

type Context = RouteContext<"/api/cities/[cityId]">;

// 검증된 숫자 문자열만 상류 경로에 사용함
const parseCityId = async ({ params }: Context) => {
  const { cityId } = await params;
  return /^[1-9][0-9]*$/.test(cityId) ? cityId : null;
};

export const PUT = withSession(async (request: Request, context: Context) => {
  // 운영 쓰기 거부는 cityId·본문·환경 변수를 읽기 전에 처리함
  const resolved = resolveCityServer(request, { write: true });
  if ("response" in resolved) return resolved.response;

  const cityId = await parseCityId(context);
  if (!cityId) return failResponse(400, "올바르지 않은 도시 ID입니다.");

  // JSON이 아닌 요청은 본문을 읽기 전에 거절함
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return failResponse(415, "요청 형식이 올바르지 않습니다.");
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = parseCityRequest(body);
  if (!parsed.ok) return failResponse(400, parsed.message);

  return proxyCityApi(`/api/v1/cities/${cityId}`, {
    server: resolved.server,
    method: "PUT",
    authenticated: true,
    body: parsed.value,
    expect: "object",
  });
});

export const DELETE = withSession(async (request: Request, context: Context) => {
  const resolved = resolveCityServer(request, { write: true });
  if ("response" in resolved) return resolved.response;

  const cityId = await parseCityId(context);
  if (!cityId) return failResponse(400, "올바르지 않은 도시 ID입니다.");

  return proxyCityApi(`/api/v1/cities/${cityId}`, {
    server: resolved.server,
    method: "DELETE",
    authenticated: true,
    expect: "object",
  });
});
