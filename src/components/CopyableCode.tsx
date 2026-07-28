"use client";

import { useState } from "react";

export default function CopyableCode({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard unavailable, nothing else to do
        }
      }}
      className="inline-flex items-center gap-2 font-mono text-sm text-copper-bright hover:text-copper-bright/80 transition-colors group"
      title="Copy account number"
    >
      {value}
      <span className="text-[10px] uppercase tracking-wide text-muted group-hover:text-paper transition-colors">
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}
