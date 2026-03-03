"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Layers,
  Key,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { portalApi, type DeveloperProfile } from "@/lib/api-client";

export default function DashboardPage() {
  const { user, fetchProfile, profile } = useAuthStore();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchProfile().finally(() => setLoaded(true));
  }, [fetchProfile]);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">
          Hello, {user?.full_name || user?.username}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Welcome to your developer dashboard.
        </p>
      </div>

      {/* Stats cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card className="shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Subscriptions
            </CardTitle>
            <Layers className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {loaded ? (profile?.active_subscriptions ?? 0) : "-"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              API Keys
            </CardTitle>
            <Key className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {loaded ? (profile?.total_keys ?? 0) : "-"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Member Since
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-foreground">
              {loaded && profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString()
                : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <h2 className="mb-4 text-lg font-semibold text-foreground">Quick Actions</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/apis"
          className="group flex items-center gap-4 rounded-xl border bg-card p-5 shadow-[0_1px_4px_rgba(0,0,0,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
            <BookOpen className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Browse APIs</p>
            <p className="text-sm text-muted-foreground">Discover new APIs</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
        </Link>

        <Link
          href="/subscriptions"
          className="group flex items-center gap-4 rounded-xl border bg-card p-5 shadow-[0_1px_4px_rgba(0,0,0,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
            <Layers className="h-5 w-5 text-purple-500" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">My Subscriptions</p>
            <p className="text-sm text-muted-foreground">Manage your plans</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
        </Link>

        <Link
          href="/keys"
          className="group flex items-center gap-4 rounded-xl border bg-card p-5 shadow-[0_1px_4px_rgba(0,0,0,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
            <Key className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">API Keys</p>
            <p className="text-sm text-muted-foreground">View your credentials</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
        </Link>
      </div>
    </div>
  );
}
