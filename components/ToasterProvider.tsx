"use client";

import { Toaster, ToastBar, toast } from "react-hot-toast";

export default function ToasterProvider() {
    return (
        <Toaster position="top-center" toastOptions={{ duration: 7000 }}>
            {(t) => (
                <div
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer"
                    onClick={() => toast.dismiss(t.id)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toast.dismiss(t.id)}
                >
                    <ToastBar toast={t} />
                </div>
            )}
        </Toaster>
    );
}
