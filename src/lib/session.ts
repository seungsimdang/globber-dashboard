import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "globber_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7일

const getAuthSecret = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET 환경 변수가 설정되지 않았습니다.");
  }
  return secret;
};

const sign = (value: string) =>
  createHmac("sha256", getAuthSecret()).update(value).digest("hex");

const buildToken = (username: string, issuedAt: number) => {
  const payload = `${username}.${issuedAt}`;
  return `${payload}.${sign(payload)}`;
};

const verifyToken = (token: string): { username: string } | null => {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [username, issuedAtRaw, signature] = parts;
  const payload = `${username}.${issuedAtRaw}`;
  const expectedSignature = sign(payload);

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > SESSION_MAX_AGE_SECONDS * 1000) return null;

  return { username };
};

export const createSessionCookieValue = (username: string) =>
  buildToken(username, Date.now());

export const parseSessionCookieValue = (token: string) => verifyToken(token);

export const getSession = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
};

export const setSessionCookie = async (username: string) => {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, createSessionCookieValue(username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
};

export const clearSessionCookie = async () => {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
};

const timingSafeStringEqual = (a: string, b: string) => {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
};

export const verifyCredentials = (username: string, password: string) => {
  const validUsername = process.env.ADMIN_USERNAME;
  const validPassword = process.env.ADMIN_PASSWORD;
  if (!validUsername || !validPassword) {
    throw new Error("ADMIN_USERNAME/ADMIN_PASSWORD 환경 변수가 설정되지 않았습니다.");
  }
  return (
    timingSafeStringEqual(username, validUsername) &&
    timingSafeStringEqual(password, validPassword)
  );
};
