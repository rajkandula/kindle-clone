# Lectoire — Next.js standalone server for any container host
FROM node:22-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
# NEXT_PUBLIC_* values are inlined at build time: pass your public URL with
#   docker build --build-arg NEXT_PUBLIC_ORIGIN=https://books.example.com .
ARG NEXT_PUBLIC_ORIGIN
ENV NEXT_PUBLIC_ORIGIN=$NEXT_PUBLIC_ORIGIN
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Standalone output does not include public/ — the PWA icons and service
# worker live there and were 404 in production until this line existed.
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
