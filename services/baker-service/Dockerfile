FROM node:20-alpine

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server.js .

RUN chown -R nodeuser:nodejs /app

USER nodeuser

EXPOSE 4001

CMD ["node", "server.js"]
