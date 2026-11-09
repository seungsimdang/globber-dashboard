// 서버 전용: 인증이 필요한 Route Handler의 세션 판정을 한 곳에 모은 래퍼
// src/proxy.ts가 /api 경로를 보호하지 않으므로 이 래퍼가 유일한 방어선임
import { getSession } from "@/lib/session";
import { failResponse } from "./cityUpstream";

export function withSession<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response>,
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    const session = await getSession();
    if (!session) return failResponse(401, "로그인이 필요합니다.");
    return handler(request, ...args);
  };
}
