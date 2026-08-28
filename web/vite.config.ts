import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";

import { parseChangelog } from "./src/lib/release";

const webDir = dirname(fileURLToPath(import.meta.url));
const localVersion = readFileSync(resolve(webDir, "../VERSION"), "utf8").trim() || "dev";
const localChangelog = readFileSync(resolve(webDir, "../CHANGELOG.md"), "utf8");

// Expose /plugins/index.json with local plugin files from public/plugins.
// The frontend can discover and list them when enabled; development reads the directory live, while builds emit a static registry.
function localPluginsManifest(): Plugin {
    const pluginsDir = resolve(webDir, "public/plugins");
    const listLocalPlugins = () => {
        try {
            return readdirSync(pluginsDir)
                .filter((file) => file.endsWith(".js"))
                .sort()
                .map((file) => `/plugins/${file}`);
        } catch {
            return [];
        }
    };
    return {
        name: "local-plugins-manifest",
        configureServer(server) {
            server.middlewares.use("/plugins/index.json", (_req, res) => {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(listLocalPlugins()));
            });
        },
        generateBundle() {
            this.emitFile({ type: "asset", fileName: "plugins/index.json", source: JSON.stringify(listLocalPlugins()) });
        },
    };
}

function apiProxy(): Plugin {
    const middleware: Connect.NextHandleFunction = async (req, res) => {
        try {
            const target = new URL(new URL(req.url || "/", "http://localhost").searchParams.get("url") || "");
            if (!/^https?:$/.test(target.protocol)) throw new Error("Invalid AI API URL");
            const chunks: Buffer[] = [];
            let size = 0;
            for await (const chunk of req) {
                const buffer = Buffer.from(chunk);
                size += buffer.length;
                if (size > 64 * 1024 * 1024) throw new Error("Request body is too large");
                chunks.push(buffer);
            }
            const headers = new Headers();
            for (const [name, value] of Object.entries(req.headers)) {
                if (value && !["host", "origin", "referer", "cookie", "content-length", "connection"].includes(name)) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
            }
            const upstream = await fetch(target, {
                method: req.method,
                headers,
                body: chunks.length ? Buffer.concat(chunks) : undefined,
                redirect: "error",
                signal: AbortSignal.timeout(10 * 60_000),
            });
            res.statusCode = upstream.status;
            upstream.headers.forEach((value, name) => {
                if (!["content-encoding", "content-length", "transfer-encoding", "connection"].includes(name)) res.setHeader(name, value);
            });
            if (!upstream.body) {
                res.end();
                return;
            }
            const reader = upstream.body.getReader();
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(Buffer.from(value));
            }
            res.end();
        } catch (error) {
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: { message: error instanceof Error ? error.message : "Failed to fetch models" } }));
        }
    };
    return {
        name: "ai-api-proxy",
        configureServer(server) {
            server.middlewares.use("/__api/proxy", middleware);
        },
        configurePreviewServer(server) {
            server.middlewares.use("/__api/proxy", middleware);
        },
    };
}

function precompressAssets(): Plugin {
    return {
        name: "precompress-assets",
        generateBundle(_, bundle) {
            for (const output of Object.values(bundle)) {
                if (!/\.(?:css|js|json|svg)$/.test(output.fileName)) continue;
                const source = Buffer.from(output.type === "chunk" ? output.code : output.source);
                if (source.byteLength < 1024) continue;
                const compressed = [
                    ["br", brotliCompressSync(source, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } })],
                    ["gz", gzipSync(source, { level: 9 })],
                ] as const;
                for (const [extension, content] of compressed) {
                    if (content.byteLength < source.byteLength) this.emitFile({ type: "asset", fileName: `${output.fileName}.${extension}`, source: content });
                }
            }
        },
    };
}

export default defineConfig({
    base: process.env.VITE_BASE || "/",
    plugins: [react(), localPluginsManifest(), apiProxy(), precompressAssets()],
    resolve: {
        alias: {
            "@": resolve(webDir, "src"),
        },
    },
    define: {
        __APP_VERSION__: JSON.stringify(localVersion),
        __APP_RELEASES__: JSON.stringify(parseChangelog(localChangelog)),
    },
});
