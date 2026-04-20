"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";

type View = "landing" | "login" | "guest-loading";

export default function LoginPage() {
    const [view, setView] = useState<View>("landing");

    // Login state
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");
    const [loginError, setLoginError] = useState<string | null>(null);
    const [loginLoading, setLoginLoading] = useState(false);

    const supabase = createClient();

    async function handleLogin() {
        setLoginLoading(true);
        setLoginError(null);
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
        if (error) {
            setLoginError(error.message);
            setLoginLoading(false);
            return;
        }
        window.location.href = "/dashboard";
    }

    async function handleGuest() {
        setView("guest-loading");
        // Create guest user server-side (anonymous auth may not be enabled)
        const res = await fetch("/api/player/guest", { method: "POST" });
        const result = await res.json();
        if (!result.ok) {
            setView("landing");
            return;
        }
        // Sign in with the generated credentials
        const { error } = await supabase.auth.signInWithPassword({ email: result.email, password: result.password });
        if (error) {
            setView("landing");
            return;
        }
        window.location.href = "/dashboard";
    }

    return (
        <AuthShell>
            {view === "landing" && (
                <>
                    <div className="text-center">
                        <h1
                            className="text-4xl font-bold mb-2 tracking-tight"
                            style={{
                                fontFamily: "Georgia, 'Times New Roman', serif",
                                color: "#f5e6c8",
                                textShadow: "0 0 20px rgba(255,210,100,0.3)",
                            }}
                        >
                            Going Once
                        </h1>
                        <p className="text-sm leading-relaxed" style={{ color: "#8a8a9a" }}>
                            A real-time auction house where you scavenge, sell, and outbid rivals to build your fortune. Every lot has a story. Every bid
                            counts.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 mt-1">
                        <button
                            onClick={() => setView("login")}
                            className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all"
                            style={{
                                background: "rgba(255,255,255,0.08)",
                                border: "1px solid rgba(255,255,255,0.15)",
                                color: "#e8e8f0",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.13)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                        >
                            Log In
                        </button>
                        <Link
                            href="/auth/register"
                            className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all text-center"
                            style={{
                                background: "rgba(255,255,255,0.08)",
                                border: "1px solid rgba(255,255,255,0.15)",
                                color: "#e8e8f0",
                                display: "block",
                            }}
                        >
                            Register
                        </Link>
                        <button
                            onClick={handleGuest}
                            className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all"
                            style={{
                                background: "rgba(120,90,200,0.18)",
                                border: "1px solid rgba(150,120,220,0.35)",
                                color: "#c4b0f0",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(120,90,200,0.28)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(120,90,200,0.18)")}
                        >
                            Play as Guest
                        </button>
                        <p className="text-center text-xs" style={{ color: "#555565" }}>
                            Guest accounts start with $1,000 and expire after 24 hours
                        </p>
                    </div>
                </>
            )}

            {view === "login" && (
                <>
                    <div>
                        <button
                            onClick={() => setView("landing")}
                            className="text-xs mb-3 flex items-center gap-1 transition-colors"
                            style={{ color: "#666678" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#9999bb")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#666678")}
                        >
                            ← Back
                        </button>
                        <h2 className="text-xl font-bold" style={{ color: "#f0f0f8" }}>
                            Log In
                        </h2>
                    </div>
                    <div className="flex flex-col gap-3">
                        <input
                            type="email"
                            placeholder="Email"
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                            style={{
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.12)",
                                color: "#e8e8f0",
                            }}
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                            style={{
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.12)",
                                color: "#e8e8f0",
                            }}
                        />
                        {loginError && <p className="text-red-400 text-xs">{loginError}</p>}
                        <button
                            onClick={handleLogin}
                            disabled={loginLoading}
                            className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-50"
                            style={{
                                background: "rgba(255,255,255,0.1)",
                                border: "1px solid rgba(255,255,255,0.18)",
                                color: "#e8e8f0",
                            }}
                        >
                            {loginLoading ? "Logging in…" : "Log In"}
                        </button>
                        <div className="flex justify-between text-xs" style={{ color: "#666678" }}>
                            <Link
                                href="/auth/reset"
                                className="transition-colors"
                                style={{ color: "#666678" }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = "#9999bb")}
                                onMouseLeave={(e) => (e.currentTarget.style.color = "#666678")}
                            >
                                Forgot password?
                            </Link>
                            <Link href="/auth/register" className="transition-colors" style={{ color: "#666678" }}>
                                Register instead
                            </Link>
                        </div>
                    </div>
                </>
            )}

            {view === "guest-loading" && (
                <div className="text-center flex flex-col gap-4 py-4">
                    <div
                        className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto"
                        style={{ borderColor: "rgba(150,120,220,0.6)", borderTopColor: "transparent" }}
                    />
                    <p className="text-sm" style={{ color: "#8a8a9a" }}>
                        Setting up your guest session…
                    </p>
                </div>
            )}
        </AuthShell>
    );
}
