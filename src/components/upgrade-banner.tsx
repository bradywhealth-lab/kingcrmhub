"use client";

import { useState } from "react";
import Link from "next/link";
import { Crown, X } from "lucide-react";

export function CrmDashboardBanner() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("crm-dash-banner") === "1";
  });

  if (dismissed) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-[#c9b98a] bg-[radial-gradient(ellipse_at_top_right,rgba(180,140,60,0.10),transparent_55%),linear-gradient(135deg,#fdfcf6,#f8f2e0)] shadow-sm">
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b8860b] shadow">
          <Crown className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#3a2a00]">Upgrade your plan</p>
          <p className="mt-0.5 text-sm text-[#7a6020]">
            Get AI-powered lead grading, automation, and unlimited pipelines. Starter from $39/mo.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/pricing"
            className="rounded-xl bg-[#b8860b] px-4 py-2 text-sm font-bold text-white shadow transition-all hover:bg-[#9a6f09] hover:shadow-md"
          >
            View plans
          </Link>
          <button
            onClick={() => {
              sessionStorage.setItem("crm-dash-banner", "1");
              setDismissed(true);
            }}
            className="rounded-lg p-1.5 text-[#9a8040] transition-colors hover:bg-white/60 hover:text-[#3a2a00]"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-[#d4b96a] border-t border-[#d4b96a]">
        {[
          { label: "Active leads", used: 12, limit: 25 },
          { label: "AI grades / mo", used: 3, limit: 5 },
          { label: "Automations", used: 1, limit: 2 },
        ].map(({ label, used, limit }) => (
          <div key={label} className="px-4 py-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs text-[#7a6020]">{label}</span>
              <span className="text-xs font-semibold text-[#3a2a00]">{used}/{limit}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#d4b96a]/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#b8860b] to-[#d4a017] transition-all"
                style={{ width: `${(used / limit) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
