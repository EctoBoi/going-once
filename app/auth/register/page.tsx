"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [username, setUsername] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    async function handleRegister() {
        setLoading(true);
        setError(null);
        if (!username || !username.trim()) {
            setError("Username is required");
            setLoading(false);
            return;
        }
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
            setError(error.message);
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
            console.log("Player create result:", result);
            if (!result.ok) {
                setError(result.error || "Failed to create player");
                setLoading(false);
                return;
            }
        }
        // Force a full-page navigation so the server receives the updated
        window.location.href = "/dashboard";
    }

    return (
        <main className="min-h-screen flex items-center justify-center">
            <div className="flex flex-col gap-4 w-full max-w-sm p-8">
                <h1 className="text-2xl font-bold">Going Once</h1>
                <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="border p-2 rounded" />
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
