"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Key, Copy, Check, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { portalApi, type PortalSubscription } from "@/lib/api-client";

export default function KeysPage() {
  const [subscriptions, setSubscriptions] = useState<PortalSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    portalApi
      .listMySubscriptions()
      .then((r) => setSubscriptions((r.subscriptions || []).filter((s) => s.api_key)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleReveal = (id: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyKey = (id: string, key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    toast.success("API key copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const maskKey = (key: string) => {
    if (!key) return "---";
    return key.slice(0, 8) + "..." + key.slice(-4);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">API Keys</h1>
        <p className="mt-1 text-muted-foreground">
          Your API keys for authenticated access.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Key className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground">No API keys yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Subscribe to an API to receive your API key.
          </p>
          <Button className="mt-4" asChild>
            <Link href="/apis">Browse APIs</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="rounded-xl border bg-card p-5 shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                    <Key className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{sub.api_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Plan: {sub.plan_name}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 w-fit"
                >
                  {sub.status}
                </Badge>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted p-3">
                <code className="flex-1 text-sm font-mono text-foreground">
                  {revealedKeys.has(sub.id) ? sub.api_key : maskKey(sub.api_key)}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleReveal(sub.id)}
                >
                  {revealedKeys.has(sub.id) ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyKey(sub.id, sub.api_key)}
                >
                  {copiedId === sub.id ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
