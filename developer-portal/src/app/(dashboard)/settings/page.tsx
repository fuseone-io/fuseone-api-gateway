"use client";

import { useState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { portalApi, ApiError } from "@/lib/api-client";

export default function SettingsPage() {
  const { user, profile, fetchProfile } = useAuthStore();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    company: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        email: profile.email || "",
        company: profile.company || "",
      });
    } else if (user) {
      setForm({
        full_name: user.full_name || "",
        email: user.email || "",
        company: "",
      });
    }
  }, [profile, user]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await portalApi.updateProfile(form);
      await fetchProfile();
      toast.success("Profile updated successfully");
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.data as { error?: { message?: string } } | undefined;
        const msg = body?.error?.message || "Update failed";
        toast.error(msg);
      } else {
        toast.error("Failed to update profile");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your developer profile.
        </p>
      </div>

      <Card className="shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your personal details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={user?.username || ""} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">
              Username cannot be changed.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              placeholder="Optional"
            />
          </div>

          <div className="pt-2">
            <Button onClick={handleSave} disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Save Changes
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
