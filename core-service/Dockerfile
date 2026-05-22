# ─── Build stage ───
FROM node:20-alpine AS builder
RUN npm install -g pnpm@9
WORKDIR /app

# Use hoisted node_modules (flat like npm) for Docker compatibility
RUN echo "node-linker=hoisted" > .npmrc

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# ─── Production stage ───
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs
USER nestjs

EXPOSE 4000
CMD ["node", "dist/main"]
