import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const player = await prisma.player.upsert({
            where: { id: user.id },
            update: {},
            create: { id: user.id, wallet: 100, isDiving: false },
        });

        return NextResponse.json({ ok: true, player });
    } catch (error) {
        console.error("Player create error:", error);
        return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
}
