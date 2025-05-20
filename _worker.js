// Cloudflare Worker VLESS
let userID = '1a19d805-ba19-4e52-b559-4be75af69b94';
let proxyIP = '';

export default {
  async fetch(request, env, ctx) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected websocket', { status: 400 });
    }

    const url = new URL(request.url);
    const ip = proxyIP || url.hostname;

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    handleSession(server, ip);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  },
};

async function handleSession(webSocket, ip) {
  webSocket.accept();

  const socket = await connect({
    hostname: ip,
    port: 443,
    secureTransport: 'starttls',
    alpn: ['h2', 'http/1.1'],
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const header = buildVLESSHeader(userID);
  await socket.write(header);

  socket.readable.pipeTo(webSocket.writable);
  webSocket.readable.pipeTo(socket.writable);
}

function buildVLESSHeader(uuid) {
  const uuidBytes = uuid.replace(/-/g, '').match(/.{1,2}/g).map(b => parseInt(b, 16));
  return new Uint8Array([
    0x01, // Version
    ...uuidBytes,
    0x00, // Option
    0x00, 0x00, // Padding
    0x00, // Command: TCP
    0x02, // Address type: domain
    0x0f, // Address length
    ...new TextEncoder().encode('www.google.com'),
    0x01, 0xbb, // Port: 443
  ]);
}
