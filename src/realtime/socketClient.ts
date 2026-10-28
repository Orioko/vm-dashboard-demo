export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface SocketClientOptions {
  url: string;
  onMessage: (data: unknown) => void;
  onOpen?: (info: { isReconnect: boolean }) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  pingIntervalMs?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  random?: () => number;
  WebSocketImpl?: typeof WebSocket;
}

export interface SocketClient {
  connect: () => void;
  close: () => void;
}

const OPEN = 1;

export function getReconnectDelay(attempt: number, baseDelayMs: number, maxDelayMs: number, random: () => number) {
  const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  return Math.round(ceiling / 2 + (random() * ceiling) / 2);
}

export function createSocketClient({
  url,
  onMessage,
  onOpen,
  onStatusChange,
  pingIntervalMs = 30_000,
  baseDelayMs = 500,
  maxDelayMs = 15_000,
  random = Math.random,
  WebSocketImpl = WebSocket,
}: SocketClientOptions): SocketClient {
  let socket: WebSocket | null = null;
  let attempt = 0;
  let hasBeenOpen = false;
  let stopped = true;
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  const detach = (target: WebSocket) => {
    target.onopen = null;
    target.onmessage = null;
    target.onclose = null;
    target.onerror = null;
  };

  const scheduleReconnect = () => {
    onStatusChange?.('reconnecting');
    reconnectTimer = setTimeout(open, getReconnectDelay(attempt++, baseDelayMs, maxDelayMs, random));
  };

  function open() {
    onStatusChange?.(hasBeenOpen ? 'reconnecting' : 'connecting');

    const current = new WebSocketImpl(url);
    socket = current;

    current.onopen = () => {
      const isReconnect = hasBeenOpen;
      hasBeenOpen = true;
      attempt = 0;
      onStatusChange?.('open');

      pingTimer = setInterval(() => {
        if (current.readyState === OPEN) current.send(JSON.stringify({ type: 'ping' }));
      }, pingIntervalMs);

      onOpen?.({ isReconnect });
    };

    current.onmessage = (event: MessageEvent) => {
      let data: unknown;
      try {
        data = JSON.parse(String(event.data));
      } catch {
        return;
      }
      onMessage(data);
    };

    current.onclose = () => {
      detach(current);
      clearInterval(pingTimer);
      socket = null;
      if (!stopped) scheduleReconnect();
    };
  }

  return {
    connect() {
      if (!stopped) return;
      stopped = false;
      open();
    },
    close() {
      stopped = true;
      clearInterval(pingTimer);
      clearTimeout(reconnectTimer);

      if (socket) {
        detach(socket);
        socket.close(1000, 'client closed');
        socket = null;
      }

      onStatusChange?.('closed');
    },
  };
}
