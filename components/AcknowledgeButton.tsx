'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { formatBriefDate } from '@/lib/daily-brief';
import {
  useAcknowledgeHomeworkMutation,
  useAcknowledgeNoticeMutation,
  useMyAcknowledgementsQuery,
  useParentAccessQuery,
  useUnacknowledgeHomeworkMutation,
  useUnacknowledgeNoticeMutation,
} from '@/lib/queries/acknowledgements';

function formatAckWhen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const day = formatBriefDate(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d),
    );
    const time = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
    return `${day} · ${time}`;
  } catch {
    return '';
  }
}

type Kind = 'homework' | 'notice';

export default function AcknowledgeButton({
  kind,
  itemId,
}: {
  kind: Kind;
  itemId: string;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isParent = session?.user?.role === 'parent';
  const { data: acks } = useMyAcknowledgementsQuery();
  const { data: access, isLoading: accessLoading } = useParentAccessQuery(isParent);
  const ackHw = useAcknowledgeHomeworkMutation();
  const unackHw = useUnacknowledgeHomeworkMutation();
  const ackNt = useAcknowledgeNoticeMutation();
  const unackNt = useUnacknowledgeNoticeMutation();

  const map = kind === 'homework' ? acks?.homework : acks?.notices;
  const acknowledgedAt = map?.[itemId];
  const isAcked = Boolean(acknowledgedAt);

  const pending =
    ackHw.isPending ||
    unackHw.isPending ||
    ackNt.isPending ||
    unackNt.isPending;

  const error =
    (ackHw.data && !ackHw.data.ok ? ackHw.data.error : null) ||
    (ackNt.data && !ackNt.data.ok ? ackNt.data.error : null) ||
    (unackHw.data && !unackHw.data.ok ? unackHw.data.error : null) ||
    (unackNt.data && !unackNt.data.ok ? unackNt.data.error : null) ||
    ackHw.error?.message ||
    ackNt.error?.message ||
    unackHw.error?.message ||
    unackNt.error?.message ||
    null;

  if (status === 'loading') {
    return (
      <div className="mt-2 h-9 w-28 bg-gray-100 rounded-lg animate-pulse" aria-hidden />
    );
  }

  if (!isParent) {
    const next = encodeURIComponent(pathname || '/homework');
    return (
      <div className="mt-2">
        <Link
          href={`/login?next=${next}`}
          className="inline-flex items-center justify-center min-h-10 px-3 py-2 rounded-xl border border-orange-200 bg-orange-50 text-xs font-bold text-orange-700 hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
        >
          Sign in to acknowledge
        </Link>
      </div>
    );
  }

  if (accessLoading) {
    return (
      <div className="mt-2 h-9 w-40 bg-gray-100 rounded-lg animate-pulse" aria-hidden />
    );
  }

  if (access && !access.hasApprovedLink) {
    // Page-level banner handles this once — avoid repeating on every item.
    return null;
  }

  const onAcknowledge = async () => {
    if (kind === 'homework') {
      await ackHw.mutateAsync(itemId);
    } else {
      await ackNt.mutateAsync(itemId);
    }
  };

  const onUndo = async () => {
    if (kind === 'homework') {
      await unackHw.mutateAsync(itemId);
    } else {
      await unackNt.mutateAsync(itemId);
    }
  };

  if (isAcked && acknowledgedAt) {
    return (
      <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2">
        <p className="text-sm font-bold text-emerald-800">Acknowledged</p>
        <p className="text-xs text-emerald-700/80 mt-0.5">
          {formatAckWhen(acknowledgedAt)}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => void onUndo()}
          className="mt-1.5 text-xs font-semibold text-emerald-800/70 hover:text-emerald-900 underline-offset-2 hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded"
        >
          {pending ? 'Saving…' : 'Undo acknowledgement'}
        </button>
        {error ? (
          <p className="text-xs text-red-600 mt-1" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => void onAcknowledge()}
        className="inline-flex items-center justify-center min-h-10 px-3 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 disabled:opacity-60 shadow-sm shadow-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
      >
        {pending ? 'Saving…' : 'Acknowledge'}
      </button>
      {error ? (
        <p className="text-xs text-red-600 mt-1.5" role="alert">
          Couldn&apos;t save acknowledgement. {error}{' '}
          <button
            type="button"
            className="font-bold underline"
            onClick={() => void onAcknowledge()}
          >
            Try again
          </button>
        </p>
      ) : null}
    </div>
  );
}
