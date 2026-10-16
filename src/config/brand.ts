/**
 * Central Brand Configuration for VEYRA SaaS Platform
 * All logo and brand asset paths must be referenced from here.
 */

export const BRAND_CONFIG = {
  name: "VEYRA",
  tagline: "SIMPLIFY CONNECT GROW",
  description: "Enterprise SaaS CRM, Operations & Service Management Platform",
  heroHeadline: "One Platform for a Smarter Business",
  heroSubheadline:
    "Unify your customers, sales, projects and service operations in one connected platform. Simplify work, improve visibility and grow with VEYRA.",
  assets: {
    logoFull: "/brand/veyra-logo-full.png",
    logoFullDark: "/brand/veyra-logo-full-dark.png",
    logo: "/brand/veyra-logo.png",
    logoMark: "/brand/veyra-logo-mark.png",
    favicon: "/favicon.ico",
    icon192: "/icon-192.png",
    icon512: "/icon-512.png",
  },
  colors: {
    primary: "#0B5FFF",
    teal: "#00E5DB",
    darkNavy: "#0A1A3A",
    neutralText: "#6B7280",
    white: "#FFFFFF",
  },
} as const;

export type BrandVariant = "full" | "full-dark" | "default" | "mark";
