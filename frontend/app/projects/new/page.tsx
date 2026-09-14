"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Button, ErrorNote, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";

export default function NewProject() {
  return (
    <RequireAuth>
      <Form />
    </RequireAuth>
  );
}

function Form() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const { project } = await api("/api/projects", {
        method: "POST",
        json: {
          name: form.get("name"),
          githubUrl: form.get("githubUrl"),
          description: form.get("description"),
          arcUsage: form.get("arcUsage"),
          language: form.get("language") || undefined,
          projectType: form.get("projectType"),
        },
      });
      router.push(`/waves/create?projectId=${project.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="container-z max-w-2xl py-10">
      <PageHeader title="Submit an ARC project" subtitle="List your repo on Zura, then fund a Wave to attract contributors." />
      <form onSubmit={submit} className="mt-8 space-y-5">
        <div>
          <label className="label" htmlFor="name">Project name</label>
          <input id="name" name="name" required minLength={2} maxLength={80} className="input" placeholder="Arc Pay SDK" />
        </div>
        <div>
          <label className="label" htmlFor="githubUrl">GitHub repository</label>
          <input id="githubUrl" name="githubUrl" type="url" required className="input font-mono" placeholder="https://github.com/your-org/your-repo" />
        </div>
        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" name="description" maxLength={2000} className="input min-h-[90px]" placeholder="What does the project do?" />
        </div>
        <div>
          <label className="label" htmlFor="arcUsage">What are you building on ARC?</label>
          <textarea id="arcUsage" name="arcUsage" maxLength={2000} className="input min-h-[90px]" placeholder="Contracts deployed, Circle products used, roadmap…" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="language">Primary language</label>
            <input id="language" name="language" className="input" placeholder="TypeScript" />
          </div>
          <div>
            <label className="label" htmlFor="projectType">Project type</label>
            <select id="projectType" name="projectType" className="input" defaultValue="other">
              {["defi", "payments", "infrastructure", "tooling", "wallet", "nft", "other"].map((t) => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>
          </div>
        </div>
        <ErrorNote error={error} />
        <div className="flex justify-end">
          <Button type="submit" loading={busy}>Submit and continue</Button>
        </div>
      </form>
    </div>
  );
}
