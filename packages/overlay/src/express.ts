export interface ExpressOverlayOptions {
  scriptUrl: string;
}

interface ReqLike {
  [k: string]: unknown;
}

interface ResLike {
  send: (body: unknown) => unknown;
  getHeader: (name: string) => unknown;
}

type NextLike = () => void;

export function wormkeyOverlayMiddleware(options: ExpressOverlayOptions) {
  return function overlay(_req: ReqLike, res: ResLike, next: NextLike) {
    const send = res.send.bind(res);
    res.send = ((body: unknown) => {
      const contentType = String(res.getHeader("content-type") ?? "");
      if (
        typeof body === "string" &&
        contentType.includes("text/html") &&
        !body.includes("data-wormkey-overlay=\"1\"")
      ) {
        const tag = `<script defer data-wormkey-overlay=\"1\" src=\"${options.scriptUrl}\"></script>`;
        body = body.includes("</head>") ? body.replace("</head>", `${tag}</head>`) : `${tag}${body}`;
      }
      return send(body as never);
    }) as typeof res.send;
    next();
  };
}
