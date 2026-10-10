FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/native/package.json ./apps/native/package.json
RUN npm ci --workspace ott --include-workspace-root=false --no-audit --no-fund \
    && mkdir -p apps/web/node_modules

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps ./apps
COPY apps/web/. ./apps/web
ENV NEXT_TELEMETRY_DISABLED=1
ENV BACKEND_URL=http://ott-api:8080
RUN npm run build --workspace ott

FROM node:24-alpine AS runner
WORKDIR /app/apps/web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/package-lock.json /app/package-lock.json
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/web/next.config.ts ./next.config.ts
COPY --from=build /app/apps/web/package.json ./package.json
COPY --from=build /app/apps/web/public ./public
COPY --from=build /app/apps/web/.next ./.next
COPY --from=build /app/apps/web/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "start"]
