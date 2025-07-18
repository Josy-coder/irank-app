"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useState, useEffect } from "react";
import { useConvexOfflineDetector } from "@/lib/pwa/offline-detector";
import { useOfflineSync } from "@/hooks/use-offline";
import { WifiOff, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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

class AuthAwareConvexClient extends ConvexReactClient {
    private router: any = null;

    setRouter(router: any) {
        this.router = router;
    }

    private handleAuthError(error: any) {
        const errorMessage = error?.message || error?.toString() || "";

        const authErrorPatterns = [
            "Authentication required",
            "Admin access required",
            "Volunteer access required",
            "Student access required",
            "School admin access required",
            "Your session is invalid or has expired"
        ];

        const isAuthError = authErrorPatterns.some(pattern =>
          errorMessage.includes(pattern)
        );

        if (isAuthError) {

            localStorage.removeItem("irank_auth_token");
            localStorage.removeItem("irank_user_data");
            localStorage.removeItem("device_id");

            toast.error("Your session has expired. Please sign in again.");

            if (this.router) {
                this.router.push("/");
            }

            return true;
        }

        return false;
    }

    async mutation(mutation: any, args?: any) {
        try {
            return await super.mutation(mutation, args);
        } catch (error) {
            const handled = this.handleAuthError(error);
            if (!handled) {
                throw error;
            }
        }
    }

    async query(query: any, args?: any) {
        try {
            return await super.query(query, args);
        } catch (error) {
            const handled = this.handleAuthError(error);
            if (!handled) {
                throw error;
            }
        }
    }

    async action(action: any, args?: any) {
        try {
            return await super.action(action, args);
        } catch (error) {
            const handled = this.handleAuthError(error);
            if (!handled) {
                throw error;
            }
        }
    }
}

function ConvexClientWrapper({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [convexClient] = useState(() => {
        const client = new AuthAwareConvexClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        return client;
    });

    useEffect(() => {
        (convexClient as AuthAwareConvexClient).setRouter(router);
    }, [router, convexClient]);

    return (
      <ConvexProvider client={convexClient}>
          {children}
      </ConvexProvider>
    );
}

export function ConvexOfflineProvider({ children }: ConvexOfflineProviderProps) {
    return (
      <ConvexClientWrapper>
          <OfflineBanner />
          {children}
      </ConvexClientWrapper>
    );
}