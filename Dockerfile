# KED Vault — production image (Next.js standalone output)
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN addgroup -g 1001 -S ked && adduser -u 1001 -S ked -G ked
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src ./src
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/postcss.config.mjs ./postcss.config.mjs
COPY --from=build /app/drizzle.config.json ./drizzle.config.json
# persistent data directory for KED_SQLITE_PATH
RUN mkdir -p /data && chown -R ked:ked /data /app
USER ked
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.json()).then(j=>{if(!j.ok)process.exit(1)}).catch(()=>process.exit(1))" || exit 1
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
