/**
 * Packs the edge function bundle for MCP deploy_edge_function:
 * entry (import prefix rewritten ../../../ -> ./) + server/ + lib/engine/,
 * emitted as a JSON array of { name, content } with POSIX paths.
 *
 * Usage: node scripts/pack-edge.mjs [outFile]
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const files = [];

const entry = readFileSync(join(root, 'supabase/functions/api/index.ts'), 'utf8')
  .replaceAll("'../../../server/", "'./server/");
files.push({ name: 'index.ts', content: entry });

for (const dir of ['server', 'lib/engine', 'lib/engine/bots']) {
  for (const f of readdirSync(join(root, dir))) {
    if (!f.endsWith('.ts')) continue;
    files.push({ name: `${dir}/${f}`, content: readFileSync(join(root, dir, f), 'utf8') });
  }
}

const out = process.argv[2];
const json = JSON.stringify(files);
if (out) writeFileSync(out, json);
else process.stdout.write(json);
console.error(
  `packed ${files.length} files, ${(json.length / 1024).toFixed(1)} KB total:\n` +
    files.map((f) => `  ${f.name} (${(f.content.length / 1024).toFixed(1)} KB)`).join('\n'),
);
