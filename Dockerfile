FROM node:18-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies including devDependencies for build
RUN npm install

COPY src ./src
COPY migrations ./migrations
COPY contracts ./contracts

RUN npm run build

# ---

FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

# Only production dependencies
RUN npm install --only=production

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/migrations ./migrations
# CONTRACTS_PATH needs to be available
COPY --from=builder /usr/src/app/contracts ./contracts

ENV NODE_ENV=production
ENV SERVICE_PORT=8093
ENV CONTRACTS_PATH=./contracts

EXPOSE 8093

CMD ["node", "dist/index.js"]
