FROM node:24-alpine AS deps
WORKDIR /app
# 컨텍스트가 루트일 때를 대비하여 경로 수정
COPY apps/web/package.json ./
RUN npm install

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY apps/web/. .
ENV NEXT_TELEMETRY_DISABLED=1
ENV BACKEND_URL=http://ott-api:8080
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/public ./public
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "start"]