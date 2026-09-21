FROM node:24.21.0-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci

FROM deps AS build
COPY . .
ENV API_ORIGIN=http://api:4000
RUN npm run build --workspace @growthos/contracts
RUN npm run build --workspace @growthos/web

FROM node:24.21.0-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
RUN addgroup --system --gid 1001 growthos \
  && adduser --system --uid 1001 --ingroup growthos growthos \
  && chown -R growthos:growthos /app
USER growthos
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
