export interface LocalNotification {
  id: string;
  type: 'welcome' | 'wallet_created' | 'wallet_imported' | 'swap' | 'send' | 'receive' | 'alert' | 'security' | 'system';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  icon?: string;
}

const STORAGE_KEY = 'steinz_local_notifications';
const MAX_NOTIFICATIONS = 100;

export function getLocalNotifications(): LocalNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function addLocalNotification(notif: Omit<LocalNotification, 'id' | 'timestamp' | 'read'>): void {
  if (typeof window === 'undefined') return;
  const existing = getLocalNotifications();
  const newNotif: LocalNotification = {
    ...notif,
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    read: false,
  };
  existing.unshift(newNotif);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, MAX_NOTIFICATIONS)));
  window.dispatchEvent(new CustomEvent('steinz_notification', { detail: newNotif }));
}

export function markNotificationRead(id: string): void {
  if (typeof window === 'undefined') return;
  const existing = getLocalNotifications();
  const idx = existing.findIndex(n => n.id === id);
  if (idx >= 0) {
    existing[idx].read = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
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

export function notifyWalletCreated(walletName: string): void {
  addLocalNotification({
    type: 'wallet_created',
    title: 'Wallet Created',
    message: `Your wallet "${walletName}" has been created successfully. Remember to back up your recovery phrase.`,
  });
}

export function notifyWalletImported(walletName: string): void {
  addLocalNotification({
    type: 'wallet_imported',
    title: 'Wallet Imported',
    message: `Wallet "${walletName}" has been imported successfully. Your assets are now accessible.`,
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

export function notifyWelcome(email: string): void {
  addLocalNotification({
    type: 'welcome',
    title: 'Welcome to STEINZ LABS',
    message: `Account created for ${email}. Start by creating a wallet to explore on-chain intelligence.`,
  });
}
