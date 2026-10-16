"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "../ui/BrandLogo";
import { Menu, X, ArrowRight } from "lucide-react";

export interface PublicHeaderProps {
  theme?: "dark" | "light";
}

export function PublicHeader({ theme = "dark" }: PublicHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isDark = theme === "dark";

  return (
    <header
      className={`w-full z-50 transition-colors duration-200 ${
        isDark
          ? "bg-[#07132B]/95 text-white border-b border-slate-800/80 backdrop-blur"
          : "bg-white/95 text-slate-900 border-b border-slate-200 backdrop-blur"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center">
          <BrandLogo
            variant={isDark ? "full-dark" : "full"}
            size="md"
            linkToHome
            priority
          />
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8 text-sm font-medium">
          <Link
            href="/#capabilities"
            className={
              isDark
                ? "text-slate-300 hover:text-white transition-colors"
                : "text-slate-600 hover:text-slate-900 transition-colors"
            }
          >
            Product
          </Link>
          <Link
            href="/#solutions"
            className={
              isDark
                ? "text-slate-300 hover:text-white transition-colors"
                : "text-slate-600 hover:text-slate-900 transition-colors"
            }
          >
            Solutions
          </Link>
          <Link
            href="/#features"
            className={
              isDark
                ? "text-slate-300 hover:text-white transition-colors"
                : "text-slate-600 hover:text-slate-900 transition-colors"
            }
          >
            Features
          </Link>
          <Link
            href="/pricing"
            className={
              isDark
                ? "text-slate-300 hover:text-white transition-colors"
                : "text-slate-600 hover:text-slate-900 transition-colors"
            }
          >
            Pricing
          </Link>
          <Link
            href="/#benefits"
            className={
              isDark
                ? "text-slate-300 hover:text-white transition-colors"
                : "text-slate-600 hover:text-slate-900 transition-colors"
            }
          >
            Why VEYRA
          </Link>
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center space-x-4">
          <Link
            href="/login"
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? "text-slate-200 hover:text-white hover:bg-slate-800/80"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            Sign In
          </Link>
          <Link
            href="/register?plan=trial"
            className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 shadow-sm transition-all shadow-blue-600/20 active:scale-[0.98]"
          >
            Start Free Trial
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </div>

        {/* Mobile menu button */}
        <div className="md:hidden flex items-center">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`p-2 rounded-md ${
              isDark
                ? "text-slate-300 hover:text-white hover:bg-slate-800"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div
          className={`md:hidden px-4 pt-2 pb-6 space-y-3 border-t ${
            isDark
              ? "bg-[#07132B] border-slate-800 text-slate-200"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          <div className="flex flex-col space-y-2 pt-2">
            <Link
              href="/#capabilities"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-base font-medium hover:bg-blue-600/10 hover:text-blue-500"
            >
              Product
            </Link>
            <Link
              href="/#solutions"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-base font-medium hover:bg-blue-600/10 hover:text-blue-500"
            >
              Solutions
            </Link>
            <Link
              href="/#features"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-base font-medium hover:bg-blue-600/10 hover:text-blue-500"
            >
              Features
            </Link>
            <Link
              href="/pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-base font-medium hover:bg-blue-600/10 hover:text-blue-500"
            >
              Pricing
            </Link>
            <Link
              href="/#benefits"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-base font-medium hover:bg-blue-600/10 hover:text-blue-500"
            >
              Why VEYRA
            </Link>
          </div>
          <div className="pt-4 border-t border-slate-700/50 flex flex-col space-y-2">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className={`w-full text-center px-4 py-2.5 text-sm font-medium rounded-lg border ${
                isDark
                  ? "border-slate-700 text-white hover:bg-slate-800"
                  : "border-slate-300 text-slate-900 hover:bg-slate-50"
              }`}
            >
              Sign In
            </Link>
            <Link
              href="/register?plan=trial"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center px-4 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
