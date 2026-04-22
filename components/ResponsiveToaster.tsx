"use client";

import { useEffect, useState } from "react";
import { Toaster, ToastBar, toast } from "react-hot-toast";

type ToasterPosition = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";

// Moves toasts to top-center in portrait mode (mobile/tablet), bottom-right otherwise.
export default function ResponsiveToaster() {
    const [position, setPosition] = useState<ToasterPosition>("bottom-right");

    useEffect(() => {
        // Portrait + narrower than lg breakpoint (1024px) = mobile/tablet portrait
        const mq = window.matchMedia("(orientation: portrait) and (max-width: 1023px)");

        const update = (e: MediaQueryListEvent | MediaQueryList) => {
            setPosition(e.matches ? "top-center" : "bottom-right");
        };

        update(mq);
        mq.addEventListener("change", update);
        return () => mq.removeEventListener("change", update);
    }, []);

    return (
        <Toaster position={position} toastOptions={{ duration: 7000 }}>
            {(t) => (
                <div role="button" tabIndex={0} className="cursor-pointer" onClick={() => toast.dismiss(t.id)}>
                    <ToastBar toast={t} position={position} />
                </div>
            )}
        </Toaster>
    );
}
