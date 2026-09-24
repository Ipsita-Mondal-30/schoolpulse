/**
 * Video byte storage: local disk (dev/worker) + optional Neon mirror for Vercel.
 * Object storage (Blob/R2) can replace this later — keep the same key interface.
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export interface VideoStorage {
  /** Persist bytes; returns a stable relative key (not a provider URL). */
  save(key: string, bytes: Buffer): Promise<{ key: string; absolutePath: string }>;
  resolveAbsolutePath(key: string): string;
  exists(key: string): boolean;
  read(key: string): Buffer | null;
}

const ROOT = join(process.cwd(), 'data', 'generated-videos');

export class LocalVideoStorage implements VideoStorage {
  constructor(private readonly rootDir: string = ROOT) {}

  save(key: string, bytes: Buffer): Promise<{ key: string; absolutePath: string }> {
    return Promise.resolve().then(() => {
      const safe = key.replace(/[^a-zA-Z0-9._/-]/g, '_').replace(/\.\./g, '');
      const absolutePath = resolve(this.rootDir, safe);
      if (!absolutePath.startsWith(resolve(this.rootDir))) {
        throw new Error('Invalid video storage key');
      }
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, bytes);
      return { key: safe, absolutePath };
    });
  }

  resolveAbsolutePath(key: string): string {
    const safe = key.replace(/[^a-zA-Z0-9._/-]/g, '_').replace(/\.\./g, '');
    const absolutePath = resolve(this.rootDir, safe);
    if (!absolutePath.startsWith(resolve(this.rootDir))) {
      throw new Error('Invalid video storage key');
    }
    return absolutePath;
  }

  exists(key: string): boolean {
    try {
      return existsSync(this.resolveAbsolutePath(key));
    } catch {
      return false;
    }
  }

  read(key: string): Buffer | null {
    try {
      const p = this.resolveAbsolutePath(key);
      if (!existsSync(p)) return null;
      return readFileSync(p);
    } catch {
      return null;
    }
  }
}

let singleton: VideoStorage | null = null;

export function getVideoStorage(): VideoStorage {
  if (!singleton) singleton = new LocalVideoStorage();
  return singleton;
}

/** Test helper */
export function setVideoStorageForTests(storage: VideoStorage | null): void {
  singleton = storage;
}

export function homeworkVideoStorageKey(homeworkDbId: string): string {
  return `homework/${homeworkDbId}.mp4`;
}
