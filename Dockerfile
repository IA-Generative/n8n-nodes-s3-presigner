FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY nodes ./nodes
COPY scripts ./scripts

RUN npm ci
RUN npm run build

FROM n8nio/n8n:2.17.5

USER root

RUN mkdir -p /opt/custom-nodes/n8n-nodes-s3-presigner /home/node/.cache \
	&& chown -R node:node /home/node/.cache

COPY --from=builder /app/dist /opt/custom-nodes/n8n-nodes-s3-presigner/dist
COPY --from=builder /app/package.json /opt/custom-nodes/n8n-nodes-s3-presigner/package.json

USER node

WORKDIR /home/node

CMD ["start"]
