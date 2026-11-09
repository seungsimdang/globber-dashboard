// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BASE = "http://upstream.test";
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const loginOk = (token = "tok-1") => json(200, { status: "success", data: { accessToken: token } });

// 모듈 메모리(토큰)를 테스트마다 새로 가져옴
const load = async () => import("@/lib/server/cityApiToken");

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("CITY_API_DEV_BASE_URL", BASE);
  vi.stubEnv("CITY_API_TEST_EMAIL", "test@example.com");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("withCityApiToken", () => {
  it("동시 요청 두 건이어도 토큰 발급은 한 번만 한다", async () => {
    const login = vi.fn(async () => loginOk());
    vi.stubGlobal("fetch", login);
    const { withCityApiToken } = await load();
    const call = vi.fn(async () => json(200, {}));
    await Promise.all([withCityApiToken(call), withCityApiToken(call)]);
    expect(login).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledTimes(2);
    expect(call).toHaveBeenCalledWith("Bearer tok-1");
  });

  it("발급 요청은 테스트 이메일을 인코딩해 POST로 보낸다", async () => {
    const login = vi.fn(async () => loginOk());
    vi.stubGlobal("fetch", login);
    const { withCityApiToken } = await load();
    await withCityApiToken(async () => json(200, {}));
    const [url, init] = login.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/dev/test-login?email=test%40example.com`);
    expect(init.method).toBe("POST");
  });

  it("토큰에 Bearer 접두사가 이미 있으면 중복해서 붙이지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => loginOk("Bearer abc")));
    const { withCityApiToken } = await load();
    const call = vi.fn(async () => json(200, {}));
    await withCityApiToken(call);
    expect(call).toHaveBeenCalledWith("Bearer abc");
  });

  it("상류가 401이면 재발급 후 한 번만 재시도한다", async () => {
    const tokens = ["old", "new"];
    vi.stubGlobal("fetch", vi.fn(async () => loginOk(tokens.shift())));
    const { withCityApiToken } = await load();
    const call = vi.fn(async (auth: string) => (auth === "Bearer old" ? json(401, {}) : json(200, {})));
    const res = await withCityApiToken(call);
    expect(res.status).toBe(200);
    expect(call.mock.calls.map((c) => c[0])).toEqual(["Bearer old", "Bearer new"]);
  });

  it("재시도도 401이면 인증 실패 오류를 던지고 더 시도하지 않는다", async () => {
    const login = vi.fn(async () => loginOk());
    vi.stubGlobal("fetch", login);
    const { withCityApiToken, UpstreamAuthError } = await load();
    const call = vi.fn(async () => json(401, {}));
    await expect(withCityApiToken(call)).rejects.toBeInstanceOf(UpstreamAuthError);
    expect(call).toHaveBeenCalledTimes(2);
    expect(login).toHaveBeenCalledTimes(2);
  });

  it("발급 응답에 토큰이 없으면 인증 실패 오류를 던진다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { data: {} })));
    const { withCityApiToken, UpstreamAuthError } = await load();
    await expect(withCityApiToken(async () => json(200, {}))).rejects.toBeInstanceOf(UpstreamAuthError);
  });

  it("테스트 이메일이 없으면 상류를 호출하지 않고 설정 오류를 던진다", async () => {
    vi.stubEnv("CITY_API_TEST_EMAIL", "");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const { withCityApiToken, UpstreamConfigError } = await load();
    await expect(withCityApiToken(async () => json(200, {}))).rejects.toBeInstanceOf(UpstreamConfigError);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("getCityApiBaseUrl", () => {
  it("끝의 슬래시를 제거한다", async () => {
    vi.stubEnv("CITY_API_DEV_BASE_URL", `${BASE}//`);
    const { getCityApiBaseUrl } = await load();
    expect(getCityApiBaseUrl("dev")).toBe(BASE);
  });

  it("주소가 없으면 설정 오류를 던진다", async () => {
    vi.stubEnv("CITY_API_DEV_BASE_URL", "");
    const { getCityApiBaseUrl, UpstreamConfigError } = await load();
    expect(() => getCityApiBaseUrl("dev")).toThrow(UpstreamConfigError);
  });
});
