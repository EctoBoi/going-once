"use client";

import Image from "next/image";
import { useState } from "react";
import { getItemImageSrc } from "@/lib/game/itemImage";

function getInitials(itemName: string) {
    return itemName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
}

export default function ItemArtwork({
    itemName,
    size,
    className = "",
    imageClassName = "",
    priority = false,
}: {
    itemName: string;
    size?: number;
    className?: string;
    imageClassName?: string;
    priority?: boolean;
}) {
    const [failed, setFailed] = useState(false);

    return (
        <div
            className={[
                "relative overflow-hidden rounded-2xl border border-amber-200/20 bg-linear-to-br from-stone-950 via-stone-900 to-stone-800 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_14px_30px_rgba(0,0,0,0.35)]",
                // keep shrink-0 when an explicit size is used so it doesn't collapse
                size ? "shrink-0" : "",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
            style={typeof size === "number" ? { width: size, height: size } : undefined}
        >
            <div className="pointer-events-none absolute inset-[3px] rounded-[calc(1rem-3px)] border border-white/8" />
            {failed ? (
                <div className="flex h-full w-full items-center justify-center bg-radial from-amber-200/20 via-amber-100/8 to-transparent text-lg font-semibold tracking-[0.2em] text-amber-50/90">
                    {getInitials(itemName)}
                </div>
            ) : (
                <Image
                    src={getItemImageSrc(itemName)}
                    alt={itemName}
                    fill
                    {...(typeof size === "number" ? { sizes: `${size}px` } : {})}
                    priority={priority}
                    className={["object-cover transition-transform duration-300 group-hover:scale-[1.03]", imageClassName].join(" ")}
                    onError={() => setFailed(true)}
                />
            )}
        </div>
    );
}
