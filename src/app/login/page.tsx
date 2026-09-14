import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "@/app/login/LoginForm";

export const metadata: Metadata = {
  title: "로그인 | Globber 관리자 대시보드",
};

const LoginPage = async () => {
  const session = await getSession();
  if (session) redirect("/cities");

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-6 py-10">
      <LoginForm />
    </div>
  );
};

export default LoginPage;
