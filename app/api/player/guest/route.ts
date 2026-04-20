import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminClient } from "@/lib/supabase/admin";

function randomString(length: number) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export async function POST() {
    try {
        // Generate unique throwaway credentials
        const token = randomString(24);
        const email = `guest_${token}@guest.going-once.internal`;
        const password = randomString(32);
        const guestNum = Math.floor(Math.random() * 9000) + 1000;
        const username = `Guest_${guestNum}`;

        // Create a confirmed Supabase auth user via admin client
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });

        if (authError || !authData.user) {
            console.error("Guest auth create error:", authError);
            return NextResponse.json({ ok: false, error: "Failed to create guest account" }, { status: 500 });
        }

        const userId = authData.user.id;
        const guestExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Create the player row
        await prisma.player.create({
            data: {
                id: userId,
                username,
                wallet: 1000,
                isDiving: false,
                isGuest: true,
                guestExpiresAt,
            },
        });

        return NextResponse.json({ ok: true, email, password });
    } catch (error) {
        console.error("Guest creation error:", error);
        return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
}
