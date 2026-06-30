'use client';

import { Clock } from 'lucide-react';
import ContextEventCard from '@/components/context-feed/ContextEventCard';
import SaveEventButton from '@/components/context-feed/SaveEventButton';
import type { ContextEvent } from '@/lib/hooks/useContextFeed';

/**
 * SavableEventCard — a ContextEventCard plus a thin action strip that carries
 * the "Save to vault" toggle (and, in the vault, the time it was saved). Keeps
 * the shared card component untouched while adding the curate action that the
 * Archive vault needs. The strip sits under the card so it never overlaps the
 * card's own badge / timestamp row.
 */
export default function SavableEventCard({
  event,
  saved,
  onToggle,
  savedAt,
}: {
  event: ContextEvent;
  saved: boolean;
  onToggle: (event: ContextEvent) => Promise<void> | void;
  savedAt?: string;
}) {
  return (
    <div className="nl-fade-up space-y-1.5">
      <ContextEventCard event={event} />
      <div className="flex items-center justify-between px-1">
        {savedAt ? (
          <span className="flex items-center gap-1 text-[10px] text-gray-500">
            <Clock className="w-3 h-3" />
            Saved {new Date(savedAt).toLocaleString()}
          </span>
        ) : (
          <span />
        )}
        <SaveEventButton event={event} saved={saved} onToggle={onToggle} />
      </div>
    </div>
  );
}
