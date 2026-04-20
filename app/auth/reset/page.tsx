"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/auth/AuthShell";

export default function ResetPasswordPage() {
    const supabase = createClient();
    const [email, setEmail] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError(null);
        setSent(false);

        const redirectTo = `${window.location.origin}/auth/reset/confirm`;
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

        setLoading(false);

        if (resetError) {
            setError(resetError.message);
            return;
        }

        setSent(true);
    }

    return (
        <AuthShell>
            <div>
                <Link href="/auth/login" className="text-xs mb-3 flex items-center gap-1" style={{ color: "#666678" }}>
                    ← Back to log in
                </Link>
                <h1 className="text-xl font-bold" style={{ color: "#f0f0f8" }}>
                    Reset password
                </h1>
                <p className="text-sm mt-1" style={{ color: "#8a8a9a" }}>
                    Enter your email and we&apos;ll send you a reset link.
                </p>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#e8e8f0" }}
                    required
                />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                {sent && (
                    <p className="text-xs" style={{ color: "#6dbf6d" }}>
                        If an account exists for that email, a reset link has been sent.
                    </p>
                )}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-50"
                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", color: "#e8e8f0" }}
                >
                    {loading ? "Sending…" : "Send reset email"}
                </button>
            </form>
        </AuthShell>
    );
}
