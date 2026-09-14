"use client";

import { usePathname } from "next/navigation";
import { loginUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { GithubIcon } from "./Nav";
import { Button, Spinner } from "./ui";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  if (loading) {
    return (
      <div className="flex justify-center py-24 text-mist-400">
        <Spinner />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="container-z flex flex-col items-center py-24 text-center">
        <h1 className="text-xl font-semibold text-white">Sign in to continue</h1>
        <p className="mt-2 max-w-sm text-sm text-mist-400">
          Zura uses your GitHub account. A USDC wallet on ARC is created for you automatically — no keys to manage.
        </p>
        <Button href={loginUrl(pathname)} className="mt-6">
          <GithubIcon /> Sign in with GitHub
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
