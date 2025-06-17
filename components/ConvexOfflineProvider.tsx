"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useState, useEffect } from "react";
import { useConvexOfflineDetector } from "@/lib/pwa/offline-detector";
import { useOfflineSync } from "@/hooks/useOffline";
import { WifiOff, Wifi, Clock } from "lucide-react";

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

function ConnectionStatus() {
  const { isOffline } = useConvexOfflineDetector();
  const { queueCount } = useOfflineSync();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div className={`
        flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium
        ${isOffline
        ? 'bg-red-100 text-red-800 border border-red-200'
        : 'bg-green-100 text-green-800 border border-green-200'
      }
      `}>
        {isOffline ? (
          <>
            <WifiOff className="h-4 w-4" />
            <span>Offline</span>
          </>
        ) : (
          <>
            <Wifi className="h-4 w-4" />
            <span>Online</span>
          </>
        )}

        {queueCount > 0 && (
          <span className="ml-2 px-2 py-0.5 bg-orange-200 text-orange-800 rounded-full text-xs">
            {queueCount}
          </span>
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
      <ConnectionStatus />
    </ConvexProvider>
  );
}