# ---------------------------------------------------------------------------- #
# React (Vite) frontend
#
# Targets:
#   dev  — the Vite dev server with HMR, for docker-compose.dev.yml
#   prod — the default; builds the static bundle and serves it from nginx
# ---------------------------------------------------------------------------- #

# ------------------------------------------------------------------- deps ---- #
FROM node:22-alpine AS deps
WORKDIR /app
# package*.json alone first, so the npm layer is reused unless deps change.
COPY package.json package-lock.json ./
RUN npm ci


# -------------------------------------------------------------------- dev ---- #
FROM node:22-alpine AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
EXPOSE 5173
# --host binds 0.0.0.0 so the port is reachable from outside the container.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]


# ------------------------------------------------------------------ build ---- #
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Left empty on purpose: nginx proxies /api on the same origin, so the app uses
# relative URLs. Set this only if you point the frontend at a backend on a
# different host (e.g. --build-arg VITE_API_BASE_URL=https://api.example.com).
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build


# ----------------------------------------------------------------- runtime --- #
# The nginx runtime, shared by both ways of getting a bundle in. Everything
# except the source of /usr/share/nginx/html lives here, so the two targets
# below can never drift apart.
FROM nginx:1.27-alpine AS runtime

# Substituted into the config at container start (see nginx.conf.template).
ENV BACKEND_ORIGIN=http://backend:8000
# Restrict envsubst to this one variable so nginx's own $host/$uri are untouched.
ENV NGINX_ENVSUBST_FILTER=BACKEND_ORIGIN

COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --spider --tries=1 http://127.0.0.1/ || exit 1


# ------------------------------------------------------------------- prod ---- #
# Default: build the bundle inside Docker. One command, no prerequisites.
FROM runtime AS prod
COPY --from=build /app/dist /usr/share/nginx/html


# --------------------------------------------------------------- prebuilt ---- #
# CI path: consume a dist/ that was built earlier in the pipeline and passed
# along as an artifact, instead of running npm again inside the image build.
# The bundle that was tested is then byte-for-byte the bundle that ships.
#
#   npm run build && docker build --target prebuilt -t weather-frontend .
FROM runtime AS prebuilt
COPY dist /usr/share/nginx/html
