"use client";

import { useEffect, useState } from "react";
import { timeLeft } from "@/lib/format";

export function Countdown({ end }: { end: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return <span className="num">{timeLeft(end, now)}</span>;
}
