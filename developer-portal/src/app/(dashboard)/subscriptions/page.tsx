"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Layers, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { portalApi, type PortalSubscription } from "@/lib/api-client";

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  suspended: "bg-red-500/10 text-red-600 border-red-500/20",
  rejected: "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<PortalSubscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalApi
      .listMySubscriptions()
      .then((r) => setSubscriptions(r.subscriptions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Subscriptions</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your API subscriptions and plans.
          </p>
        </div>
        <Button asChild>
          <Link href="/apis">Browse APIs</Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Layers className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground">No subscriptions yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse our API catalog and subscribe to a plan to get started.
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
              className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-[0_1px_4px_rgba(0,0,0,0.08)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Layers className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{sub.api_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Plan: {sub.plan_name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={statusColors[sub.status] || ""}
                >
                  {sub.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(sub.created_at).toLocaleDateString()}
                </span>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/apis/${sub.api_id}`}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
