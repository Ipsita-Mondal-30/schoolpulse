const PREFIX = '[SchoolPulse]';

/** Safe logger — never pass tokens, cookies, passwords, or auth headers. */
export function nsLog(message: string, ...args: unknown[]): void {
  console.log(`${PREFIX} ${message}`, ...args);
}

export function nsWarn(message: string, ...args: unknown[]): void {
  console.warn(`${PREFIX} ${message}`, ...args);
}

export function nsError(message: string, ...args: unknown[]): void {
  console.error(`${PREFIX} ${message}`, ...args);
}

/** When true, print safe API envelope diagnostics (no secrets). Default: on if NEVERSKIP_DEBUG unset or "1". */
export function isNeverSkipDebugEnabled(): boolean {
  const v = process.env.NEVERSKIP_DEBUG;
  if (v === undefined || v === '') return true; // temporary default on for diagnosis
  return v === '1' || v.toLowerCase() === 'true';
}

/**
 * Safe structural debug for NeverSkip JSON envelopes.
 * Never logs tokens, cookies, headers, or field values — only keys and counts.
 */
export function nsDebugApiEnvelope(
  label: string,
  info: {
    url?: string;
    status?: number;
    body: unknown;
  },
): void {
  if (!isNeverSkipDebugEnabled()) return;

  const body = info.body;
  const topLevelKeys =
    body && typeof body === 'object' && !Array.isArray(body)
      ? Object.keys(body as object).join(',')
      : Array.isArray(body)
        ? '(array)'
        : typeof body;

  let DKeys = '';
  let itemListLength = -1;
  let firstItemKeys = '';

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const root = body as Record<string, unknown>;
    const D = root.D;
    if (D && typeof D === 'object' && !Array.isArray(D)) {
      DKeys = Object.keys(D as object).join(',');
      const list = (D as { item_list?: unknown }).item_list;
      if (Array.isArray(list)) {
        itemListLength = list.length;
        const first = list[0];
        if (first && typeof first === 'object' && !Array.isArray(first)) {
          firstItemKeys = Object.keys(first as object).join(',');
        }
      } else if (typeof list === 'string') {
        itemListLength = -2; // stringified
        DKeys = `${DKeys}|item_list:string`;
      } else if (list === undefined) {
        itemListLength = -1;
      } else {
        itemListLength = -3;
      }
    } else if (Array.isArray(D)) {
      DKeys = '(array)';
      itemListLength = D.length;
    } else if (D == null) {
      DKeys = String(D);
    }
  }

  nsLog(`${label} response debug:`);
  if (info.url) nsLog(`url=${info.url.replace(/([?&])(Token|token|authorization)=[^&]*/gi, '$1$2=REDACTED')}`);
  if (info.status != null) nsLog(`status=${info.status}`);
  nsLog(`topLevelKeys=${topLevelKeys}`);
  nsLog(`DKeys=${DKeys || '(none)'}`);
  nsLog(`itemListLength=${itemListLength}`);
  if (firstItemKeys) nsLog(`firstItemKeys=${firstItemKeys}`);

  // Safe pagination numbers (NeverSkip homework D fields)
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const root = body as Record<string, unknown>;
    const D =
      root.D && typeof root.D === 'object' && !Array.isArray(root.D)
        ? (root.D as Record<string, unknown>)
        : null;
    if (D) {
      for (const key of ['page_count', 'total_count', 'sfile_limit'] as const) {
        const v = D[key];
        if (typeof v === 'number' || typeof v === 'string') {
          nsLog(`${key}=${v}`);
        }
      }
    }
  }
}
