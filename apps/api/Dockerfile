FROM node:24.21.0-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build --workspace @growthos/contracts
RUN npm run build --workspace @growthos/api

FROM node:24.21.0-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/package.json
RUN npm prune --omit=dev \
  && addgroup --system --gid 1001 growthos \
  && adduser --system --uid 1001 --ingroup growthos growthos \
  && chown -R growthos:growthos /app
USER growthos
EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]
