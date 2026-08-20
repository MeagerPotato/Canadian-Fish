/**
 * simulate.mjs — launcher for the Gate 3 bot win-rate simulation.
 *
 * `npm run sim` — no dependencies. Node >= 23.6 strips TypeScript types
 * natively (this repo's engine is written in erasable-syntax TS with explicit
 * .ts import specifiers, exactly what the Node loader requires), so the
 * harness imports scripts/simulate-main.ts directly. On an older Node this
 * exits with a clear message instead of a loader stack trace.
 */
const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 23 || (major === 23 && minor < 6)) {
  console.error(
    `node ${process.versions.node} cannot import TypeScript directly; ` +
      'run with Node 23.6+ (this repo develops on Node 24).',
  )
  process.exit(1)
}

const { main } = await import('./simulate-main.ts')
main()
