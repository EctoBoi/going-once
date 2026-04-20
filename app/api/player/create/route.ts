import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
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
        const isGuest = body?.isGuest === true;

        const id = user?.id ?? providedId;
        if (!id) {
            return NextResponse.json({ ok: false, error: "Missing user id" }, { status: 400 });
        }

        if (!providedUsername) {
            return NextResponse.json({ ok: false, error: "Username is required" }, { status: 400 });
        }

        // Guest usernames are auto-generated (e.g. "Guest_1234") — skip length check
        if (!isGuest && (providedUsername.length < 3 || providedUsername.length > 30)) {
            return NextResponse.json({ ok: false, error: "Username must be 3-30 characters" }, { status: 400 });
        }

        const guestExpiresAt = isGuest ? new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined;

        try {
            const player = await prisma.player.upsert({
                where: { id },
                update: { username: providedUsername },
                create: {
                    id,
                    username: providedUsername,
                    wallet: isGuest ? 1000 : 100,
                    isDiving: false,
                    isGuest,
                    guestExpiresAt,
                },
            });

            // Mirror the chosen username into Supabase Auth user metadata
            try {
                await adminClient.auth.admin.updateUserById(id, {
                    user_metadata: { display_name: providedUsername },
                });
            } catch (err) {
                console.error("Failed to update auth user metadata:", err);
            }

            return NextResponse.json({ ok: true, player });
        } catch (err: unknown) {
            // Prisma unique constraint error
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
                return NextResponse.json({ ok: false, error: "Username already taken" }, { status: 409 });
            }
            throw err;
        }
    } catch (error) {
        console.error("Player create error:", error);
        return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
}
