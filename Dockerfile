# The app's image (SPEC.md section 1, "Deployment"; section 12). Three stages:
# the prototype's build, the server's production dependencies, and the runtime.

# Stage 1: build the prototype, which is its own npm project (not a workspace).
FROM node:26.13.1-slim AS prototype
WORKDIR /prototype
COPY prototype/package.json prototype/package-lock.json ./
RUN npm ci
COPY prototype/ ./
RUN npm run build

# Stage 2: install only what the server needs at run time, from the root lockfile.
# Every workspace's package.json is copied so that `npm ci` can check the lockfile.
FROM node:26.13.1-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/cases/package.json packages/cases/
COPY packages/model/package.json packages/model/
COPY packages/rules/package.json packages/rules/
RUN npm ci --omit=dev --workspace @diagramble/server

# Stage 3: the runtime. Node runs the TypeScript source directly (type stripping).
FROM node:26.13.1-slim
ENV NODE_ENV=production \
    STATIC_DIR=/app/static
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY packages/cases/ packages/cases/
COPY packages/model/ packages/model/
COPY packages/rules/ packages/rules/
COPY apps/server/ apps/server/
COPY --from=prototype /prototype/dist ./static
USER node
EXPOSE 3000
# Slim images have no curl, so the check uses Node.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "apps/server/src/main.ts"]
