"use client";
import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  variant?: "square" | "horizontal";
  size?: number;
  href?: string | null;
  priority?: boolean;
  className?: string;
}

export function Logo({
  variant = "horizontal",
  size = 40,
  href = "/",
  priority = false,
  className = "",
}: LogoProps) {
  const src = variant === "square" ? "/logo.png" : "/logo-horizontal.png";
  const width = variant === "square" ? size : Math.round(size * 4.61);
  const height = size;

  const img = (
    <Image
      src={src}
      alt="Naka Labs"
      width={width}
      height={height}
      priority={priority}
      className={className}
      style={{ objectFit: "contain" }}
    />
  );

  return href ? (
    <Link href={href} aria-label="Naka Labs home">
      {img}
    </Link>
  ) : (
    img
  );
}

export default Logo;
