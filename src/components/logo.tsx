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
  const iconSize = {
    sm: 26,
    md: 32,
    lg: 40,
  }[size];

  const textSize = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  }[size];

  const content = (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 select-none group transition-opacity hover:opacity-90",
        className
      )}
    >
      <Image
        src="/icon.svg"
        alt="OrbitWork"
        width={iconSize}
        height={iconSize}
        priority
        className="rounded-lg object-contain shrink-0"
      />
      {!iconOnly && (
        <span
          className={cn(
            "font-extrabold tracking-tight text-foreground",
            textSize
          )}
        >
          Orbit
          <span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
            Work
          </span>
        </span>
      )}
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
