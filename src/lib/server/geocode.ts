// 서버 전용: Nominatim 위치 검색 호출, 후보 정제, 인스턴스 메모리 캐시와 호출 간격 제한
// 캐시와 간격 기록은 프로세스 메모리에 있어 다중 인스턴스에서는 인스턴스마다 따로 동작함
import type {
  GeocodeCandidate,
  GeocodeFail,
  GeocodeFailCode,
  GeocodeResponse,
} from "@/types/city";
import { toAlpha2 } from "@/utils/countryFlagMapping";
import { jsonResponse } from "./cityUpstream";

// 호스트와 경로는 고정함(클라이언트 입력·환경 변수로 바꿀 수 없음)
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const DEFAULT_USER_AGENT = "globber-dashboard/1.0";
const REQUEST_TIMEOUT_MS = 5000;
const MAX_GEOCODE_CANDIDATES = 5;
const MAX_CITY_LENGTH = 100;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
// 공용 서버 상한(초당 1회)에 여유 100ms를 더한 값
const MIN_CALL_INTERVAL_MS = 1100;
const UPSTREAM_FAIL_MESSAGE = "위치를 찾지 못했습니다. 잠시 후 다시 시도해 주세요.";

const cache = new Map<string, { expiresAt: number; candidates: GeocodeCandidate[] }>();
let lastUpstreamCallAt = 0;

const geocodeFail = (status: number, code: GeocodeFailCode, message: string) => {
  const body: GeocodeFail = { status: "fail", data: message, code };
  return jsonResponse(body, status);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// "invalid"는 형식 오류, "mismatch"는 요청 국가와 다르거나 국가 코드가 없는 후보
function toCandidate(item: unknown, alpha2: string): GeocodeCandidate | "invalid" | "mismatch" {
  if (!isRecord(item)) return "invalid";
  if (
    [item.lat, item.lon].some(
      (value) =>
        (typeof value !== "string" && typeof value !== "number") ||
        (typeof value === "string" && value.trim() === ""),
    )
  ) return "invalid";
  const lat = Number(item.lat);
  const lng = Number(item.lon);
  if (!Number.isFinite(lat) || Math.abs(lat) > 90) return "invalid";
  if (!Number.isFinite(lng) || Math.abs(lng) > 180) return "invalid";
  const { display_name: displayName, place_id: placeId } = item;
  if (typeof displayName !== "string" || displayName.trim() === "") return "invalid";
  if (typeof placeId !== "number" && typeof placeId !== "string") return "invalid";

  const address = isRecord(item.address) ? item.address : {};
  // 틀린 국가의 좌표가 저장되지 않도록 국가 코드가 없는 후보도 버림
  if (
    typeof address.country_code !== "string" ||
    address.country_code.toLowerCase() !== alpha2
  ) {
    return "mismatch";
  }
  const region =
    [address.state, address.county]
      .filter((v): v is string => typeof v === "string" && v.trim() !== "")
      .join(", ") || null;

  return {
    id: String(placeId),
    displayName,
    lat,
    lng,
    region,
    placeType: typeof item.type === "string" && item.type !== "" ? item.type : null,
  };
}

// 최상위가 배열이 아니거나 항목이 있는데 전부 형식 오류이면 null
function parseCandidates(body: unknown, alpha2: string): GeocodeCandidate[] | null {
  if (!Array.isArray(body)) return null;
  const seen = new Set<string>();
  const candidates: GeocodeCandidate[] = [];
  let invalid = 0;
  for (const item of body) {
    const candidate = toCandidate(item, alpha2);
    if (candidate === "invalid") invalid += 1;
    if (typeof candidate === "string" || seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    candidates.push(candidate);
  }
  if (body.length > 0 && invalid === body.length) return null;
  return candidates.slice(0, MAX_GEOCODE_CANDIDATES);
}

function remember(key: string, candidates: GeocodeCandidate[]) {
  cache.delete(key);
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, candidates });
}

const success = (data: GeocodeCandidate[]) =>
  jsonResponse({ status: "success", data } satisfies GeocodeResponse);

export async function searchGeocode(
  cities: string[],
  country: string | null,
): Promise<Response> {
  if (process.env.NOMINATIM_DISABLED?.trim().toLowerCase() === "true") {
    return geocodeFail(503, "DISABLED", "위치 검색을 사용할 수 없습니다.");
  }

  const city = cities.length === 1 ? cities[0].replace(/[\u0000-\u001f\u007f]/g, "").trim() : "";
  if (city === "" || city.length > MAX_CITY_LENGTH) {
    return geocodeFail(400, "INVALID_INPUT", "도시명을 입력해 주세요.");
  }
  if (country === null || !/^[A-Z]{3}$/.test(country)) {
    return geocodeFail(400, "INVALID_INPUT", "국가 코드가 올바르지 않습니다.");
  }
  const alpha2 = toAlpha2(country)?.toLowerCase();
  if (!alpha2) {
    return geocodeFail(400, "INVALID_INPUT", "지원하지 않는 국가 코드입니다.");
  }

  const key = `${city.replace(/\s+/g, " ").toLowerCase()}|${country}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return success(hit.candidates);
  cache.delete(key);

  // 비교와 갱신을 같은 동기 구간에서 해 동시 요청 중 하나만 상류로 보냄
  const now = Date.now();
  if (now - lastUpstreamCallAt < MIN_CALL_INTERVAL_MS) {
    return geocodeFail(429, "RATE_LIMITED", "잠시 후 다시 시도해 주세요.");
  }
  lastUpstreamCallAt = now;

  const url = new URL(NOMINATIM_SEARCH_URL);
  url.search = new URLSearchParams({
    city,
    countrycodes: alpha2,
    format: "jsonv2",
    limit: String(MAX_GEOCODE_CANDIDATES),
    "accept-language": "ko",
    addressdetails: "1",
  }).toString();

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": process.env.NOMINATIM_USER_AGENT?.trim() || DEFAULT_USER_AGENT,
        Accept: "application/json",
        "Accept-Language": "ko",
      },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    console.error("[geocode] 상류 호출 실패", timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR");
    return timedOut
      ? geocodeFail(504, "UPSTREAM_TIMEOUT", UPSTREAM_FAIL_MESSAGE)
      : geocodeFail(502, "UPSTREAM_ERROR", UPSTREAM_FAIL_MESSAGE);
  }

  if (!upstream.ok) {
    const code = upstream.status === 429 ? "UPSTREAM_RATE_LIMITED" : "UPSTREAM_ERROR";
    console.error("[geocode] 상류 오류 응답", upstream.status, code);
    return geocodeFail(502, code, UPSTREAM_FAIL_MESSAGE);
  }

  const body: unknown = await upstream.json().catch(() => null);
  const candidates = parseCandidates(body, alpha2);
  if (!candidates) {
    console.error("[geocode] 상류 응답 형식 오류 UPSTREAM_BAD_RESPONSE");
    return geocodeFail(502, "UPSTREAM_BAD_RESPONSE", UPSTREAM_FAIL_MESSAGE);
  }

  remember(key, candidates);
  return success(candidates);
}
