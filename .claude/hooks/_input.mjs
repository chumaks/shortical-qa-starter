// Shared helpers for Claude Code hooks: read the JSON event from stdin, block
// with a reason (exit 2: the call is cancelled and the reason goes to the agent).
export async function readEvent() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

export function block(reason) {
  process.stderr.write(`${reason}\n`);
  process.exit(2);
}
