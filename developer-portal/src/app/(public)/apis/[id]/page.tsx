"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Loader2,
  Zap,
  Clock,
  CalendarDays,
  Check,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  portalApi,
  type PortalApiDetail,
  type PortalPlan,
  ApiError,
} from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

const lifecycleColors: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  beta: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  deprecated: "bg-red-500/10 text-red-600 border-red-500/20",
};

export default function ApiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const [api, setApi] = useState<PortalApiDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [confirmPlan, setConfirmPlan] = useState<PortalPlan | null>(null);

  useEffect(() => {
    portalApi
      .getAPI(id)
      .then(setApi)
      .catch(() => toast.error("Failed to load API details"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubscribe = async (plan: PortalPlan) => {
    if (!isAuthenticated) {
      router.push(`/login?returnUrl=/apis/${id}`);
      return;
    }
    setConfirmPlan(plan);
  };

  const confirmSubscribe = async () => {
    if (!confirmPlan) return;
    setSubscribing(true);
    try {
      const sub = await portalApi.subscribe(id, { plan_id: confirmPlan.id });
      if (sub.status === "active" && sub.api_key) {
        toast.success("Subscribed! Your API key has been generated.", {
          description: "Go to your dashboard to view your keys.",
          duration: 5000,
        });
      } else {
        toast.success("Subscription requested! Pending approval.");
      }
      setConfirmPlan(null);
      router.push("/subscriptions");
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.data as { error?: { message?: string } } | undefined;
        const msg = body?.error?.message || "Subscribe failed";
        toast.error(msg);
      } else {
        toast.error("Failed to subscribe.");
      }
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!api) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h2 className="text-xl font-semibold">API not found</h2>
        <p className="mt-2 text-muted-foreground">
          This API may not be available or has been removed.
        </p>
        <Button variant="outline" className="mt-6" asChild>
          <Link href="/apis">Back to Catalog</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <Link
        href="/apis"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Catalog
      </Link>

      {/* API header */}
      <div className="mb-10 rounded-2xl border bg-card p-8 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                  {api.name}
                </h1>
                <span className="text-sm text-muted-foreground">Version {api.version}</span>
              </div>
            </div>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {api.description || "No description available."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={lifecycleColors[api.lifecycle] || ""}
            >
              {api.lifecycle}
            </Badge>
            {api.has_docs && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/apis/${id}/docs`}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  View Docs
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Categories */}
        {api.categories && api.categories.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {api.categories.map((cat) => (
              <span
                key={cat}
                className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                {cat}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Plans */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">Available Plans</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a plan that fits your needs.
        </p>
      </div>

      {api.plans && api.plans.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {api.plans.map((plan, i) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border bg-card p-6 shadow-[0_1px_4px_rgba(0,0,0,0.08)] transition-all hover:shadow-lg ${
                i === 1 ? "ring-2 ring-primary" : ""
              }`}
            >
              {i === 1 && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                  Popular
                </div>
              )}

              <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {plan.description || "Standard API access"}
              </p>

              <div className="my-6 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">
                    {plan.rate_limit > 0
                      ? `${plan.rate_limit} requests/sec`
                      : "Unlimited rate"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">
                    {plan.quota_day > 0
                      ? `${plan.quota_day.toLocaleString()} requests/day`
                      : "Unlimited daily"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">
                    {plan.quota_month > 0
                      ? `${plan.quota_month.toLocaleString()} requests/month`
                      : "Unlimited monthly"}
                  </span>
                </div>
              </div>

              <div className="mt-auto">
                <Button
                  className="w-full"
                  variant={i === 1 ? "default" : "outline"}
                  onClick={() => handleSubscribe(plan)}
                >
                  Subscribe
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-8 text-center shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <p className="text-muted-foreground">
            No plans are currently available for this API. Check back later.
          </p>
        </div>
      )}

      {/* Confirm subscription dialog */}
      <Dialog open={!!confirmPlan} onOpenChange={() => setConfirmPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Subscription</DialogTitle>
            <DialogDescription>
              You are subscribing to <strong>{api.name}</strong> with the{" "}
              <strong>{confirmPlan?.name}</strong> plan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-lg bg-muted p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rate Limit</span>
              <span>
                {confirmPlan?.rate_limit
                  ? `${confirmPlan.rate_limit} req/s`
                  : "Unlimited"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Daily Quota</span>
              <span>
                {confirmPlan?.quota_day
                  ? confirmPlan.quota_day.toLocaleString()
                  : "Unlimited"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monthly Quota</span>
              <span>
                {confirmPlan?.quota_month
                  ? confirmPlan.quota_month.toLocaleString()
                  : "Unlimited"}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPlan(null)}>
              Cancel
            </Button>
            <Button onClick={confirmSubscribe} disabled={subscribing}>
              {subscribing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Subscribing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Confirm
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
