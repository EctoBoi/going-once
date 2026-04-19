"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
        <main className="min-h-screen flex items-center justify-center">
            <div className="flex w-full max-w-sm flex-col gap-4 p-8">
                <h1 className="text-2xl font-bold">Reset password</h1>
                <p className="text-sm text-neutral-600">Enter your email and we&apos;ll send you a link to choose a new password.</p>
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="border p-2 rounded"
                        required
                    />
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    {sent && <p className="text-sm text-green-700">If an account exists for that email, a reset link has been sent.</p>}
                    <button type="submit" disabled={loading} className="bg-black text-white p-2 rounded">
                        {loading ? "Sending..." : "Send reset email"}
                    </button>
                </form>
                <p className="text-sm text-center">
                    <Link href="/auth/login" className="underline">
                        Back to login
                    </Link>
                </p>
            </div>
        </main>
    );
}
