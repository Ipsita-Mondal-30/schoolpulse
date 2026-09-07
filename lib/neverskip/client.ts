import type { NeverSkipAuth } from './auth';
import { EnvTokenAuth } from './auth';
import { nsError } from './log';
import {
  NeverSkipAuthError,
  NeverSkipHttpError,
  NeverSkipTimeoutError,
} from './types';

export const DEFAULT_NEVERSKIP_BASE_URL = 'https://nskapi.neverskip.com';
export const DEFAULT_TIMEOUT_MS = 20_000;

export interface NeverSkipClientOptions {
  baseUrl?: string;
  auth?: NeverSkipAuth;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export class NeverSkipClient {
  readonly baseUrl: string;
  private readonly auth: NeverSkipAuth;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: NeverSkipClientOptions = {}) {
    this.baseUrl = (options.baseUrl || process.env.NEVERSKIP_BASE_URL || DEFAULT_NEVERSKIP_BASE_URL).replace(
      /\/$/,
      '',
    );
    this.auth = options.auth ?? new EnvTokenAuth();
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options.fetchFn ?? fetch.bind(globalThis);
  }

  async postJson<T>(path: string, body: unknown): Promise<T> {
    let authHeaders: Record<string, string>;
    try {
      authHeaders = await this.auth.getHeaders();
    } catch (err) {
      if (err instanceof NeverSkipAuthError) throw err;
      throw new NeverSkipAuthError('Failed to resolve NeverSkip auth headers');
    }

    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        nsError(`NeverSkip HTTP ${response.status} for ${path}`);
        throw new NeverSkipHttpError(`NeverSkip request failed with status ${response.status}`, response.status);
      }

      const text = await response.text();
      if (!text.trim()) {
        return {} as T;
      }
      try {
        return JSON.parse(text) as T;
      } catch {
        nsError(`NeverSkip returned non-JSON body for ${path}`);
        throw new NeverSkipHttpError('NeverSkip returned malformed JSON', 502);
      }
    } catch (err) {
      if (err instanceof NeverSkipHttpError || err instanceof NeverSkipAuthError) throw err;
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
        nsError(`NeverSkip timeout for ${path}`);
        throw new NeverSkipTimeoutError();
      }
      nsError(`NeverSkip network error for ${path}: ${err instanceof Error ? err.message : 'unknown'}`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
