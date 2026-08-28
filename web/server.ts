import { resolve } from "node:path";

const root = resolve(import.meta.dir, "dist");
const port = Number(process.env.PORT || 3000);

const jsonError = (message: string, status = 502) => Response.json({ error: { message } }, { status });

async function proxyApi(request: Request, targetValue: string | null) {
    try {
        if (Number(request.headers.get("content-length") || 0) > 64 * 1024 * 1024) return jsonError("Request body is too large", 413);
        const target = new URL(targetValue || "");
        if (!/^https?:$/.test(target.protocol)) return jsonError("Invalid AI API URL", 400);
        const headers = new Headers(request.headers);
        ["host", "origin", "referer", "cookie", "content-length", "connection"].forEach((name) => headers.delete(name));
        const upstream = await fetch(target, {
            method: request.method,
            headers,
            body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
            redirect: "error",
            signal: AbortSignal.timeout(10 * 60_000),
        });
        const responseHeaders = new Headers(upstream.headers);
        ["content-encoding", "content-length", "transfer-encoding", "connection"].forEach((name) => responseHeaders.delete(name));
        return new Response(upstream.body, {
            status: upstream.status,
            headers: responseHeaders,
        });
    } catch (error) {
        return jsonError(error instanceof Error ? error.message : "Failed to fetch models");
    }
}

function runtimeConfig() {
    const sanitize = (value = "") => value.replace(/[^A-Za-z0-9-]/g, "");
    return new Response(
        `window.__RUNTIME_CONFIG__ = ${JSON.stringify({ ANALYTICS_GA4_ID: sanitize(process.env.ANALYTICS_GA4_ID), ANALYTICS_BAIDU_ID: sanitize(process.env.ANALYTICS_BAIDU_ID) })};`,
        { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" } },
    );
}

async function staticFile(request: Request, path: string, immutable = false) {
    const acceptEncoding = request.headers.get("accept-encoding") || "";
    const candidates = acceptEncoding.includes("br") ? [[`${path}.br`, "br"]] : [];
    if (acceptEncoding.includes("gzip")) candidates.push([`${path}.gz`, "gzip"]);
    let selectedPath = path;
    let encoding = "";
    for (const [candidatePath, candidateEncoding] of candidates) {
        if (await Bun.file(candidatePath).exists()) {
            selectedPath = candidatePath;
            encoding = candidateEncoding;
            break;
        }
    }
    const headers = new Headers({
        "Content-Type": Bun.file(path).type || "application/octet-stream",
        "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    });
    if (encoding) {
        headers.set("Content-Encoding", encoding);
        headers.set("Vary", "Accept-Encoding");
    }
    return new Response(request.method === "HEAD" ? null : Bun.file(selectedPath), { headers });
}

Bun.serve({
    port,
    async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/__api/proxy") return proxyApi(request, url.searchParams.get("url"));
        if (url.pathname === "/config.js") return runtimeConfig();
        if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
        const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, "");
        const path = resolve(root, pathname || "index.html");
        if (path.startsWith(`${root}/`)) {
            const file = Bun.file(path);
            if (await file.exists()) return staticFile(request, path, pathname.startsWith("assets/"));
        }
        return staticFile(request, resolve(root, "index.html"));
    },
});

console.log(`Infinite Canvas listening on http://0.0.0.0:${port}`);
