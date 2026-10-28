import { Server, WebSocket as MockWebSocket } from 'mock-socket';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ConnectionStatus, createSocketClient, getReconnectDelay, type SocketClientOptions } from './socketClient';

const URL = 'ws://localhost:4321';

type ServerSocket = Parameters<Parameters<Server['on']>[1]>[0];

function setup(overrides: Partial<SocketClientOptions> = {}) {
  const messages: unknown[] = [];
  const statuses: ConnectionStatus[] = [];
  const opens: boolean[] = [];

  const client = createSocketClient({
    url: URL,
    WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    onMessage: (data) => messages.push(data),
    onStatusChange: (status) => statuses.push(status),
    onOpen: ({ isReconnect }) => opens.push(isReconnect),
    random: () => 0.5,
    baseDelayMs: 100,
    maxDelayMs: 1000,
    pingIntervalMs: 1000,
    ...overrides,
  });

  return { client, messages, statuses, opens };
}

describe('getReconnectDelay', () => {
  it('grows exponentially and keeps half of the delay random', () => {
    expect(getReconnectDelay(0, 100, 1000, () => 0)).toBe(50);
    expect(getReconnectDelay(0, 100, 1000, () => 1)).toBe(100);
    expect(getReconnectDelay(3, 100, 1000, () => 1)).toBe(800);
  });

  it('never exceeds the maximum delay', () => {
    expect(getReconnectDelay(20, 100, 1000, () => 1)).toBe(1000);
  });
});

describe('createSocketClient', () => {
  let server: Server;

  beforeEach(() => {
    vi.useFakeTimers();
    server = new Server(URL);
  });

  afterEach(() => {
    server.stop();
    vi.useRealTimers();
  });

  it('parses messages and skips invalid JSON', async () => {
    server.on('connection', (socket) => {
      socket.send('not json');
      socket.send(JSON.stringify({ type: 'vm.updated', seq: 1 }));
    });

    const { client, messages, opens } = setup();
    client.connect();
    await vi.advanceTimersByTimeAsync(50);

    expect(opens).toEqual([false]);
    expect(messages).toEqual([{ type: 'vm.updated', seq: 1 }]);
    client.close();
  });

  it('sends a ping on every interval while the connection is open', async () => {
    const received: string[] = [];
    server.on('connection', (socket) => {
      socket.on('message', (data) => received.push(String(data)));
    });

    const { client } = setup();
    client.connect();
    await vi.advanceTimersByTimeAsync(2050);

    expect(received).toEqual(['{"type":"ping"}', '{"type":"ping"}']);
    client.close();
  });

  it('reconnects after the backoff delay when the server drops the connection', async () => {
    let connections = 0;
    let serverSocket: ServerSocket | undefined;
    server.on('connection', (socket) => {
      connections += 1;
      serverSocket = socket;
    });

    const { client, statuses, opens } = setup();
    client.connect();
    await vi.advanceTimersByTimeAsync(50);

    serverSocket?.close();
    await vi.advanceTimersByTimeAsync(10);
    expect(statuses.at(-1)).toBe('reconnecting');

    await vi.advanceTimersByTimeAsync(50);
    expect(connections).toBe(1);

    await vi.advanceTimersByTimeAsync(50);
    expect(connections).toBe(2);
    expect(opens).toEqual([false, true]);
    expect(statuses.at(-1)).toBe('open');
    client.close();
  });

  it('keeps retrying while the server is down and recovers when it is back', async () => {
    server.stop();

    const { client, opens } = setup();
    client.connect();
    await vi.advanceTimersByTimeAsync(2000);
    expect(opens).toEqual([]);

    server = new Server(URL);
    await vi.advanceTimersByTimeAsync(2000);

    expect(opens).toEqual([false]);
    client.close();
  });

  it('does not reconnect after close()', async () => {
    let connections = 0;
    server.on('connection', () => {
      connections += 1;
    });

    const { client, statuses } = setup();
    client.connect();
    await vi.advanceTimersByTimeAsync(50);

    client.close();
    await vi.advanceTimersByTimeAsync(5000);

    expect(connections).toBe(1);
    expect(statuses.at(-1)).toBe('closed');
  });
});
