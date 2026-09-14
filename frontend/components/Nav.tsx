"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { loginUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar, Button } from "./ui";

const LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/wallet", label: "Wallet" },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-white">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 6h16L4 18h16" stroke="#7C5CFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Zura
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { user, unread, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/80 backdrop-blur">
      <div className="container-z flex h-14 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-1 sm:flex">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "rounded-md px-3 py-1.5 text-sm transition",
                  pathname.startsWith(l.href) ? "bg-ink-800 text-white" : "text-mist-400 hover:text-white",
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {loading ? null : user ? (
            <div className="relative">
              <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-ink-800">
                <Avatar src={user.avatar_url} name={user.github_username} />
                <span className="hidden text-sm text-white sm:inline">{user.github_username}</span>
                {unread > 0 && <span className="num rounded-full bg-zura px-1.5 text-[10px] font-semibold text-white">{unread}</span>}
              </button>
              {open && (
                <div className="card absolute right-0 mt-2 w-48 overflow-hidden p-1 shadow-xl" onClick={() => setOpen(false)}>
                  <MenuLink href={`/contributor/${user.github_username}`}>Profile</MenuLink>
                  <MenuLink href="/dashboard">Dashboard</MenuLink>
                  <MenuLink href="/wallet">Wallet</MenuLink>
                  <MenuLink href="/projects/new">Submit project</MenuLink>
                  <button onClick={logout} className="w-full rounded-md px-3 py-2 text-left text-sm text-mist-400 hover:bg-ink-800 hover:text-white">
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Button href={loginUrl(pathname)} size="sm">
              <GithubIcon /> Sign in with GitHub
            </Button>
          )}
        </div>
      </div>
      <nav className="container-z flex gap-1 pb-2 sm:hidden">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={clsx("rounded-md px-3 py-1 text-sm", pathname.startsWith(l.href) ? "bg-ink-800 text-white" : "text-mist-400")}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block rounded-md px-3 py-2 text-sm text-mist-300 hover:bg-ink-800 hover:text-white">
      {children}
    </Link>
  );
}

export function GithubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
