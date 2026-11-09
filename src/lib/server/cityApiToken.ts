// 서버 전용: 상류 도시 API 쓰기용 토큰을 프로세스 메모리에만 보관함
// 토큰·이메일·상류 주소는 로그와 응답에 노출하지 않음

export class UpstreamConfigError extends Error {}
export class UpstreamAuthError extends Error {}

export const CITY_API_TIMEOUT_MS = 10_000;

export const getCityApiBaseUrl = () => {
  const baseUrl = process.env.CITY_API_BASE_URL;
  if (!baseUrl) {
    throw new UpstreamConfigError(
      "서버 설정 오류: 도시 API 주소가 설정되지 않았습니다.",
    );
  }
  return baseUrl.replace(/\/+$/, "");
};

const getTestEmail = () => {
  const email = process.env.CITY_API_TEST_EMAIL;
  if (!email) {
    throw new UpstreamConfigError(
      "서버 설정 오류: 테스트 계정이 설정되지 않았습니다.",
    );
  }
  return email;
};

let accessToken: string | null = null;
let inflight: Promise<string> | null = null;

const requestToken = async () => {
  const url = `${getCityApiBaseUrl()}/dev/test-login?email=${encodeURIComponent(getTestEmail())}`;
  let token: unknown;
  try {
    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(CITY_API_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error();
    const body = (await response.json()) as { data?: { accessToken?: unknown } };
    token = body?.data?.accessToken;
  } catch {
    throw new UpstreamAuthError();
  }
  if (typeof token !== "string" || !token) throw new UpstreamAuthError();
  accessToken = token;
  return token;
};

// 동시에 필요해도 발급 요청은 한 건만 나감
const issue = () => {
  if (!inflight) {
    inflight = requestToken().finally(() => {
      inflight = null;
    });
  }
  return inflight;
};

const toAuthorization = (token: string) =>
  token.startsWith("Bearer ") ? token : `Bearer ${token}`;

// 토큰이 필요한 상류 호출을 감싸고 401이면 재발급 후 정확히 1회만 재시도함
export async function withCityApiToken(
  call: (authorization: string) => Promise<Response>,
): Promise<Response> {
  const used = accessToken ?? (await issue());
  const response = await call(toAuthorization(used));
  if (response.status !== 401) return response;

  // 다른 요청이 이미 새 토큰을 받았다면 비우지 않고 그 토큰으로 재시도만 함
  if (accessToken === used) accessToken = null;
  const fresh = accessToken ?? (await issue());
  const retry = await call(toAuthorization(fresh));
  if (retry.status === 401) throw new UpstreamAuthError();
  return retry;
}
