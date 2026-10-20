// The eXeLearning Yjs WebSocket relay does not decode message contents for
// routing (src/websocket/message-parser.ts): any binary frame that isn't a
// JSON asset-coordination message or an 0xFF-prefixed asset frame is
// forwarded as-is to other room members and, when Redis is configured,
// published cross-instance. This lets load tests simulate realistic-sized
// Yjs traffic (CPU, network, Redis fan-out cost) without depending on the
// real `yjs`/`y-protocols` encoding.

export function wsUrl(config, projectUuid, token) {
    return `${config.wsBaseUrl}/yjs/project-${projectUuid}?token=${token}`;
}

// Byte 0 mirrors the real Yjs sync/update message-type range (0-2) for
// readability in packet captures; the relay never inspects it.
export function fakeYjsUpdate(sizeBytes) {
    const size = sizeBytes || 50 + Math.floor(Math.random() * 400);
    const buf = new Uint8Array(size);
    buf[0] = 2;
    for (let i = 1; i < size; i++) {
        buf[i] = Math.floor(Math.random() * 256);
    }
    return buf.buffer;
}
