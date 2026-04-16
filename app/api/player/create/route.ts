import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        const body = await request.json().catch(() => ({}));
        const providedId = body?.id;
        const providedUsername = typeof body?.username === "string" ? body.username.trim() : undefined;

        const id = user?.id ?? providedId;
        if (!id) {
            return NextResponse.json({ ok: false, error: "Missing user id" }, { status: 400 });
        }

        if (!providedUsername) {
            return NextResponse.json({ ok: false, error: "Username is required" }, { status: 400 });
        }

        if (providedUsername.length < 3 || providedUsername.length > 30) {
            return NextResponse.json({ ok: false, error: "Username must be 3-30 characters" }, { status: 400 });
        }

        try {
            const player = await prisma.player.upsert({
                where: { id },
                update: { username: providedUsername },
                create: { id, username: providedUsername, wallet: 100, isDiving: false },
            });

            return NextResponse.json({ ok: true, player });
        } catch (err: any) {
            // Prisma unique constraint error
            if (err?.code === "P2002") {
                return NextResponse.json({ ok: false, error: "Username already taken" }, { status: 409 });
            }
            throw err;
        }
    } catch (error) {
        console.error("Player create error:", error);
        return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
}
