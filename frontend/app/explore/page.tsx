"use client";

import { useEffect, useMemo, useState } from "react";
import { ProjectCard } from "@/components/ProjectCard";
import { Empty, ErrorNote, PageHeader, Spinner } from "@/components/ui";
import { useApi } from "@/lib/api";
import type { Project } from "@/lib/types";

const LANGUAGES = ["TypeScript", "Solidity", "Rust", "Go", "Python"];
const TYPES = ["defi", "payments", "infrastructure", "tooling", "wallet", "nft", "other"];

export default function Explore() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [language, setLanguage] = useState("");
  const [complexity, setComplexity] = useState("");
  const [type, setType] = useState("");
  const [minPoints, setMinPoints] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const path = useMemo(() => {
    const p = new URLSearchParams();
    if (debounced) p.set("q", debounced);
    if (language) p.set("language", language);
    if (complexity) p.set("complexity", complexity);
    if (type) p.set("type", type);
    if (minPoints) p.set("minPoints", minPoints);
    if (activeOnly) p.set("activeOnly", "true");
    return `/api/projects?${p}`;
  }, [debounced, language, complexity, type, minPoints, activeOnly]);

  const { data, error, loading } = useApi<{ projects: Project[] }>(path);

  return (
    <div className="container-z py-10">
      <PageHeader title="Explore ARC projects" subtitle="Live Waves funded in USDC. Pick an issue, merge a PR, get paid." />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <input className="input" placeholder="Search projects…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Language">
          <option value="">Any language</option>
          {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
        </select>
        <select className="input" value={complexity} onChange={(e) => setComplexity(e.target.value)} aria-label="Complexity">
          <option value="">Any complexity</option>
          <option value="easy">Easy · 100</option>
          <option value="medium">Medium · 300</option>
          <option value="hard">Hard · 700</option>
          <option value="critical">Critical · 1500</option>
        </select>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Project type">
          <option value="">Any type</option>
          {TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>
        <select className="input" value={minPoints} onChange={(e) => setMinPoints(e.target.value)} aria-label="Minimum points">
          <option value="">Any points</option>
          <option value="300">300+ pts</option>
          <option value="700">700+ pts</option>
          <option value="1500">1500 pts</option>
        </select>
      </div>
      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-mist-300">
        <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} className="accent-zura" />
        Live Waves only
      </label>

      <div className="mt-8">
        <ErrorNote error={error} />
        {loading && !data ? (
          <div className="flex justify-center py-20 text-mist-400"><Spinner /></div>
        ) : data?.projects.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.projects.map((p) => <ProjectCard key={p.id} project={p} />)}
          </div>
        ) : (
          !error && <Empty title="No projects match these filters">Try widening your search, or check back when new Waves launch.</Empty>
        )}
      </div>
    </div>
  );
}
