import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { test } from 'node:test';

test('bin: answers initialize over stdio with the name and version from package.json', async () => {
  const pkg = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8')
  ) as { name: string; version: string };
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', new URL('../cli.ts', import.meta.url).pathname],
    { stdio: ['pipe', 'pipe', 'inherit'], timeout: 10_000 }
  );
  const lines = createInterface({ input: child.stdout });

  child.stdin.write(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'test', version: '0.0.0' }
      }
    }) + '\n'
  );

  const [line] = (await once(lines, 'line')) as [string];
  const response = JSON.parse(line) as {
    id: number;
    result: { serverInfo: { name: string; version: string } };
  };

  assert.equal(response.id, 1);
  assert.deepEqual(response.result.serverInfo, {
    name: pkg.name,
    version: pkg.version
  });

  // Closing stdin ends the session; the process must exit cleanly
  child.stdin.end();

  const [code] = (await once(child, 'exit')) as [number | null];

  assert.equal(code, 0);
});
