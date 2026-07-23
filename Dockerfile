FROM node:22-alpine

WORKDIR /app

COPY --chown=node:node index.html server.mjs ./

RUN mkdir -p /data && chown node:node /data

USER node

EXPOSE 8080
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

CMD ["node", "server.mjs"]
