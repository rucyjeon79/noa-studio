import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

function trustedPreviewOrigin(origin: string) {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
    if (host === "grok.com" || host.endsWith(".grok.com")) return true;
    if (host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com")) return true;
    if (host.includes(".preview.")) return true;
    return false;
  } catch {
    return false;
  }
}

function sameRequestHost(origin: string, requestUrl: string) {
  try {
    return new URL(origin).host.toLowerCase() === new URL(requestUrl).host.toLowerCase();
  } catch {
    return false;
  }
}

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
  secFetchSite: (site, ctx) => {
    if (site === "same-origin" || site === "same-site" || site === "none") return true;
    if (site !== "cross-site") return false;
    const origin = ctx.request.headers.get("origin") || "";
    if (!origin) return false;
    return sameRequestHost(origin, ctx.request.url) || trustedPreviewOrigin(origin);
  },
  origin: (origin, ctx) => {
    try {
      if (origin === new URL(ctx.request.url).origin) return true;
    } catch {
      /* a preview host can still be the same app */
    }
    return trustedPreviewOrigin(origin);
  },
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}));
