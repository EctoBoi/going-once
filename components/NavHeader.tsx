"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function NavHeader({ username }: { username: string | null }) {
    const router = useRouter();
    const supabase = createClient();

    async function handleLogout() {
        await supabase.auth.signOut();
        router.push("/auth/login");
        router.refresh();
    }

    if (!username) return null;

    return (
        <header className="w-full border-b px-8 py-3 flex justify-between items-center bg-gray-800">
            <Link href="/dashboard" className="flex items-center gap-3 hover:underline text-white">
                <Image src="/favicon.ico" alt="Going Once" width={28} height={28} className="w-7 h-7" />
                <span className="font-semibold text-xl" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                    Going Once
                </span>
            </Link>
            <div className="flex items-center gap-4">
                <span className="text-sm text-gray-200">{username}</span>
                <button onClick={handleLogout} className="text-sm border px-3 py-1 rounded hover:bg-gray-700 text-white border-gray-600">
                    Log out
                </button>
            </div>
        </header>
    );
}
