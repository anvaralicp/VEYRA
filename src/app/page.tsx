import React from "react";
import { PublicHeader } from "../components/layout/PublicHeader";
import { HeroSection } from "../components/landing/HeroSection";
import { ProductCapabilities } from "../components/landing/ProductCapabilities";
import { PlatformBenefits } from "../components/landing/PlatformBenefits";
import { PricingSection } from "../components/landing/PricingSection";
import { PublicFooter } from "../components/layout/PublicFooter";

export const metadata = {
  title: "VEYRA — One Platform for a Smarter Business",
  description:
    "Unify your customers, sales, projects, and service operations in one connected SaaS platform. Simplify work, improve visibility and grow with VEYRA.",
};

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      <PublicHeader theme="dark" />
      <main className="flex-1">
        <HeroSection />
        <ProductCapabilities />
        <PlatformBenefits />
        <PricingSection />
      </main>
      <PublicFooter />
    </div>
  );
}
