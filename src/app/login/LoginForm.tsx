"use client";

import { useActionState } from "react";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Label } from "@/components/common/Label";
import { login, type LoginState } from "@/app/login/actions";

const initialState: LoginState = { error: null };

export const LoginForm = () => {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <form
      action={formAction}
      className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
    >
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Globber 관리자 로그인</h1>
        <p className="mt-1 text-sm text-gray-500">관리자 계정으로 로그인해 주세요.</p>
      </div>

      <div>
        <Label htmlFor="username" required>
          아이디
        </Label>
        <Input id="username" name="username" autoComplete="username" required />
      </div>

      <div>
        <Label htmlFor="password" required>
          비밀번호
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" isLoading={isPending}>
        로그인
      </Button>
    </form>
  );
};
