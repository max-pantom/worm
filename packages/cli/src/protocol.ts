/**
 * Wormkey Tunnel Protocol (v0)
 * Binary frame types for WebSocket transport
 */

export const FrameType = {
  OPEN_STREAM: 0x01,
  STREAM_DATA: 0x02,
  STREAM_END: 0x03,
  STREAM_CANCEL: 0x04,
  RESPONSE_HEADERS: 0x05,
  WS_UPGRADE: 0x06,
  WS_DATA: 0x07,
  WS_CLOSE: 0x08,
  PING: 0x09,
  PONG: 0x0a,
} as const;

export type FrameTypeId = (typeof FrameType)[keyof typeof FrameType];

export function readStreamId(buffer: Buffer): number {
  return buffer.readUInt32BE(1);
}

export function createFrame(type: FrameTypeId | number, streamId: number, payload?: Buffer): Buffer {
  const payloadLen = payload?.length ?? 0;
  const frame = Buffer.allocUnsafe(5 + payloadLen);
  frame[0] = type;
  frame.writeUInt32BE(streamId, 1);
  if (payload && payloadLen > 0) {
    payload.copy(frame, 5);
  }
  return frame;
}

export function parseOpenStream(payload: Buffer): { method: string; path: string; headers: Record<string, string> } {
  const str = payload.toString("utf-8");
  const [firstLine, ...headerLines] = str.split("\r\n");
  const [method, path] = firstLine.split(" ");
  const headers: Record<string, string> = {};
  for (const line of headerLines) {
    const colon = line.indexOf(":");
    if (colon > 0) {
      headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
    }
  }
  return { method, path: path ?? "/", headers };
}

export function serializeOpenStream(method: string, path: string, headers: Record<string, string>): Buffer {
  const lines = [`${method} ${path} HTTP/1.1`, ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`), "", ""];
  return Buffer.from(lines.join("\r\n"), "utf-8");
}

export function parseResponseHeaders(payload: Buffer): { statusCode: number; headers: Record<string, string> } {
  const str = payload.toString("utf-8");
  const [firstLine, ...headerLines] = str.split("\r\n");
  const statusCode = parseInt(firstLine.split(" ")[1] ?? "200", 10);
  const headers: Record<string, string> = {};
  for (const line of headerLines) {
    const colon = line.indexOf(":");
    if (colon > 0) {
      headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
    }
  }
  return { statusCode, headers };
}

export function serializeResponseHeaders(statusCode: number, headers: Record<string, string>): Buffer {
  const lines = [`HTTP/1.1 ${statusCode}`, ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`), "", ""];
  return Buffer.from(lines.join("\r\n"), "utf-8");
}
