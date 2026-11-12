FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# next.config.ts bakes the API proxy target in at build time.
ARG BACKEND_URL=http://backend:8000
ENV BACKEND_URL=$BACKEND_URL
# Public origin for canonical links, Open Graph and the sitemap.
ARG FRONTEND_URL=http://localhost:3000
ENV FRONTEND_URL=$FRONTEND_URL
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
# Server-side fetches in the running container use this address too (not only the build-time rewrite).
ARG BACKEND_URL=http://backend:8000
ENV BACKEND_URL=$BACKEND_URL
ARG FRONTEND_URL=http://localhost:3000
ENV FRONTEND_URL=$FRONTEND_URL
COPY --from=build /app ./
EXPOSE 3000
CMD ["npm", "run", "start"]
