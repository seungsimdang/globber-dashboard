// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/session", () => ({ getSession: () => getSession() }));

const valid = { cityName: "서울", countryName: "대한민국", lat: 37.5, lng: 127, countryCode: "KOR" };
const ctx = (cityId: string) => ({ params: Promise.resolve({ cityId }) }) as never;
const req = (method: string, type?: string, body?: string) =>
  new Request("http://localhost/api/cities/1", { method, headers: type ? { "Content-Type": type } : undefined, body });

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

describe("/api/cities/[cityId] 핸들러", () => {
  it("세션이 없으면 PUT과 DELETE 모두 401이다", async () => {
    getSession.mockResolvedValue(null);
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const { PUT, DELETE } = await import("@/app/api/cities/[cityId]/route");
    expect((await PUT(req("PUT", "application/json", JSON.stringify(valid)), ctx("1"))).status).toBe(401);
    expect((await DELETE(req("DELETE"), ctx("1"))).status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });

  it.each(["abc", "0", "01", "-1", "1.5", "1/../2", "1%2F2", ""])(
    "잘못된 cityId(%s)는 400이고 상류를 호출하지 않는다",
    async (id) => {
      const f = vi.fn();
      vi.stubGlobal("fetch", f);
      const { PUT, DELETE } = await import("@/app/api/cities/[cityId]/route");
      expect((await PUT(req("PUT", "application/json", JSON.stringify(valid)), ctx(id))).status).toBe(400);
      expect((await DELETE(req("DELETE"), ctx(id))).status).toBe(400);
      expect(f).not.toHaveBeenCalled();
    },
  );

  it("PUT에 JSON Content-Type이 없으면 415다", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const { PUT } = await import("@/app/api/cities/[cityId]/route");
    expect((await PUT(req("PUT", undefined, JSON.stringify(valid)), ctx("1"))).status).toBe(415);
    expect((await PUT(req("PUT", "text/plain", JSON.stringify(valid)), ctx("1"))).status).toBe(415);
    expect(f).not.toHaveBeenCalled();
  });

  it("PUT body 검증 실패는 400이다", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { PUT } = await import("@/app/api/cities/[cityId]/route");
    const bad = JSON.stringify({ ...valid, lat: 100 });
    expect((await PUT(req("PUT", "application/json", bad), ctx("1"))).status).toBe(400);
  });

  it("유효한 DELETE는 검증된 id 경로로 상류에 전달한다", async () => {
    const f = vi.fn(async (url: string) =>
      url.includes("/dev/test-login")
        ? Response.json({ data: { accessToken: "t" } })
        : Response.json({ status: "success", data: { cityId: 12 } }),
    );
    vi.stubGlobal("fetch", f);
    const { DELETE } = await import("@/app/api/cities/[cityId]/route");
    expect((await DELETE(req("DELETE"), ctx("12"))).status).toBe(200);
    const urls = f.mock.calls.map((c) => (c as unknown as [string])[0]);
    expect(urls).toContain("http://upstream.test/api/v1/cities/12");
  });
});
