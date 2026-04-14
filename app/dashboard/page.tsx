import Link from "next/link";

export default function DashboardPage() {
    return (
        <main className="min-h-screen flex items-center justify-center">
            <div className="flex flex-col gap-4 items-center">
                <h1 className="text-2xl font-bold">Going Once</h1>
                <Link href="/auctions" className="bg-black text-white px-6 py-2 rounded">
                    Browse Auctions
                </Link>
            </div>
        </main>
    );
}
