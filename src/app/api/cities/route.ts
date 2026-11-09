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
