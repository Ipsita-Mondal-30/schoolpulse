import type { NeverSkipClient } from './client';
import { extractNotices } from './normalizers';
import type { NeverSkipNoticesResponse, NeverSkipRawNotice } from './types';

export const NOTICES_PATH = '/parentweb/connect/fetchdailynoticeinfo';

export async function fetchDailyNotices(client: NeverSkipClient): Promise<NeverSkipRawNotice[]> {
  const response = await client.postJson<NeverSkipNoticesResponse>(NOTICES_PATH, {});
  return extractNotices(response);
}
