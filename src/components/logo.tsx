import React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  href?: string;
  iconOnly?: boolean;
}

export const Logo = ({
  className,
  size = "md",
  href = "/",
  iconOnly = false,
}: LogoProps) => {
  const dimensions = {
    sm: { width: iconOnly ? 28 : 132, height: iconOnly ? 28 : 32 },
    md: { width: iconOnly ? 36 : 160, height: iconOnly ? 36 : 38 },
    lg: { width: iconOnly ? 44 : 188, height: iconOnly ? 44 : 44 },
  }[size];

  const content = (
    <div className={cn("inline-flex items-center gap-2 select-none group transition-opacity hover:opacity-90", className)}>
      <Image
        src={iconOnly ? "/icon.svg" : "/logo.svg"}
        alt="OrbitWork"
        width={dimensions.width}
        height={dimensions.height}
        priority
        className="object-contain"
      />
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-block">
        {content}
      </Link>
    );
  }

  return content;
};
