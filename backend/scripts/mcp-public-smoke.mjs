/**
 * Public MCP edge smoke test — the runnable oracle for T1 and T3.
 *
 * Drives a real MCP client through initialize + tools/list against the public
 * edge, so it proves the route is reachable end to end rather than that the
 * code compiles. Run it from backend/ (it resolves the MCP SDK from
 * backend/node_modules).
 *
 *   MCP_URL=https://<staging-host>/api/mcp MCP_JWT=<session jwt> \
 *     node scripts/mcp-public-smoke.mjs
 *
 * Get MCP_JWT from the `session` cookie of POST /api/auth/login. The route
 * answers 404 unless MCP_PUBLIC_V1 resolves to exactly 'true'.
 *
 * T3 will add the assertion this script deliberately does not make yet: that
 * the tool list contains only email tools. Today it prints the list so the
 * caller can see what a token actually reaches.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = new URL(process.env.MCP_URL);
const transport = new StreamableHTTPClientTransport(url, {
  requestInit: { headers: { authorization: `Bearer ${process.env.MCP_JWT}` } },
});
const client = new Client({ name: 't1-verify', version: '1.0.0' }, { capabilities: {} });
await client.connect(transport);
console.log('initialize OK; server =', JSON.stringify(client.getServerVersion()));
console.log('sessionId =', transport.sessionId);
const tools = await client.listTools();
console.log('tools/list returned', tools.tools.length, 'tools:');
for (const t of tools.tools) console.log('  -', t.name);
await client.close();
