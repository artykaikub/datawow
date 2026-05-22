# ─── Build stage ───
FROM node:20-alpine AS builder
RUN npm install -g pnpm@9
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Build-time env
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

ARG NEXT_PUBLIC_AUDIT_API_URL=http://localhost:4001
ENV NEXT_PUBLIC_AUDIT_API_URL=${NEXT_PUBLIC_AUDIT_API_URL}

RUN pnpm build

# ─── Production stage ───
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs
USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
