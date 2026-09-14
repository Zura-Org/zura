import Link from "next/link";
import { GithubIcon } from "@/components/Nav";
import { Button, ComplexityBadge } from "@/components/ui";
import type { Complexity } from "@/lib/types";
import { COMPLEXITY_POINTS } from "@/lib/types";

const OWNER_STEPS = [
  ["Submit your ARC project", "Connect GitHub and list the repo you're building on ARC."],
  ["Fund a Wave", "Lock USDC in an on-chain escrow for a 7, 14 or 30-day sprint."],
  ["Tag issues", "Label issues zura:easy → zura:critical. The bot syncs them instantly."],
  ["Ship faster", "Approve applicants, review PRs, watch the backlog shrink."],
];

const CONTRIBUTOR_STEPS = [
  ["Sign in with GitHub", "A USDC wallet on ARC is created for you. No seed phrase."],
  ["Pick an issue", "Filter ARC projects by language, complexity and points."],
  ["Merge a PR", "Points land the moment your PR merges and CI is green."],
  ["Get paid in USDC", "When the Wave ends, USDC arrives automatically. Withdraw anywhere via CCTP."],
];

const STACK = [
  ["USDC", "Every pool, payout and fee settles in USDC — ARC's native gas token."],
  ["Circle Wallets", "Developer-controlled SCA wallets created at GitHub login."],
  ["Gas Station", "Zura sponsors gas, so contributors never need USDC just to transact."],
  ["CCTP", "Withdraw earnings natively to Ethereum or Base — no manual bridging."],
];

export default function Landing() {
  return (
    <>
      <section className="grid-glow border-b border-ink-800">
        <div className="container-z flex flex-col items-center py-24 text-center sm:py-32">
          <span className="rounded-full border border-ink-700 bg-ink-900 px-3 py-1 text-xs text-mist-300">
            Built natively on Circle&apos;s ARC · Testnet live
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            Get paid in USDC for code that merges.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-mist-300 sm:text-lg">
            Zura is the contributor rewards infrastructure for the ARC ecosystem. Project owners fund Waves in USDC,
            contributors earn for merged PRs, and everything settles on-chain automatically.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button href="/explore" size="lg">Browse open issues</Button>
            <Button href="/projects/new" size="lg" variant="secondary">
              <GithubIcon /> Fund a Wave for your project
            </Button>
          </div>
        </div>
      </section>

      <section className="container-z py-20">
        <div className="grid gap-6 md:grid-cols-2">
          <Steps title="For project owners" kicker="Clear your backlog without hiring" steps={OWNER_STEPS} />
          <Steps title="For contributors" kicker="No applications. No invoices. Just code." steps={CONTRIBUTOR_STEPS} />
        </div>
      </section>

      <section className="container-z pb-20">
        <div className="card grid gap-8 p-8 md:grid-cols-[1fr_1.2fr] md:p-10">
          <div>
            <h2 className="text-2xl font-semibold text-white">Points map to effort. USDC maps to points.</h2>
            <p className="mt-3 text-sm text-mist-300">
              Each merged issue earns points by complexity. When the Wave ends, the pool is split proportionally to
              points — computed and paid by the WavePool contract on ARC. Zura keeps a flat 4% at deposit time;
              nothing else is ever deducted.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(COMPLEXITY_POINTS) as Complexity[]).map((c) => (
              <div key={c} className="rounded-xl border border-ink-700 bg-ink-850 p-4">
                <ComplexityBadge complexity={c} />
                <div className="num mt-3 text-3xl font-semibold text-white">{COMPLEXITY_POINTS[c].toLocaleString()}</div>
                <div className="text-xs text-mist-400">points · label zura:{c}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-z pb-8">
        <h2 className="text-center text-sm font-medium uppercase tracking-widest text-mist-400">Powered by Circle</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STACK.map(([name, body]) => (
            <div key={name} className="card p-5">
              <div className="font-medium text-white">{name}</div>
              <p className="mt-2 text-sm text-mist-400">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-mist-400">
          Open source and permissionless.{" "}
          <Link href="https://github.com/Zura-Org/zura" className="text-zura-400 hover:underline">
            Read the contracts →
          </Link>
        </p>
      </section>
    </>
  );
}

function Steps({ title, kicker, steps }: { title: string; kicker: string; steps: string[][] }) {
  return (
    <div className="card p-8">
      <div className="text-xs font-medium uppercase tracking-widest text-zura-400">{title}</div>
      <h2 className="mt-2 text-xl font-semibold text-white">{kicker}</h2>
      <ol className="mt-6 space-y-5">
        {steps.map(([head, body], i) => (
          <li key={head} className="flex gap-4">
            <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ink-600 text-xs text-mist-300">
              {i + 1}
            </span>
            <div>
              <div className="text-sm font-medium text-white">{head}</div>
              <div className="mt-0.5 text-sm text-mist-400">{body}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
