"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";

export default function RegisterPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [username, setUsername] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [registered, setRegistered] = useState(false);
    const supabase = createClient();

    async function handleRegister() {
        setLoading(true);
        setError(null);
        if (!username || !username.trim()) {
            setError("Username is required");
            setLoading(false);
            return;
        }
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${siteUrl}/auth/callback` } });
        if (error) {
            let msg = error.message || "An error occurred";
            if (/Password should contain/i.test(msg)) {
                msg = "Password must include at least one lowercase letter, one uppercase letter, one number, and one symbol.";
            }
            setError(msg);
            setLoading(false);
            return;
        }
        if (data.user) {
            const res = await fetch("/api/player/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: data.user.id, username: username.trim() }),
            });
            const result = await res.json();
            if (!result.ok) {
                setError(result.error || "Failed to create player");
                setLoading(false);
                return;
            }
        }
        setRegistered(true);
        setLoading(false);
    }

    return (
        <AuthShell>
            {registered ? (
                <div className="text-center flex flex-col gap-4">
                    <div className="text-3xl">📬</div>
                    <div>
                        <h2 className="text-xl font-bold mb-2" style={{ color: "#f0f0f8" }}>
                            Check your email
                        </h2>
                        <p className="text-sm leading-relaxed" style={{ color: "#8a8a9a" }}>
                            We sent a verification link to <strong style={{ color: "#c4c4d4" }}>{email}</strong>. Click it to activate your account, then log
                            in.
                        </p>
                    </div>
                    <Link
                        href="/auth/login"
                        className="w-full py-2.5 rounded-lg font-semibold text-sm text-center mt-2 transition-all"
                        style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#e8e8f0", display: "block" }}
                    >
                        Back to Log In
                    </Link>
                </div>
            ) : (
                <>
                    <div>
                        <Link href="/auth/login" className="text-xs mb-3 flex items-center gap-1" style={{ color: "#666678" }}>
                            ← Back
                        </Link>
                        <h2 className="text-xl font-bold" style={{ color: "#f0f0f8" }}>
                            Create Account
                        </h2>
                    </div>
                    <div className="flex flex-col gap-3">
                        <input
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#e8e8f0" }}
                        />
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#e8e8f0" }}
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#e8e8f0" }}
                        />
                        {error && <p className="text-red-400 text-xs">{error}</p>}
                        <button
                            onClick={handleRegister}
                            disabled={loading}
                            className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-50"
                            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", color: "#e8e8f0" }}
                        >
                            {loading ? "Creating account…" : "Create Account"}
                        </button>
                        <Link href="/auth/login" className="text-xs text-center" style={{ color: "#666678" }}>
                            Already have an account? Log in
                        </Link>
                    </div>
                </>
            )}
        </AuthShell>
    );
}
