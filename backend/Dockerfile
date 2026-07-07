# Base Image
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package configuration
COPY package*.json ./
RUN npm ci

# Copy sources and build TypeScript
COPY . .
RUN npm run build

# Runner stage
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

# Copy compiled JS files from builder
COPY --from=builder /app/dist ./dist

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
