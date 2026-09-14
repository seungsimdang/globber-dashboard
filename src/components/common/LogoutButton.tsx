"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/common/Button";
import { logout } from "@/app/login/actions";

export const LogoutButton = () => {
  return (
    <form action={logout}>
      <Button type="submit" variant="ghost" size="sm">
        <LogOut className="h-4 w-4" aria-hidden="true" />
        로그아웃
      </Button>
    </form>
  );
};
