"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    async function handleRegister() {
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }
        router.push("/dashboard");
    }

    return (
        <main className="min-h-screen flex items-center justify-center">
            <div className="flex flex-col gap-4 w-full max-w-sm p-8">
                <h1 className="text-2xl font-bold">Going Once</h1>
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="border p-2 rounded" />
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="border p-2 rounded" />
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button onClick={handleRegister} disabled={loading} className="bg-black text-white p-2 rounded">
                    {loading ? "Creating account..." : "Register"}
                </button>
                <p className="text-sm text-center">
                    Have an account?{" "}
                    <Link href="/auth/login" className="underline">
                        Log in
                    </Link>
                </p>
            </div>
        </main>
    );
}
