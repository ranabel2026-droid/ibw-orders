FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production PORT=3000 DATA_DIR=/var/data
RUN mkdir -p /var/data && chown -R node:node /var/data /app
USER node
EXPOSE 3000
VOLUME ["/var/data"]
CMD ["node", "server.js"]
