# Góc Luyện Đề - một image phục vụ cả giao diện (client/dist) lẫn API (server).
FROM node:22-slim AS client
WORKDIR /app
COPY client/package*.json client/
RUN cd client && npm install
COPY client client
COPY shared shared
RUN cd client && npm run build

FROM node:22-slim AS server
WORKDIR /app
COPY server/package*.json server/
RUN cd server && npm install
COPY package.json ./
COPY server server
COPY shared shared
RUN cd server && npm run build

FROM node:22-slim
WORKDIR /app/server
ENV NODE_ENV=production PORT=8080
COPY package.json /app/package.json
COPY server/package*.json ./
RUN npm install --omit=dev
COPY --from=server /app/server/dist ./dist
COPY --from=client /app/client/dist /app/client/dist
EXPOSE 8080
CMD ["node", "dist/server/src/index.js"]
