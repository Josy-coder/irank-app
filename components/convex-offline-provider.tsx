"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useState, useEffect, createContext } from "react";
import { useConvexOfflineDetector } from "@/lib/pwa/offline-detector";
import { useOfflineSync } from "@/hooks/use-offline";
import { WifiOff, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface ConvexOfflineProviderProps {
    children: ReactNode;
}

const AuthErrorContext = createContext<((error: any) => boolean) | null>(null);

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

class ConvexClientWrapper {
    private readonly client: ConvexReactClient;
    private authErrorHandler: ((error: any) => boolean) | null = null;

    constructor(url: string) {
        this.client = new ConvexReactClient(url);
        this.interceptMethods();
    }

    setAuthErrorHandler(handler: (error: any) => boolean) {
        this.authErrorHandler = handler;
    }

    private interceptMethods() {
        const originalMutation = this.client.mutation.bind(this.client);
        const originalQuery = this.client.query.bind(this.client);
        const originalAction = this.client.action.bind(this.client);

        this.client.mutation = (async (mutation: any, ...argsAndOptions: any[]) => {
            try {
                return await (originalMutation as any)(mutation, ...argsAndOptions);
            } catch (error) {
                if (this.authErrorHandler && this.authErrorHandler(error)) {
                    return;
                }
                throw error;
            }
        }) as any;

        this.client.query = (async (query: any, ...argsAndOptions: any[]) => {
            try {
                return await (originalQuery as any)(query, ...argsAndOptions);
            } catch (error) {
                if (this.authErrorHandler && this.authErrorHandler(error)) {
                    return;
                }
                throw error;
            }
        }) as any;

        this.client.action = (async (action: any, ...argsAndOptions: any[]) => {
            try {
                return await (originalAction as any)(action, ...argsAndOptions);
            } catch (error) {
                if (this.authErrorHandler && this.authErrorHandler(error)) {
                    return;
                }
                throw error;
            }
        }) as any;
    }

    getClient(): ConvexReactClient {
        return this.client;
    }
}

function ConvexAuthWrapper({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [clientWrapper] = useState(() =>
      new ConvexClientWrapper(process.env.NEXT_PUBLIC_CONVEX_URL!)
    );

    const handleAuthError = (error: any): boolean => {
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

            router.push("/");

            return true;
        }

        return false;
    };

    useEffect(() => {
        clientWrapper.setAuthErrorHandler(handleAuthError);
    }, [router, clientWrapper]);

    return (
      <ConvexProvider client={clientWrapper.getClient()}>
          <AuthErrorContext.Provider value={handleAuthError}>
              {children}
          </AuthErrorContext.Provider>
      </ConvexProvider>
    );
}

export function ConvexOfflineProvider({ children }: ConvexOfflineProviderProps) {
    return (
      <ConvexAuthWrapper>
          <OfflineBanner />
          {children}
      </ConvexAuthWrapper>
    );
}