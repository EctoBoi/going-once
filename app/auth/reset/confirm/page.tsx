"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/auth/AuthShell";

export default function ResetPasswordConfirmPage() {
    const supabase = createClient();
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let mounted = true;

        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const searchParams = new URLSearchParams(window.location.search);
        const hasRecoveryToken = hashParams.has("access_token") || searchParams.get("type") === "recovery";

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (!mounted) {
                return;
            }

            if (event === "PASSWORD_RECOVERY" || Boolean(session)) {
                setReady(true);
            }
        });

        void supabase.auth.getSession().then(({ data }) => {
            if (!mounted) {
                return;
            }

            if (hasRecoveryToken || data.session) {
                setReady(true);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [supabase]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        const { error: updateError } = await supabase.auth.updateUser({ password });

        setLoading(false);

        if (updateError) {
            setError(updateError.message);
            return;
        }

        setSuccess("Password updated. Redirecting to login...");
        window.setTimeout(() => {
            router.push("/auth/login");
        }, 1200);
    }

    return (
        <AuthShell>
            <h1 className="text-xl font-bold" style={{ color: "#f0f0f8" }}>
                Choose a new password
            </h1>
            {!ready ? (
                <>
                    <p className="text-sm" style={{ color: "#8a8a9a" }}>
                        Open this page from the reset link in your email so we can verify your recovery session.
                    </p>
                    <Link href="/auth/reset" className="text-xs text-center" style={{ color: "#666678" }}>
                        Request another reset email
                    </Link>
                </>
            ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <input
                        type="password"
                        placeholder="New password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#e8e8f0" }}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#e8e8f0" }}
                        required
                    />
                    {error && <p className="text-red-400 text-xs">{error}</p>}
                    {success && (
                        <p className="text-xs" style={{ color: "#6dbf6d" }}>
                            {success}
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-50"
                        style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", color: "#e8e8f0" }}
                    >
                        {loading ? "Updating…" : "Set new password"}
                    </button>
                </form>
            )}
        </AuthShell>
    );
}
