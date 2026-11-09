// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CityRequest } from "@/types/city";

const BASE = "http://upstream.test";
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const loginOk = () => json(200, { status: "success", data: { accessToken: "tok" } });

const load = async () => import("@/lib/server/cityUpstream");

const valid = { cityName: "서울", countryName: "대한민국", lat: 37.5, lng: 127, countryCode: "KOR" };

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("CITY_API_DEV_BASE_URL", BASE);
  vi.stubEnv("CITY_API_TEST_EMAIL", "test@example.com");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("parseCityRequest", () => {
  it("정상 입력은 5개 필드만 남기고 국가 코드를 대문자로 바꾼다", async () => {
    const { parseCityRequest } = await load();
    const r = parseCityRequest({ ...valid, countryCode: " kor ", cityName: " 서울 ", extra: "x", id: 1 });
    expect(r).toEqual({ ok: true, value: { ...valid } });
  });

  it.each([null, "str", [], 1])("객체가 아닌 body(%j)는 거부한다", async (body) => {
    const { parseCityRequest } = await load();
    expect(parseCityRequest(body)).toEqual({ ok: false, message: "요청 형식이 올바르지 않습니다." });
  });

  it.each<keyof CityRequest>(["cityName", "countryName", "lat", "lng", "countryCode"])(
    "%s 누락은 필수 항목 오류다",
    async (key) => {
      const { parseCityRequest } = await load();
      const body: Record<string, unknown> = { ...valid };
      delete body[key];
      expect(parseCityRequest(body)).toEqual({ ok: false, message: "필수 항목을 모두 입력해주세요." });
    },
  );

  it("공백뿐인 이름과 숫자가 아닌 위경도(문자열, NaN, Infinity)는 거부한다", async () => {
    const { parseCityRequest } = await load();
    for (const patch of [{ cityName: "  " }, { lat: "37" }, { lng: NaN }, { lat: Infinity }]) {
      expect(parseCityRequest({ ...valid, ...patch }).ok).toBe(false);
    }
  });

  it("위도 경계 90, -90은 허용하고 범위를 넘으면 거부한다", async () => {
    const { parseCityRequest } = await load();
    expect(parseCityRequest({ ...valid, lat: 90 }).ok).toBe(true);
    expect(parseCityRequest({ ...valid, lat: -90 }).ok).toBe(true);
    expect(parseCityRequest({ ...valid, lat: 90.01 })).toEqual({ ok: false, message: "위도는 -90에서 90 사이여야 합니다." });
    expect(parseCityRequest({ ...valid, lat: -91 }).ok).toBe(false);
  });

  it("경도 경계 180, -180은 허용하고 범위를 넘으면 거부한다", async () => {
    const { parseCityRequest } = await load();
    expect(parseCityRequest({ ...valid, lng: 180 }).ok).toBe(true);
    expect(parseCityRequest({ ...valid, lng: -180 }).ok).toBe(true);
    expect(parseCityRequest({ ...valid, lng: 180.5 })).toEqual({ ok: false, message: "경도는 -180에서 180 사이여야 합니다." });
  });

  it.each(["KR", "KORE", "K0R", "한국어"])("alpha-3가 아닌 국가 코드(%s)는 거부한다", async (countryCode) => {
    const { parseCityRequest } = await load();
    expect(parseCityRequest({ ...valid, countryCode })).toEqual({
      ok: false,
      message: "국가 코드는 영문 대문자 3자여야 합니다.",
    });
  });
});

