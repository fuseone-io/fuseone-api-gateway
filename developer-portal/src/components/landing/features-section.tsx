"use client";

import { Zap, Key, BookOpen } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "API Catalog",
    description:
      "Browse and discover APIs with powerful search and category filters. Find exactly what you need to build your application.",
    gradient: "from-blue-500/10 to-blue-600/5",
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
  },
  {
    icon: Key,
    title: "Self-Service Access",
    description:
      "Subscribe to plans, get your API keys, and start integrating in minutes. No manual approvals required.",
    gradient: "from-purple-500/10 to-purple-600/5",
    iconColor: "text-purple-500",
    iconBg: "bg-purple-500/10",
  },
  {
    icon: BookOpen,
    title: "Interactive Docs",
    description:
      "Explore comprehensive API documentation with a built-in Try-It console. Test endpoints directly in your browser.",
    gradient: "from-emerald-500/10 to-emerald-600/5",
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
  },
];

export function FeaturesSection() {
  return (
    <section className="relative border-t bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything you need to integrate
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A complete platform for discovering, testing, and connecting to APIs.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`animate-fade-in-up-delay-${i + 1} group relative rounded-2xl border bg-card p-8 shadow-[0_1px_4px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative">
                <div
                  className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.iconBg}`}
                >
                  <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
