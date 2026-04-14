import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import SellForm from "@/components/SellForm";

export default async function SellPage({ params }: { params: Promise<{ playerItemId: string }> }) {
    const { playerItemId } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");

    const playerItem = await prisma.playerItem.findUnique({
        where: { id: playerItemId },
        include: { item: true },
    });

    if (!playerItem || playerItem.playerId !== user.id) notFound();
    if (playerItem.listedAt) redirect("/dashboard");

    return (
        <main className="min-h-screen p-8 max-w-lg mx-auto">
            <h1 className="text-2xl font-bold mb-6">List Item</h1>
            <div className="border rounded-lg p-6">
                <p className="font-semibold text-lg">{playerItem.item.name}</p>
                <p className="text-sm text-gray-500 capitalize mb-1">{playerItem.item.category}</p>
                <p className="text-sm text-gray-400 mb-6">You paid ${playerItem.acquiredFor.toFixed(2)}</p>
                <SellForm playerItemId={playerItem.id} />
            </div>
        </main>
    );
}
