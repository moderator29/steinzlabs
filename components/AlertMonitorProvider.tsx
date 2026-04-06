'use client';

import { useAlertMonitor } from '@/lib/hooks/useAlertMonitor';

export default function AlertMonitorProvider() {
  useAlertMonitor();
  return null;
}
