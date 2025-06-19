"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useState, useEffect } from "react";
import { useConvexOfflineDetector } from "@/lib/pwa/offline-detector";
import { useOfflineSync } from "@/hooks/useOffline";
import { WifiOff, Clock } from "lucide-react";

interface ConvexOfflineProviderProps {
    children: ReactNode;
}

function OfflineBanner() {
    const { isOffline } = useConvexOfflineDetector();
    const { queueCount } = useOfflineSync();
    const [show, setShow] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted) {
            setShow(isOffline);
        }
    }, [isOffline, mounted]);

    if (!mounted || !show) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white px-4 py-2 text-sm font-medium">
            <div className="flex items-center justify-center gap-2">
                <WifiOff className="h-4 w-4" />
                <span>You&#39;re offline</span>
                {queueCount > 0 && (
                    <>
                        <Clock className="h-4 w-4 ml-2" />
                        <span>{queueCount} action{queueCount !== 1 ? 's' : ''} queued</span>
                    </>
                )}
            </div>
        </div>
    );
}

export function ConvexOfflineProvider({ children }: ConvexOfflineProviderProps) {
    const [convexClient] = useState(() =>
        new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
    );

    return (
        <ConvexProvider client={convexClient}>
            <OfflineBanner />
            {children}
        </ConvexProvider>
    );
}