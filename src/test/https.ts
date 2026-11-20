import { EventEmitter } from 'node:events';
import https from 'node:https';
import { Readable } from 'node:stream';
import { mock } from 'node:test';

/** A fake response: status 200 and text/html unless given. */
export interface Page {
  status?: number;
  headers?: Record<string, string | undefined>;
  body?: string;
  /** The body in pieces, to test the size limit. */
  chunks?: Buffer[];
}

/**
 * Mocks https.get with pages by URL. A URL not in `pages`, or mapped to an
 * Error, makes the request emit an error; nothing reaches the network.
 */
export const mockHttps = (pages: Record<string, Page | Error>) =>
  mock.method(https, 'get', ((
    url: URL,
    _options: unknown,
    callback: (res: unknown) => void
  ) => {
    const req = new EventEmitter();
    const page =
      pages[url.href] ?? new Error(`unexpected request to ${url.href}`);

    queueMicrotask(() => {
      if (page instanceof Error) return void req.emit('error', page);

      callback(
        Object.assign(
          Readable.from(page.chunks ?? [Buffer.from(page.body ?? '')]),
          {
            statusCode: page.status ?? 200,
            headers: { 'content-type': 'text/html', ...page.headers }
          }
        )
      );
    });

    return req;
  }) as never);
