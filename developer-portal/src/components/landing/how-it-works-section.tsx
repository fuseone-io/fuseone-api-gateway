"use client";

import { Search, CreditCard, Code2 } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Search,
    title: "Browse",
    description: "Explore our API catalog and find the services you need for your project.",
    color: "text-blue-500",
    bg: "bg-blue-500",
  },
  {
    number: "02",
    icon: CreditCard,
    title: "Subscribe",
    description: "Choose a plan that fits your needs. Get instant access with auto-approved plans.",
    color: "text-purple-500",
    bg: "bg-purple-500",
  },
  {
    number: "03",
    icon: Code2,
    title: "Integrate",
    description: "Get your API key and start building. Use our interactive docs to test endpoints.",
    color: "text-emerald-500",
    bg: "bg-emerald-500",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Get started in three steps
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            From discovery to integration in minutes, not days.
          </p>
        </div>

        <div className="relative mt-16">
          {/* Connecting line */}
          <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-primary/20 via-secondary/20 to-emerald-500/20 lg:left-0 lg:right-0 lg:top-1/2 lg:h-px lg:w-full lg:-translate-y-1/2 lg:translate-x-0 lg:block lg:bg-gradient-to-r" />

          <div className="grid gap-12 lg:grid-cols-3 lg:gap-8">
            {steps.map((step) => (
              <div key={step.number} className="relative flex flex-col items-center text-center">
                {/* Step circle */}
                <div className="relative mb-6">
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-2xl ${step.bg}/10 ring-4 ring-background`}
                  >
                    <step.icon className={`h-7 w-7 ${step.color}`} />
                  </div>
                  <span
                    className={`absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full ${step.bg} text-xs font-bold text-white`}
                  >
                    {step.number}
                  </span>
                </div>

                <h3 className="text-xl font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-xs leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
