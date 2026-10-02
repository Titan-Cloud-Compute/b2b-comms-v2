FROM node:20-slim AS builder
WORKDIR /app
# Dummy URL satisfies prisma generate at build time — no real DB needed
ENV DATABASE_URL="postgresql://x:x@localhost/x"
# argon2 + native deps need build toolchain
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npx prisma generate
RUN npm run build \
    && test -n "$(find /app/dist -name main.js | head -1)" \
    || (echo 'ERROR: dist/main.js missing after build — check tsconfig.build.json rootDir: src' && exit 1)

FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
# .prisma contains the query engine binary; @prisma/client contains the
# generated TypeScript/JS client code. Both must come from the builder stage —
# npm ci only installs the base @prisma/client package (no generated files).
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
EXPOSE 3000
# prisma migrate deploy runs pending migrations before the app starts.
# If a migration fails the container exits non-zero and K8s will not serve traffic.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
