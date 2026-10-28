import http from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';

import { WebSocket, WebSocketServer } from 'ws';

import { createInventory } from './inventory.js';
import { createRandom } from './random.js';
import { createSimulation } from './simulation.js';

const PORT = Number(process.env.API_PORT ?? 4000);
const VM_COUNT = Number(process.env.VM_COUNT ?? 10_000);
const EVENTS_PER_SECOND = Number(process.env.EVENTS_PER_SECOND ?? 500);
const SNAPSHOT_DELAY_MS = Number(process.env.SNAPSHOT_DELAY_MS ?? 300);
const TICK_MS = 100;
const TASK_STEP_MS = 500;
const MAX_VMS_PER_ACTION = 1000;
const ACTIONS = new Set(['start', 'stop', 'reboot']);

const random = createRandom(42);
const vms = createInventory(VM_COUNT, random);
const wss = new WebSocketServer({ noServer: true });
let seq = 0;

function emit(event) {
  const message = JSON.stringify({ ...event, seq: ++seq });

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  }
}

const simulation = createSimulation({ vms, random, emit });

setInterval(() => simulation.tick(Math.round((EVENTS_PER_SECOND * TICK_MS) / 1000)), TICK_MS);
setInterval(() => simulation.stepTasks(), TASK_STEP_MS);

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  try {
    return JSON.parse(Buffer.concat(chunks).toString() || '{}');
  } catch {
    return null;
  }
}

async function handleRequest(req, res) {
  const { pathname } = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && pathname === '/api/vms') {
    const snapshot = { items: [...vms.values()], seq };
    await sleep(SNAPSHOT_DELAY_MS);
    return sendJson(res, 200, snapshot);
  }

  if (req.method === 'GET' && pathname === '/api/tasks') {
    return sendJson(res, 200, { items: simulation.listTasks(), seq });
  }

  if (req.method === 'POST' && pathname === '/api/actions') {
    const body = await readJson(req);
    const valid = body && ACTIONS.has(body.action) && Array.isArray(body.vmIds) && body.vmIds.length > 0;

    if (!valid) {
      return sendJson(res, 400, { error: 'Expected { "action": "start" | "stop" | "reboot", "vmIds": string[] }' });
    }
    if (body.vmIds.length > MAX_VMS_PER_ACTION) {
      return sendJson(res, 400, { error: `At most ${MAX_VMS_PER_ACTION} VMs per action` });
    }

    return sendJson(res, 202, simulation.startTasks(body.vmIds, body.action));
  }

  if (req.method === 'POST' && pathname === '/api/debug/drop-connections') {
    const dropped = wss.clients.size;
    for (const client of wss.clients) client.terminate();
    return sendJson(res, 200, { dropped });
  }

  return sendJson(res, 404, { error: 'Not found' });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error(error);
    sendJson(res, 500, { error: 'Internal server error' });
  });
});

server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url, 'http://localhost').pathname !== '/ws') {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (message.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
  });
});

server.listen(PORT, () => {
  console.log(`Mock API on http://localhost:${PORT}: ${VM_COUNT} VMs, ~${EVENTS_PER_SECOND} events/s`);
});
