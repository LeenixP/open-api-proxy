FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.ui.json vite.config.ts tailwind.config.ts postcss.config.js ./
COPY src/ ./src/
COPY ui/ ./ui/

RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY --from=build /app/dist/ ./dist/
COPY --from=build /app/node_modules/ ./node_modules/
COPY --from=build /app/package.json ./

ENV CONFIG_PATH=/app/config/config.yaml
EXPOSE 6312

RUN mkdir -p /app/config /app/logs

VOLUME ["/app/config", "/app/logs"]

CMD ["node", "dist/index.js"]
