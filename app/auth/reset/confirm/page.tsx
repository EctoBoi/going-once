"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
        <main className="min-h-screen flex items-center justify-center">
            <div className="flex w-full max-w-sm flex-col gap-4 p-8">
                <h1 className="text-2xl font-bold">Choose a new password</h1>
                {!ready ? (
                    <>
                        <p className="text-sm text-neutral-600">Open this page from the reset link in your email so we can verify your recovery session.</p>
                        <p className="text-sm text-center">
                            <Link href="/auth/reset" className="underline">
                                Request another reset email
                            </Link>
                        </p>
                    </>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                        <input
                            type="password"
                            placeholder="New password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className="border p-2 rounded"
                            required
                        />
                        <input
                            type="password"
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            className="border p-2 rounded"
                            required
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        {success && <p className="text-sm text-green-700">{success}</p>}
                        <button type="submit" disabled={loading} className="bg-black text-white p-2 rounded">
                            {loading ? "Updating..." : "Set new password"}
                        </button>
                    </form>
                )}
            </div>
        </main>
    );
}
