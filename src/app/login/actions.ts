"use server";

import { redirect } from "next/navigation";
import {
  clearSessionCookie,
  setSessionCookie,
  verifyCredentials,
} from "@/lib/session";

export type LoginState = {
  error: string | null;
};

export const login = async (
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> => {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "아이디와 비밀번호를 모두 입력해 주세요." };
  }

  if (!verifyCredentials(username, password)) {
    return { error: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  await setSessionCookie(username);
  redirect("/cities");
};

export const logout = async () => {
  await clearSessionCookie();
  redirect("/login");
};
