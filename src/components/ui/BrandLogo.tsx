import React from "react";
import Image from "next/image";
import Link from "next/link";
import { BRAND_CONFIG, BrandVariant } from "../../config/brand";
import { cn } from "../../lib/utils";

export interface BrandLogoProps {
  variant?: BrandVariant;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "custom";
  className?: string;
  imageClassName?: string;
  linkToHome?: boolean;
  priority?: boolean;
}

const SIZE_PRESETS = {
  xs: { height: 24, width: 90, markWidth: 24 },
  sm: { height: 32, width: 120, markWidth: 32 },
  md: { height: 40, width: 160, markWidth: 40 },
  lg: { height: 48, width: 195, markWidth: 48 },
  xl: { height: 60, width: 240, markWidth: 60 },
  custom: { height: 40, width: 160, markWidth: 40 },
};

export function BrandLogo({
  variant = "full",
  size = "md",
  className,
  imageClassName,
  linkToHome = false,
  priority = false,
}: BrandLogoProps) {
  let src: string;
  let alt: string;
  let aspectRatioWidth: number;
  let aspectRatioHeight: number;

  const preset = SIZE_PRESETS[size] || SIZE_PRESETS.md;

  switch (variant) {
    case "full-dark":
      src = BRAND_CONFIG.assets.logoFullDark;
      alt = `${BRAND_CONFIG.name} — ${BRAND_CONFIG.tagline}`;
      aspectRatioWidth = 2008;
      aspectRatioHeight = 570;
      break;
    case "full":
      src = BRAND_CONFIG.assets.logoFull;
      alt = `${BRAND_CONFIG.name} — ${BRAND_CONFIG.tagline}`;
      aspectRatioWidth = 1834;
      aspectRatioHeight = 445;
      break;
    case "mark":
      src = BRAND_CONFIG.assets.logoMark;
      alt = `${BRAND_CONFIG.name} Emblem`;
      aspectRatioWidth = 1102;
      aspectRatioHeight = 881;
      break;
    case "default":
    default:
      src = BRAND_CONFIG.assets.logo;
      alt = BRAND_CONFIG.name;
      aspectRatioWidth = 1854;
      aspectRatioHeight = 442;
      break;
  }

  const isMark = variant === "mark";
  const displayWidth = isMark ? preset.markWidth : preset.width;
  const displayHeight = preset.height;

  const imageElement = (
    <Image
      src={src}
      alt={alt}
      width={displayWidth}
      height={displayHeight}
      priority={priority}
      className={cn(
        "object-contain select-none transition-opacity duration-200",
        isMark ? "aspect-square" : "h-auto w-auto",
        imageClassName
      )}
      style={{
        maxHeight: `${displayHeight}px`,
        maxWidth: isMark ? `${displayHeight}px` : undefined,
        aspectRatio: `${aspectRatioWidth} / ${aspectRatioHeight}`,
      }}
    />
  );

  if (linkToHome) {
    return (
      <Link
        href="/"
        className={cn(
          "inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md",
          className
        )}
        aria-label="VEYRA Home"
      >
        {imageElement}
      </Link>
    );
  }

  return (
    <div className={cn("inline-flex items-center", className)}>
      {imageElement}
    </div>
  );
}
