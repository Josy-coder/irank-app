import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "./useAuth";
import { useEffect, useState } from "react";

export function useNotifications() {
  const { user, isAuthenticated, token } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  const notifications = useQuery(
    api.functions.notifications.getUserNotifications,
    isAuthenticated && user && token ? { token, limit: 50 } : "skip"
  );

  const unreadCount = useQuery(
    api.functions.notifications.getUnreadCount,
    isAuthenticated && user && token ? { token } : "skip"
  );

  const markAsRead = useMutation(api.functions.notifications.markAsRead);
  const markAllAsRead = useMutation(api.functions.notifications.markAllAsRead);
  const storePushSubscription = useMutation(api.functions.notifications.storePushSubscription);
  const removeSubscription = useMutation(api.functions.notifications.removeUserSubscription);
  const createNotification = useMutation(api.functions.notifications.createNotification);

  useEffect(() => {
    setIsSupported(
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    );

    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn("Push notifications not supported");
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission === 'granted') {
        await subscribeToPush();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to request notification permission:", error);
      return false;
    }
  };

  const subscribeToPush = async () => {
    if (!isSupported || !isAuthenticated || !user || !token) {
      throw new Error("Cannot subscribe: missing requirements");
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!)
        });
      }

      await storePushSubscription({
        token,
        subscription: {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
            auth: arrayBufferToBase64(subscription.getKey('auth')!)
          }
        },
        device_info: {
          user_agent: navigator.userAgent,
          platform: navigator.platform,
          device_name: getDeviceName()
        }
      });

      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  };

  const unsubscribeFromPush = async () => {
    if (!isSupported || !token) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        await removeSubscription({
          token,
          endpoint: subscription.endpoint
        });
      }
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      throw error;
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    if (!token) return;

    try {
      await markAsRead({
        token,
        notification_id: notificationId as any
      });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      throw error;
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!token) return;

    try {
      await markAllAsRead({ token });
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      throw error;
    }
  };

  const handleCreateNotification = async (params: {
    user_id: string;
    title: string;
    message: string;
    type: "tournament" | "debate" | "result" | "system" | "auth";
    related_id?: string;
    send_push?: boolean;
  }) => {
    if (!token) return;

    try {
      return await createNotification({
        token,
        ...params,
        user_id: params.user_id as any
      });
    } catch (error) {
      console.error("Failed to create notification:", error);
      throw error;
    }
  };

  return {
    notifications: notifications || [],
    unreadCount: unreadCount || 0,

    isSupported,
    permission,

    requestPermission,
    subscribeToPush,
    unsubscribeFromPush,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
    createNotification: handleCreateNotification,

    isLoading: notifications === undefined || unreadCount === undefined,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(byte => binary += String.fromCharCode(byte));
  return window.btoa(binary);
}

function getDeviceName(): string {
  const ua = navigator.userAgent;

  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android Device';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Linux/.test(ua)) return 'Linux PC';

  return 'Unknown Device';
}