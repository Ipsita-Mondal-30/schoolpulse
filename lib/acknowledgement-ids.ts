/** Parse UI ids like `neverskip:12345` into source + sourceId. */
export function parsePrefixedSourceId(
  raw: string,
): { source: string; sourceId: string } | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  const idx = s.indexOf(':');
  if (idx <= 0) return null;
  const source = s.slice(0, idx);
  const sourceId = s.slice(idx + 1);
  if (!source || !sourceId) return null;
  return { source, sourceId };
}
