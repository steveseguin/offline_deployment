FROM node:24-alpine AS website
RUN apk add --no-cache bash git
WORKDIR /build
COPY vdoninja-version.txt install.sh ./
RUN bash install.sh --website-only && rm -rf site/.git

FROM node:24-alpine
WORKDIR /app
ENV npm_config_jobs=2 UV_THREADPOOL_SIZE=2 MAKEFLAGS=-j2
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY --from=website /build/site /site
ENV PORT=8443 WEB_ROOT=/site CERT_PATH=/certs/server.crt KEY_PATH=/certs/server.key
EXPOSE 8443
USER node
CMD ["node", "server.js"]
