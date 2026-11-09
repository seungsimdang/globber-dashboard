// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/session", () => ({ getSession: () => getSession() }));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const valid = { cityName: "서울", countryName: "대한민국", lat: 37.5, lng: 127, countryCode: "KOR" };

const req = (method: string, init: { type?: string; body?: string } = {}) =>
  new Request("http://localhost/api/cities", {
    method,
    headers: init.type ? { "Content-Type": init.type } : undefined,
    body: init.body,
  });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("CITY_API_BASE_URL", "http://upstream.test");
  vi.stubEnv("CITY_API_TEST_EMAIL", "test@example.com");
  getSession.mockResolvedValue({ username: "admin" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("/api/cities 핸들러", () => {
  it("세션이 없으면 GET은 401이고 상류를 호출하지 않는다", async () => {
    getSession.mockResolvedValue(null);
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const { GET } = await import("@/app/api/cities/route");
    expect((await GET(req("GET"))).status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });

  it("세션이 없으면 POST도 401이다", async () => {
    getSession.mockResolvedValue(null);
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const { POST } = await import("@/app/api/cities/route");
    const res = await POST(req("POST", { type: "application/json", body: JSON.stringify(valid) }));
    expect(res.status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });

  it("Origin 헤더가 없는 정상 GET은 403이 아니라 200이다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { status: "success", data: [] })));
    const { GET } = await import("@/app/api/cities/route");
    expect((await GET(req("GET"))).status).toBe(200);
  });

  it("POST에 JSON Content-Type이 없으면 415다", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const { POST } = await import("@/app/api/cities/route");
    expect((await POST(req("POST", { body: JSON.stringify(valid) }))).status).toBe(415);
    expect((await POST(req("POST", { type: "text/plain", body: JSON.stringify(valid) }))).status).toBe(415);
    expect(f).not.toHaveBeenCalled();
  });

  it("POST body가 깨졌거나 검증에 실패하면 400이다", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const { POST } = await import("@/app/api/cities/route");
    expect((await POST(req("POST", { type: "application/json", body: "{bad" }))).status).toBe(400);
    const bad = JSON.stringify({ ...valid, countryCode: "KR" });
    expect((await POST(req("POST", { type: "application/json", body: bad }))).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });

  it("대소문자가 다른 application/json; charset도 허용한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("/dev/test-login")
          ? json(200, { data: { accessToken: "t" } })
          : json(200, { status: "success", data: { cityId: 1 } }),
      ),
    );
    const { POST } = await import("@/app/api/cities/route");
    const res = await POST(req("POST", { type: "Application/JSON; charset=utf-8", body: JSON.stringify(valid) }));
    expect(res.status).toBe(200);
  });
});
