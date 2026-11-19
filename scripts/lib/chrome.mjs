// Headless Chrome over the DevTools protocol, with no driver package: start
// it, connect to its page, send commands and listen for events.
// Needs google-chrome, or CHROME=/path/to/chrome.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { setTimeout as wait } from 'node:timers/promises';

/**
 * Start headless Chrome with a fresh profile and connect to its page.
 * `send(method, params)` resolves with the result and rejects on a protocol
 * error; `on(method, handler)` listens for an event and returns a function
 * that stops listening; `close()` ends Chrome and resolves once its profile is removed.
 */
export const launchChrome = async () => {
  const profile = mkdtempSync(join(tmpdir(), 'evidence-report-mcp-chrome-'));
  const chrome = spawn(
    process.env.CHROME ?? 'google-chrome',
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      // Chrome picks a free port and writes it to DevToolsActivePort
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank'
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );

  let output = '';

  chrome.stderr.on('data', (chunk) => (output = (output + chunk).slice(-2000)));

  const exited = once(chrome, 'exit');
  // Chrome's helper processes can still write to the profile just after it
  // exits, so retry the removal
  const close = async () => {
    chrome.kill();
    await exited;
    rmSync(profile, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100
    });
  };

  try {
    let target;

    // A cold start on a CI runner can take a while
    for (let i = 0; i < 150 && !target; i++) {
      await wait(200);

      if (chrome.exitCode !== null) break;

      try {
        const [port] = readFileSync(
          join(profile, 'DevToolsActivePort'),
          'utf8'
        ).split('\n');
        const list = await (
          await fetch(`http://127.0.0.1:${port}/json`)
        ).json();

        target = list.find((entry) => entry.type === 'page');
      } catch {
        // Chrome isn't listening yet
      }
    }

    if (!target) {
      throw new Error(
        `Chrome did not start${chrome.exitCode === null ? ' in 30 seconds' : `: it exited with ${chrome.exitCode}`}\n${output}`
      );
    }

    const ws = new WebSocket(target.webSocketDebuggerUrl);

    await new Promise((resolve) =>
      ws.addEventListener('open', resolve, { once: true })
    );

    let id = 0;

    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const mine = ++id;
        const onMessage = (event) => {
          const message = JSON.parse(event.data);

          if (message.id !== mine) return;

          ws.removeEventListener('message', onMessage);

          if (message.error) {
            reject(new Error(`${method}: ${message.error.message}`));
          } else {
            resolve(message.result);
          }
        };

        ws.addEventListener('message', onMessage);
        ws.send(JSON.stringify({ id: mine, method, params }));
      });
    const on = (method, handler) => {
      const onMessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.method === method) handler(message.params);
      };

      ws.addEventListener('message', onMessage);

      return () => ws.removeEventListener('message', onMessage);
    };

    return {
      send,
      on,
      close: () => {
        ws.close();

        return close();
      }
    };
  } catch (error) {
    await close();
    throw error;
  }
};
