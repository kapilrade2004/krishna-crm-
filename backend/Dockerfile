FROM node:20-alpine

RUN apk add --no-cache wget

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY . .

EXPOSE 8034

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -q --spider http://localhost:8034/health || exit 1

CMD ["node", "src/server.js"]