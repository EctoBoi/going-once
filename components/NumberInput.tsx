"use client";

import React from "react";

type NumberInputProps = {
    value: string;
    onChange: (val: string) => void;
    min?: number;
    step?: number;
    className?: string; // wrapper
    inputClassName?: string; // input
    placeholder?: string;
    ariaLabel?: string;
};

export default function NumberInput({ value, onChange, min, step = 1, className = "", inputClassName = "", placeholder, ariaLabel }: NumberInputProps) {
    function parseVal(v: string) {
        const n = parseFloat(v);
        return isNaN(n) ? undefined : n;
    }

    function clamp(n: number) {
        if (typeof min === "number" && n < min) return min;
        return n;
    }

    function setNumber(n: number) {
        onChange(String(n));
    }

    function inc() {
        const cur = parseVal(value);
        const base = cur ?? 0; //(typeof min === "number" ? min : 0);
        setNumber(clamp(base + step));
    }

    function dec() {
        const cur = parseVal(value);
        const base = cur ?? (typeof min === "number" ? min : 0);
        setNumber(clamp(base - step));
    }

    return (
        <div className={`relative ${className} ${inputClassName}`}>
            <input
                type="text"
                inputMode="decimal"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-label={ariaLabel}
                className={`no-spinner pr-10 bg-transparent w-full`}
            />

            <div className="absolute inset-y-0 right-0 w-9 flex flex-col divide-y border-l" style={{ background: "inherit" }}>
                <button type="button" onClick={inc} aria-label="increase" className="flex-1 flex items-center justify-center hover:opacity-90">
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-stone-300"
                    >
                        <polyline points="6 15 12 9 18 15" />
                    </svg>
                </button>
                <button type="button" onClick={dec} aria-label="decrease" className="flex-1 flex items-center justify-center hover:opacity-90">
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-stone-300"
                    >
                        <polyline points="18 9 12 15 6 9" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
