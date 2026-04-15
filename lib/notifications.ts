export interface LocalNotification {
  id: string;
  type: 'welcome' | 'wallet_created' | 'wallet_imported' | 'swap' | 'send' | 'receive' | 'alert' | 'security' | 'system' | 'whale_alert' | 'price_target' | 'new_launch' | 'wallet_activity';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  icon?: string;
}

const STORAGE_KEY = 'steinz_local_notifications';
const MAX_NOTIFICATIONS = 100;
const WELCOMED_KEY = 'steinz_welcomed';

export function getLocalNotifications(): LocalNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function addLocalNotification(notif: Omit<LocalNotification, 'id' | 'timestamp' | 'read'>): LocalNotification {
  const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Date.now().toString(36);
  const newNotif: LocalNotification = {
    ...notif,
    id: `notif-${Date.now()}-${randomPart}`,
    timestamp: Date.now(),
    read: false,
  };

  if (typeof window === 'undefined') return newNotif;

  const existing = getLocalNotifications();
  existing.unshift(newNotif);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, MAX_NOTIFICATIONS)));
  window.dispatchEvent(new CustomEvent('steinz_notification', { detail: newNotif }));

  // Also persist to API (fire-and-forget, include userId)
  try {
    const userId = localStorage.getItem('steinz_user_id') || undefined;
    fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: notif.type,
        title: notif.title,
        message: notif.message,
        userId,
      }),
    }).catch(() => {});
  } catch {}

  return newNotif;
}

export function markNotificationRead(id: string): void {
  if (typeof window === 'undefined') return;
  const existing = getLocalNotifications();
  const idx = existing.findIndex(n => n.id === id);
  if (idx >= 0) {
    existing[idx].read = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  }

  // Also mark in API for Supabase-backed notifications
  if (id.startsWith('sb-')) {
    fetch(`/api/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {});
  }
}

export function markAllNotificationsRead(): void {
  if (typeof window === 'undefined') return;
  const existing = getLocalNotifications().map(n => ({ ...n, read: true }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function getUnreadCount(): number {
  return getLocalNotifications().filter(n => !n.read).length;
}

/**
 * Trigger a welcome notification on first login.
 * Checks localStorage flag to avoid duplicates.
 */
export function maybeNotifyWelcome(email?: string): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(WELCOMED_KEY)) return;

  addLocalNotification({
    type: 'welcome',
    title: 'Welcome to Steinz! 🎉',
    message: "You've joined the most advanced crypto intelligence platform. Explore your dashboard, set up your wallet, and let VTX guide your trades.",
  });

  localStorage.setItem(WELCOMED_KEY, 'true');
}

export function notifyWelcome(email: string): void {
  addLocalNotification({
    type: 'welcome',
    title: 'Welcome to STEINZ LABS',
    message: `Account created for ${email}. Start by creating a wallet to explore on-chain intelligence.`,
  });
}

export function notifyWalletCreated(walletName: string, chain?: string): void {
  const chainStr = chain ? chain.charAt(0).toUpperCase() + chain.slice(1) : '';
  addLocalNotification({
    type: 'wallet_created',
    title: 'Wallet Created! 🎉',
    message: chainStr
      ? `Your ${chainStr} wallet has been successfully created and secured. You're now ready to trade.`
      : `Your wallet "${walletName}" has been created successfully. Remember to back up your recovery phrase.`,
  });
}

export function notifyWalletImported(walletName: string, chain?: string): void {
  const chainStr = chain ? chain.charAt(0).toUpperCase() + chain.slice(1) : '';
  addLocalNotification({
    type: 'wallet_imported',
    title: 'Wallet Imported! 🎉',
    message: chainStr
      ? `Your ${chainStr} wallet has been successfully imported and secured. Your assets are now accessible.`
      : `Wallet "${walletName}" has been imported successfully. Your assets are now accessible.`,
  });
}

export function notifySwapCompleted(fromToken: string, toToken: string, fromAmount: string): void {
  addLocalNotification({
    type: 'swap',
    title: 'Swap Completed',
    message: `Swapped ${fromAmount} ${fromToken} to ${toToken} successfully.`,
  });
}

export function notifyTransactionSent(to: string, amount: string, token: string): void {
  addLocalNotification({
    type: 'send',
    title: 'Transaction Sent',
    message: `Sent ${amount} ${token} to ${to.slice(0, 8)}...${to.slice(-6)}.`,
  });
}

export function notifyAlertFired(
  alertType: 'whale_alert' | 'price_target' | 'new_launch' | 'wallet_activity',
  title: string,
  message: string,
  userEmail?: string
): void {
  addLocalNotification({ type: alertType, title, message });

  // For critical alerts, also call the email endpoint
  const criticalTypes = ['whale_alert', 'price_target'];
  if (criticalTypes.includes(alertType) && userEmail) {
    const prefs = getNotificationPrefs();
    const shouldEmail =
      (alertType === 'whale_alert' && prefs.emailWhaleAlerts) ||
      (alertType === 'price_target' && prefs.emailPriceAlerts);

    if (shouldEmail) {
      fetch('/api/send-notification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, type: alertType, userEmail }),
      }).catch(() => {});
    }
  }
}

export interface NotificationPrefs {
  emailWhaleAlerts: boolean;
  emailPriceAlerts: boolean;
  browserPush: boolean;
}

const PREFS_KEY = 'steinz_notification_prefs';

export function getNotificationPrefs(): NotificationPrefs {
  if (typeof window === 'undefined') {
    return { emailWhaleAlerts: true, emailPriceAlerts: true, browserPush: false };
  }
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) return { emailWhaleAlerts: true, emailPriceAlerts: true, browserPush: false, ...JSON.parse(stored) };
  } catch {}
  return { emailWhaleAlerts: true, emailPriceAlerts: true, browserPush: false };
}

export function saveNotificationPrefs(prefs: NotificationPrefs): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
