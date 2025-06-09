"use node";

import webpush, { PushSubscription, SendResult } from "web-push";

webpush.setVapidDetails(
  'mailto:' + process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
}

export interface PushResult {
  success: true;
  result: SendResult;
}

export interface PushError {
  success: false;
  error: string;
  statusCode?: number;
}

export type PushResponse = PushResult | PushError;

export interface BulkPushResult {
  subscription: PushSubscriptionData;
  success: boolean;
  result?: SendResult;
  error?: string;
  statusCode?: number;
}

export async function sendWebPush(
  subscription: PushSubscriptionData,
  payload: NotificationPayload
): Promise<PushResponse> {
  try {
    const webPushSubscription: PushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth
      }
    };

    const result = await webpush.sendNotification(
      webPushSubscription,
      JSON.stringify(payload)
    );

    return {
      success: true,
      result
    };
  } catch (error: any) {
    console.error("Web push failed:", error);
    return {
      success: false,
      error: error.message || 'Unknown error',
      statusCode: error.statusCode
    };
  }
}

export async function sendBulkWebPush(
  subscriptions: PushSubscriptionData[],
  payload: NotificationPayload
): Promise<BulkPushResult[]> {
  const results = await Promise.allSettled(
    subscriptions.map(subscription => sendWebPush(subscription, payload))
  );

  return results.map((result, index) => {
    const subscription = subscriptions[index];

    if (result.status === 'fulfilled') {
      const pushResponse = result.value;
      return {
        subscription,
        success: pushResponse.success,
        ...(pushResponse.success
            ? { result: pushResponse.result }
            : {
              error: pushResponse.error,
              statusCode: pushResponse.statusCode
            }
        )
      };
    } else {
      return {
        subscription,
        success: false,
        error: result.reason?.message || 'Promise rejected',
        statusCode: result.reason?.statusCode
      };
    }
  });
}
