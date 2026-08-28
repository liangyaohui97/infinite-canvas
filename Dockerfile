# 构建 Vite 前端产物。
FROM oven/bun:1.3.13 AS web-build

WORKDIR /app/web
COPY web/package.json web/bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --cache-dir=/root/.bun/install/cache
COPY VERSION /app/VERSION
COPY CHANGELOG.md /app/CHANGELOG.md
COPY web ./
RUN bun run build

# 运行镜像：提供静态前端，并通过同源代理转发 AI API 请求以绕过上游 CORS 限制。
FROM oven/bun:1.3.13

WORKDIR /app/web
COPY --from=web-build /app/web/dist ./dist
COPY web/server.ts ./server.ts

EXPOSE 3000
CMD ["bun", "run", "server.ts"]
