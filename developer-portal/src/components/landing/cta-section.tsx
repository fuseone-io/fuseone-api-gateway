"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="relative overflow-hidden border-t bg-muted/30 py-20 sm:py-28">
      {/* Background decorations */}
      <div className="absolute -left-20 top-0 h-64 w-64 rounded-full bg-primary/[0.04] blur-3xl" />
      <div className="absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-secondary/[0.04] blur-3xl" />

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Ready to get started?
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Create your free developer account and start integrating with our APIs today.
          No credit card required.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button size="lg" className="h-12 px-8 text-base" asChild>
            <Link href="/register">
              Create Free Account
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="ghost" className="h-12 px-8 text-base" asChild>
            <Link href="/login">
              Already have an account? Sign in
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
