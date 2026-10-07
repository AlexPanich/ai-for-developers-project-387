# Сборка: TypeSpec не нужен (артефакты контракта закоммичены), только фронтенд.
FROM oven/bun:1.4.2 AS build
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY contract/package.json contract/package.json
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Рантайм: прод-зависимости, исходники бэкенда и собранная SPA.
# Порт задаётся переменной окружения PORT (автопроверка Хекслета ставит 8080).
FROM oven/bun:1.4.2 AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json bun.lock ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY contract/package.json contract/package.json
RUN bun install --frozen-lockfile --omit=dev

COPY --from=build /app/apps/backend/src apps/backend/src
COPY --from=build /app/apps/frontend/dist apps/frontend/dist

# Документационный порт автопроверки Хекслета; приложение слушает $PORT.
EXPOSE 8080

CMD ["bun", "apps/backend/src/index.ts"]
