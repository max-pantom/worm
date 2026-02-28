/**
 * Wormkey CLI - Tunnel client
 * Connects to Edge via WebSocket, forwards HTTP/WS to localhost
 */

import WebSocket from "ws";
import { request } from "undici";
import {
  FrameType,
  createFrame,
  readStreamId,
  parseOpenStream,
  serializeResponseHeaders,
} from "./protocol.js";

const CONTROL_STREAM_ID = 0;

export interface TunnelConfig {
  localPort: number;
  edgeUrl: string;
  sessionToken: string;
  publicUrl: string;
  onStatus?: (msg: string) => void;
}

export class TunnelClient {
  private ws: WebSocket | null = null;
  private config: TunnelConfig;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingStreams = new Map<number, { openPayload: Buffer; bodyChunks: Buffer[] }>();

  constructor(config: TunnelConfig) {
    this.config = config;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = this.config.edgeUrl.replace(/^http/, "ws");
      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${this.config.sessionToken}`,
        },
      });

      this.ws.on("open", () => {
        this.config.onStatus?.("Tunnel connected.");
        this.startPing();
        resolve();
      });

      this.ws.on("message", (data: Buffer) => this.handleFrame(data));
      this.ws.on("close", () => this.handleClose());
      this.ws.on("error", (err: Error) => {
        this.config.onStatus?.(`Tunnel error: ${err.message}`);
        reject(err);
      });
    });
  }

  private handleFrame(data: Buffer) {
    if (data.length < 5) return;
    const type = data[0];
    const streamId = readStreamId(data);
    const payload = data.length > 5 ? data.subarray(5) : undefined;

    if (type === FrameType.PING) {
      this.send(FrameType.PONG, CONTROL_STREAM_ID);
      return;
    }

    if (type === FrameType.PONG) {
      return;
    }

    if (type === FrameType.OPEN_STREAM && payload) {
      this.pendingStreams.set(streamId, { openPayload: payload, bodyChunks: [] });
      return;
    }

    if (type === FrameType.STREAM_DATA && payload) {
      const pending = this.pendingStreams.get(streamId);
      if (pending) pending.bodyChunks.push(payload);
      return;
    }

    if (type === FrameType.STREAM_END) {
      const pending = this.pendingStreams.get(streamId);
      this.pendingStreams.delete(streamId);
      if (pending) {
        this.handleOpenStream(streamId, pending.openPayload, pending.bodyChunks);
      }
      return;
    }

    if (type === FrameType.STREAM_CANCEL) {
      this.pendingStreams.delete(streamId);
      return;
    }
  }

  private async handleOpenStream(streamId: number, openStreamPayload: Buffer, bodyChunks: Buffer[]) {
    const { method, path, headers } = parseOpenStream(openStreamPayload);
    const body = bodyChunks.length > 0 ? Buffer.concat(bodyChunks) : undefined;

    const localUrl = `http://127.0.0.1:${this.config.localPort}${path}`;

    try {
      const { statusCode, headers: resHeaders, body: resBody } = await request(localUrl, {
        method: method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS",
        headers: headers as Record<string, string>,
        body,
      });

      const resHeadersObj: Record<string, string> = {};
      for (const [k, v] of Object.entries(resHeaders)) {
        if (typeof v === "string") resHeadersObj[k] = v;
        else if (Array.isArray(v)) resHeadersObj[k] = v.join(", ");
      }
      this.send(FrameType.RESPONSE_HEADERS, streamId, serializeResponseHeaders(statusCode, resHeadersObj));

      const chunks: Buffer[] = [];
      for await (const chunk of resBody) {
        chunks.push(Buffer.from(chunk));
      }
      const responseBody = Buffer.concat(chunks);
      if (responseBody.length > 0) {
        this.send(FrameType.STREAM_DATA, streamId, responseBody);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.send(FrameType.RESPONSE_HEADERS, streamId, serializeResponseHeaders(502, { "content-type": "text/plain" }));
      this.send(FrameType.STREAM_DATA, streamId, Buffer.from(`Bad Gateway: ${msg}`, "utf-8"));
    }
    this.send(FrameType.STREAM_END, streamId);
  }

  private send(type: number, streamId: number, payload?: Buffer) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(createFrame(type, streamId, payload));
    }
  }

  private startPing() {
    this.pingTimer = setInterval(() => {
      this.send(FrameType.PING, CONTROL_STREAM_ID);
    }, 30000);
  }

  private handleClose() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.config.onStatus?.("Tunnel disconnected. Reconnecting in 2s...");
    this.reconnectTimer = setTimeout(() => this.connect(), 2000);
  }

  close() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
