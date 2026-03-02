FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production=false

COPY tsconfig.json build.mjs ./
COPY src/ src/

# Build TypeScript
RUN npx tsc

EXPOSE 8547

ENV PROOF_SERVER_URL=http://oblivious-node:8545
ENV FALLBACK_RPC_URL=http://geth:8545
ENV CHAIN_ID=1337
ENV PORT=8547
ENV FAILURE_POLICY=fallback

CMD ["node", "dist/server.js"]
