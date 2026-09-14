"use client";

import clsx from "clsx";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Button, Empty, ErrorNote, PageHeader } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { shortAddress, usdc } from "@/lib/format";
import type { Project } from "@/lib/types";

const DURATIONS = [7, 14, 30] as const;

export default function CreateWavePage() {
  return (
    <RequireAuth>
      <Suspense>
        <CreateWave />
      </Suspense>
    </RequireAuth>
  );
}

function CreateWave() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const { data } = useApi<{ projects: Project[] }>("/api/projects/mine");
  const [projectId, setProjectId] = useState(params.get("projectId") ?? "");
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(14);
  const [amount, setAmount] = useState("1000");
  const [step, setStep] = useState<"idle" | "deploying" | "funding">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId && data?.projects[0]) setProjectId(data.projects[0].id);
  }, [data, projectId]);

  const gross = Number(amount) || 0;
  const fee = gross * 0.04;

  async function launch() {
    setError(null);
    try {
      setStep("deploying");
      const created = await api("/api/waves/create", { method: "POST", json: { projectId, durationDays: duration } });
      if (!created.onchain) {
        router.push(`/waves/${created.wave.id}`);
        return;
      }
      setStep("funding");
      await api(`/api/waves/${created.wave.id}/fund`, { method: "POST", json: { amount } });
      router.push(`/waves/${created.wave.id}`);
    } catch (err) {
      setError((err as Error).message);
      setStep("idle");
    }
  }

  if (data && !data.projects.length) {
    return (
      <div className="container-z max-w-2xl py-10">
        <Empty title="Submit a project first">
          <Button href="/projects/new" className="mt-4">Submit an ARC project</Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="container-z max-w-3xl py-10">
      <PageHeader title="Launch a Wave" subtitle="Lock USDC in an on-chain escrow and open your issues to contributors." />

      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <div>
            <label className="label" htmlFor="project">Project</label>
            <select id="project" className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {data?.projects.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.repo_full_name}</option>)}
            </select>
          </div>

          <div>
            <span className="label">Duration</span>
            <div className="grid grid-cols-3 gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={clsx(
                    "rounded-lg border px-3 py-3 text-sm transition",
                    duration === d ? "border-zura bg-zura/10 text-white" : "border-ink-700 bg-ink-850 text-mist-300 hover:border-ink-600",
                  )}
                >
                  <div className="num text-lg font-semibold">{d}</div>
                  days
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="amount">Pool deposit (USDC)</label>
            <input id="amount" className="input num text-lg" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
            <p className="mt-2 text-xs text-mist-400">
              Paid from your Circle wallet <span className="font-mono text-mist-300">{shortAddress(user?.wallet_address)}</span>.
              Get testnet USDC at <a href="https://faucet.circle.com" className="text-zura-400 hover:underline">faucet.circle.com</a> (ARC Testnet). Gas is sponsored by Zura.
            </p>
          </div>

          <ErrorNote error={error} />
          <Button size="lg" className="w-full" loading={step !== "idle"} disabled={!projectId || gross < 10} onClick={launch}>
            {step === "deploying" ? "Deploying WavePool on ARC…" : step === "funding" ? "Depositing USDC…" : "Deploy & fund Wave"}
          </Button>
        </div>

        <aside className="card h-fit p-5 text-sm">
          <h3 className="font-medium text-white">Summary</h3>
          <dl className="mt-4 space-y-3">
            <Row label="Deposit" value={`${usdc(gross)} USDC`} />
            <Row label="Zura fee (4%)" value={`−${usdc(fee)} USDC`} />
            <div className="border-t border-ink-800 pt-3">
              <Row label="Contributor pool" value={<span className="text-usdc">{usdc(gross - fee)} USDC</span>} strong />
            </div>
            <Row label="Duration" value={`${duration} days`} />
          </dl>
          <p className="mt-5 text-xs text-mist-400">
            Funds are held by your WavePool contract. If nobody merges a contribution, you can reclaim the pool after the Wave ends.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-mist-400">{label}</dt>
      <dd className={clsx("num text-right", strong ? "font-semibold text-white" : "text-mist-200")}>{value}</dd>
    </div>
  );
}
