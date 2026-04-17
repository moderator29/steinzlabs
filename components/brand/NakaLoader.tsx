"use client";
import Image from "next/image";

interface NakaLoaderProps {
  size?: number;
  text?: string;
  subtle?: boolean;
}

export function NakaLoader({ size = 48, text = "Loading...", subtle = false }: NakaLoaderProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${subtle ? "py-4" : "py-8"}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <div className="absolute inset-0 rounded-xl bg-blue-500/20 animate-ping" />
        <Image
          src="/logo.png"
          alt=""
          width={size}
          height={size}
          className="relative animate-pulse rounded-xl"
        />
      </div>
      {text && <p className="text-slate-400 text-sm">{text}</p>}
    </div>
  );
}

export default NakaLoader;
