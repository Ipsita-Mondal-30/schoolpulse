import { NeverSkipAuthError } from './types';

export interface NeverSkipAuth {
  /** Return headers to attach to NeverSkip API requests. Must not log secrets. */
  getHeaders(): Promise<Record<string, string>>;
}

/** Reads NEVERSKIP_TOKEN from the environment. Does not hardcode secrets. */
export class EnvTokenAuth implements NeverSkipAuth {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async getHeaders(): Promise<Record<string, string>> {
    const token = this.env.NEVERSKIP_TOKEN?.trim();
    if (!token) {
      throw new NeverSkipAuthError(
        'NEVERSKIP_TOKEN is not set. Provide an authorized session token via environment configuration.',
      );
    }
    return { Token: token };
  }
}

/** Auth that always fails — useful when forcing fixture/mock clients in tests. */
export class MissingAuth implements NeverSkipAuth {
  async getHeaders(): Promise<Record<string, string>> {
    throw new NeverSkipAuthError('NeverSkip auth is not configured');
  }
}

/** Inject a token at runtime without reading env (tests / local scripts). */
export class StaticTokenAuth implements NeverSkipAuth {
  constructor(private readonly token: string) {}

  async getHeaders(): Promise<Record<string, string>> {
    if (!this.token.trim()) {
      throw new NeverSkipAuthError('Empty NeverSkip token');
    }
    return { Token: this.token };
  }
}
