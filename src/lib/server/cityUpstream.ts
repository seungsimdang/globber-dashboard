// 서버 전용: 상류 도시 API 호출, 입력 검증, 에러 매핑
// 상류 본문 전체·스택·헤더는 전달하지 않고 메시지 문자열만 꺼내 사용함
import type { ApiFail, ApiSuccess, CityRequest } from "@/types/city";
import {
  CITY_API_TIMEOUT_MS,
  getCityApiBaseUrl,
  UpstreamAuthError,
  UpstreamConfigError,
  withCityApiToken,
} from "./cityApiToken";

const MAX_UPSTREAM_MESSAGE_LENGTH = 500;

export const jsonResponse = (body: ApiSuccess<unknown> | ApiFail, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const failResponse = (status: number, message: string) =>
  jsonResponse({ status: "fail", data: message }, status);

type CityRequestResult =
  | { ok: true; value: CityRequest }
  | { ok: false; message: string };

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

// 요청 body를 검증하고 상류로 보낼 5개 필드만 새 객체로 구성함
export function parseCityRequest(body: unknown): CityRequestResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, message: "요청 형식이 올바르지 않습니다." };
  }
  const { cityName, countryName, lat, lng, countryCode } = body as Record<
    string,
    unknown
  >;
  if (
    !isNonEmptyString(cityName) ||
    !isNonEmptyString(countryName) ||
    !isNonEmptyString(countryCode) ||
    typeof lat !== "number" ||
    !Number.isFinite(lat) ||
    typeof lng !== "number" ||
    !Number.isFinite(lng)
  ) {
    return { ok: false, message: "필수 항목을 모두 입력해주세요." };
  }
  if (lat < -90 || lat > 90) {
    return { ok: false, message: "위도는 -90에서 90 사이여야 합니다." };
  }
  if (lng < -180 || lng > 180) {
    return { ok: false, message: "경도는 -180에서 180 사이여야 합니다." };
  }
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    return { ok: false, message: "국가 코드는 영문 대문자 3자여야 합니다." };
  }
  return {
    ok: true,
    value: {
      cityName: cityName.trim(),
      countryName: countryName.trim(),
      lat,
      lng,
      countryCode: code,
    },
  };
}

const readFailMessage = (body: unknown) => {
  const data = (body as Partial<ApiFail> | null)?.data;
  return typeof data === "string" && data !== ""
    ? data.slice(0, MAX_UPSTREAM_MESSAGE_LENGTH)
    : null;
};

const CONNECT_FAIL = "도시 서버에 연결할 수 없습니다.";
const AUTH_FAIL = "서버 인증에 실패했습니다.";

type ProxyOptions = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  // 쓰기 요청만 true이고 조회는 토큰 없이 보냄
  authenticated: boolean;
  body?: CityRequest;
  expect: "array" | "object";
};

// 성공이면 ApiSuccess, 실패면 에러 매핑된 ApiFail 응답을 반환함
export async function proxyCityApi(
  path: string,
  { method, authenticated, body, expect }: ProxyOptions,
): Promise<Response> {
  try {
    const url = `${getCityApiBaseUrl()}${path}`;
    const call = (authorization?: string) =>
      fetch(url, {
        method,
        cache: "no-store",
        // 리다이렉트는 따라가지 않고 네트워크 오류 경로로 보냄
        redirect: "error",
        signal: AbortSignal.timeout(CITY_API_TIMEOUT_MS),
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(authorization ? { Authorization: authorization } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

    const upstream = authenticated ? await withCityApiToken(call) : await call();
    const parsed: unknown = await upstream.json().catch(() => null);

    if (upstream.ok) {
      const data = (parsed as Partial<ApiSuccess<unknown>> | null)?.data;
      const shapeOk =
        expect === "array"
          ? Array.isArray(data)
          : typeof data === "object" && data !== null && !Array.isArray(data);
      if (!shapeOk) return failResponse(502, CONNECT_FAIL);
      return jsonResponse({ status: "success", data });
    }

    const { status } = upstream;
    if (status === 401) return failResponse(502, AUTH_FAIL);
    if (status >= 400 && status < 500) {
      const fallback =
        status === 400
          ? "요청이 올바르지 않습니다."
          : status === 404
            ? "대상을 찾을 수 없습니다."
            : "요청을 처리할 수 없습니다.";
      return failResponse(status, readFailMessage(parsed) ?? fallback);
    }
    return failResponse(
      502,
      "도시 서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    );
  } catch (error) {
    if (error instanceof UpstreamConfigError) {
      return failResponse(500, error.message);
    }
    if (error instanceof UpstreamAuthError) return failResponse(502, AUTH_FAIL);
    if (error instanceof Error && error.name === "TimeoutError") {
      return failResponse(504, "도시 서버 응답이 지연되고 있습니다.");
    }
    return failResponse(502, CONNECT_FAIL);
  }
}