describe("proxyCityApi", () => {
  const read = (r: Response) => r.json() as Promise<{ status: string; data: unknown }>;
  const get = async () =>
    (await load()).proxyCityApi("/api/v1/cities/all", { server: "dev", method: "GET", authenticated: false, expect: "array" });

  it("상류 2xx는 success 래퍼로 통과시키고 no-store를 붙인다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { status: "success", data: [{ cityId: 1 }] })));
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await read(res)).toEqual({ status: "success", data: [{ cityId: 1 }] });
  });

  it("조회는 토큰을 발급하거나 Authorization을 보내지 않는다", async () => {
    const f = vi.fn(async () => json(200, { data: [] }));
    vi.stubGlobal("fetch", f);
    await get();
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/v1/cities/all`);
    expect(JSON.stringify(init.headers)).not.toContain("Authorization");
  });

  it("테스트 이메일이 없어도 조회는 동작한다", async () => {
    vi.stubEnv("CITY_API_TEST_EMAIL", "");
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { data: [] })));
    expect((await get()).status).toBe(200);
  });

  it("2xx여도 기대한 형태(배열)가 아니면 502다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { data: {} })));
    expect((await get()).status).toBe(502);
  });

  it("상류 400은 상류 메시지를, 404는 메시지가 없으면 기본 문구를 통과시킨다", async () => {
    const { proxyCityApi } = await load();
    vi.stubGlobal("fetch", vi.fn(async () => json(400, { status: "fail", data: "검색어를 입력해 주세요." })));
    let res = await proxyCityApi("/x", { server: "dev", method: "GET", authenticated: false, expect: "array" });
    expect(res.status).toBe(400);
    expect((await read(res)).data).toBe("검색어를 입력해 주세요.");

    vi.stubGlobal("fetch", vi.fn(async () => json(404, {})));
    res = await proxyCityApi("/x", { server: "dev", method: "GET", authenticated: false, expect: "array" });
    expect(res.status).toBe(404);
    expect((await read(res)).data).toBe("대상을 찾을 수 없습니다.");
  });

  it("상류 5xx는 502로 바꾸고 상류 본문은 노출하지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(500, { status: "fail", data: "SECRET stack trace" })));
    const res = await get();
    expect(res.status).toBe(502);
    expect(JSON.stringify(await read(res))).not.toContain("SECRET");
  });

  it("네트워크 실패는 502다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const res = await get();
    expect(res.status).toBe(502);
    expect((await read(res)).data).toBe("도시 서버에 연결할 수 없습니다.");
  });

  it("타임아웃은 504다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw Object.assign(new Error("t"), { name: "TimeoutError" }); }));
    expect((await get()).status).toBe(504);
  });

  it("API 주소 환경 변수가 없으면 500이고 상류를 호출하지 않는다", async () => {
    vi.stubEnv("CITY_API_DEV_BASE_URL", "");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const res = await get();
    expect(res.status).toBe(500);
    expect(f).not.toHaveBeenCalled();
  });

  describe("쓰기(authenticated)", () => {
    const post = async () =>
      (await load()).proxyCityApi("/api/v1/cities", { server: "dev", method: "POST", authenticated: true, body: valid, expect: "object" });

    it("토큰을 붙여 JSON body를 보낸다", async () => {
      const f = vi.fn(async (url: string) =>
        url.includes("/dev/test-login") ? loginOk() : json(200, { status: "success", data: { cityId: 9 } }),
      );
      vi.stubGlobal("fetch", f);
      const res = await post();
      expect(res.status).toBe(200);
      const [, init] = f.mock.calls[1] as unknown as [string, RequestInit];
      expect(init.method).toBe("POST");
      expect(init.body).toBe(JSON.stringify(valid));
      expect(init.headers).toMatchObject({ Authorization: "Bearer tok", "Content-Type": "application/json" });
    });

    it("상류가 계속 401이면 502 인증 실패이고 토큰 값은 응답에 없다", async () => {
      vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("/dev/test-login") ? loginOk() : json(401, {}))));
      const res = await post();
      expect(res.status).toBe(502);
      const text = JSON.stringify(await read(res));
      expect(text).toContain("서버 인증에 실패했습니다.");
      expect(text).not.toContain("tok");
    });

    it("테스트 이메일이 없으면 500이고 상류를 호출하지 않는다", async () => {
      vi.stubEnv("CITY_API_TEST_EMAIL", "");
      const f = vi.fn();
      vi.stubGlobal("fetch", f);
      const res = await post();
      expect(res.status).toBe(500);
      expect(f).not.toHaveBeenCalled();
    });

    it("토큰 발급 실패는 502 인증 실패다", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => json(500, {})));
      expect((await post()).status).toBe(502);
    });
  });
});
