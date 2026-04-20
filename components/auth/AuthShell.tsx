import { ReactNode } from "react";

export default function AuthShell({ children }: { children: ReactNode }) {
    return (
        <main className="relative min-h-screen overflow-hidden bg-black flex items-center justify-center">
            {/* CRT bezel wrapper: centers and clips the background video */}
            <div className="absolute m-3 inset-0 z-0 pointer-events-none flex items-center justify-center">
                <div
                    className="relative overflow-hidden"
                    style={{
                        inset: "6px",
                        borderRadius: "18px",
                        boxShadow: "inset 0 0 0 6px rgba(30,30,30,0.95), inset 0 0 0 12px rgba(10,10,10,0.9), 0 30px 120px rgba(0,0,0,0.8)",
                        border: "6px solid rgba(30,30,30,0.95)",
                        width: "100%",
                        height: "100%",
                        position: "absolute",
                        top: 0,
                        left: 0,
                    }}
                >
                    <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover"
                        src="/GoingOnce.webm"
                        suppressHydrationWarning
                    />

                    {/* Scanlines + subtle vignette clipped to CRT */}
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)",
                            mixBlendMode: "overlay",
                        }}
                    />
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)",
                        }}
                    />
                </div>
            </div>

            {/* Decorative bezel shadow (outside the clipped area) */}
            <div
                className="absolute z-10 pointer-events-none"
                style={{
                    inset: "0",
                    display: "block",
                    background: "none",
                }}
            />

            {/* Auth card: give more room on small screens and a bit larger on desktop */}
            <div className="relative z-30 w-full max-w-md mx-6 sm:mx-8">
                <div
                    className="rounded-xl p-6 sm:p-10 flex flex-col gap-5"
                    style={{
                        background: "rgba(10,10,15,0.92)",
                        border: "1px solid rgba(80,80,100,0.5)",
                        boxShadow: "0 8px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)",
                        backdropFilter: "blur(8px)",
                    }}
                >
                    {children}
                </div>
            </div>
        </main>
    );
}
