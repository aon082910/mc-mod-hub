FROM node:20-alpine

WORKDIR /app

# better-sqlite3 needs build tools to compile its native binding on alpine
RUN apk add --no-cache python3 make g++

COPY package.json ./
RUN npm install --omit=dev

COPY server ./server
COPY public ./public

RUN mkdir -p /data
VOLUME ["/data"]

ENV DATA_DIR=/data
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server/index.js"]
