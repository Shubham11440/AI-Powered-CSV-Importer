# Base Image
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package configurations
COPY package*.json ./
RUN npm ci

# Copy code and run Next.js build
COPY . .
RUN npm run build

# Runner stage
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

# Copy built files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["npx", "next", "start"]
