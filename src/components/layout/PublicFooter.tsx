"use client";

import React from "react";
import Link from "next/link";
import { BrandLogo } from "../ui/BrandLogo";
import { BRAND_CONFIG } from "../../config/brand";

export function PublicFooter() {
  const currentYear = 2026;

  return (
    <footer className="bg-[#050D1F] text-slate-400 border-t border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <BrandLogo variant="full-dark" size="md" linkToHome />
            <p className="text-sm text-slate-400 max-w-sm mt-3 leading-relaxed">
              Unified enterprise platform connecting CRM, sales, project delivery,
              service management, procurement, and asset operations in one intelligent system.
            </p>
            <div className="pt-2 text-xs text-slate-500">
              Simplify work. Connect operations. Grow your business.
            </div>
          </div>

          {/* Product Links */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
              Platform
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/#capabilities" className="hover:text-white transition-colors">
                  CRM & Sales
                </Link>
              </li>
              <li>
                <Link href="/#capabilities" className="hover:text-white transition-colors">
                  Project Delivery
                </Link>
              </li>
              <li>
                <Link href="/#capabilities" className="hover:text-white transition-colors">
                  Service Management
                </Link>
              </li>
              <li>
                <Link href="/#capabilities" className="hover:text-white transition-colors">
                  Procurement & Assets
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white transition-colors">
                  Subscription Plans
                </Link>
              </li>
            </ul>
          </div>

          {/* Company & Support */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
              Solutions & Sales
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/contact-sales" className="hover:text-white transition-colors">
                  Contact Sales
                </Link>
              </li>
              <li>
                <Link href="/register?plan=trial" className="hover:text-white transition-colors">
                  Start 7-Day Trial
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/#benefits" className="hover:text-white transition-colors">
                  Why VEYRA
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
              Legal & Compliance
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <span className="text-xs text-slate-500 block pt-1">
                  Draft policies subject to formal legal review.
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800/80 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {currentYear} {BRAND_CONFIG.name}. All rights reserved.</p>
          <p className="text-center md:text-right text-slate-500">
            Enterprise CRM & Service Management SaaS. Built with modern tenant isolation and role-based governance.
          </p>
        </div>
      </div>
    </footer>
  );
}
