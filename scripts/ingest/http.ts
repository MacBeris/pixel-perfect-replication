import type { HttpClient } from "./types.ts";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class SafeHttpClient implements HttpClient {
  private nextRequestAt = 0;
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(
    private readonly options = { timeoutMs: 20_000, retries: 4, concurrency: 3, minDelayMs: 150 },
  ) {}

  private async acquire() {
    if (this.active >= this.options.concurrency) await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.active += 1;
    const delay = Math.max(0, this.nextRequestAt - Date.now());
    if (delay) await sleep(delay);
    this.nextRequestAt = Date.now() + this.options.minDelayMs;
  }

  private release() {
    this.active -= 1;
    this.waiters.shift()?.();
  }

  async json<T>(url: string, init: RequestInit = {}): Promise<T> {
    await this.acquire();
    try {
      for (let attempt = 0; ; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
        try {
          const response = await fetch(url, {
            ...init,
            signal: controller.signal,
            headers: {
              Accept: "application/json",
              "User-Agent": "ExtendShareImporter/0.1 (+https://pixel-perfect-replication.praktykimaciej.workers.dev)",
              ...init.headers,
            },
          });
          if (response.ok) return await response.json() as T;
          const retryable = response.status === 429 || response.status >= 500;
          if (!retryable || attempt >= this.options.retries) throw new Error(`HTTP ${response.status} for ${new URL(url).origin}`);
          const retryAfter = Number(response.headers.get("retry-after"));
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt + Math.random() * 250);
        } catch (error) {
          if (attempt >= this.options.retries || (error instanceof Error && error.message.startsWith("HTTP 4"))) throw error;
          await sleep(500 * 2 ** attempt + Math.random() * 250);
        } finally {
          clearTimeout(timeout);
        }
      }
    } finally {
      this.release();
    }
  }

  async text(url: string, init: RequestInit = {}): Promise<string> {
    await this.acquire();
    try {
      for (let attempt = 0; ; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
        try {
          const response = await fetch(url, {
            ...init,
            signal: controller.signal,
            headers: {
              Accept: "text/html,application/xhtml+xml",
              "User-Agent": "ExtendShareImporter/0.1 (+https://pixel-perfect-replication.praktykimaciej.workers.dev)",
              ...init.headers,
            },
          });
          if (response.ok) return await response.text();
          const retryable = response.status === 429 || response.status >= 500;
          if (!retryable || attempt >= this.options.retries) throw new Error(`HTTP ${response.status} for ${new URL(url).origin}`);
          const retryAfter = Number(response.headers.get("retry-after"));
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt + Math.random() * 250);
        } catch (error) {
          if (attempt >= this.options.retries || (error instanceof Error && error.message.startsWith("HTTP 4"))) throw error;
          await sleep(500 * 2 ** attempt + Math.random() * 250);
        } finally {
          clearTimeout(timeout);
        }
      }
    } finally {
      this.release();
    }
  }
}
