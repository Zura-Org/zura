"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui";
import { setToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function AuthCallback() {
  const router = useRouter();
  const { refresh } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("token");
    const next = params.get("next");
    if (token) setToken(token);
    // Drop the token from the URL/history before navigating on.
    window.history.replaceState(null, "", "/auth/callback");
    refresh().then(() => router.replace(next && next.startsWith("/") ? next : "/explore"));
  }, [refresh, router]);

  return (
    <div className="flex flex-col items-center gap-3 py-32 text-sm text-mist-400">
      <Spinner />
      Signing you in…
    </div>
  );
}
