import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import CleanupClient from "@/components/CleanupClient";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import NavHeader from "@/components/NavHeader";
import ResponsiveToaster from "@/components/ResponsiveToaster";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Going Once",
    description: "A real-time auction game",
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    let username: string | null = null;
    if (user) {
        const player = await prisma.player.findUnique({
            where: { id: user.id },
            select: { username: true },
        });
        username = player?.username ?? user.email ?? null;
    }

    return (
        <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
            <body className="min-h-full flex flex-col">
                <NavHeader username={username} />
                {children}
                <CleanupClient />
                <ResponsiveToaster />
            </body>
        </html>
    );
}
