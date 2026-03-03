"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-background to-secondary/[0.03]" />
      <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-primary/[0.04] blur-3xl" />
      <div className="absolute -bottom-40 left-0 h-[400px] w-[400px] rounded-full bg-secondary/[0.04] blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left content */}
          <div className="animate-fade-in-up">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              API Gateway Developer Portal
            </div>

            <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Discover &{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Connect
              </span>{" "}
              to APIs
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Browse our API catalog, subscribe to plans, and start integrating
              in minutes. Self-service access to all the APIs you need.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Button size="lg" className="h-12 px-8 text-base" asChild>
                <Link href="/apis">
                  Browse APIs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-8 text-base"
                asChild
              >
                <Link href="/register">Create Free Account</Link>
              </Button>
            </div>

            {/* Mini stats */}
            <div className="mt-12 flex gap-8">
              <div>
                <p className="text-2xl font-bold text-foreground">Fast</p>
                <p className="text-sm text-muted-foreground">Setup in minutes</p>
              </div>
              <div className="h-12 w-px bg-border" />
              <div>
                <p className="text-2xl font-bold text-foreground">Secure</p>
                <p className="text-sm text-muted-foreground">Enterprise-grade</p>
              </div>
              <div className="h-12 w-px bg-border" />
              <div>
                <p className="text-2xl font-bold text-foreground">Self-Service</p>
                <p className="text-sm text-muted-foreground">No approvals needed</p>
              </div>
            </div>
          </div>

          {/* Right illustration */}
          <div className="animate-fade-in-up-delay-1 flex justify-center lg:justify-end">
            <div className="animate-float relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary/10 to-secondary/10 blur-2xl" />
              <img
                src="/hero-illustration.svg"
                alt="API Gateway Architecture"
                className="relative h-auto w-full max-w-md rounded-2xl lg:max-w-lg"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
