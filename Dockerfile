# Stage 1: Install dependencies and build the Vite frontend
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json ./
COPY src/ src/

ARG GEMINI_API_KEY=""
RUN GEMINI_API_KEY=${GEMINI_API_KEY} npx vite build

# Stage 2: Production runtime
FROM node:22-slim AS runtime

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY server.ts ingest.ts ./

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "node --experimental-strip-types ingest.ts; node --experimental-strip-types server.ts"]
