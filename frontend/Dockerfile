# Local dev/test image (docker compose). Not used for Vercel deploys.
FROM node:24-slim

RUN npm install -g pnpm@11.17.0

WORKDIR /app

# Lockfile first (layer cache); install scripts stay denied via pnpm-workspace.yaml.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000
CMD ["pnpm", "dev", "-H", "0.0.0.0"]
