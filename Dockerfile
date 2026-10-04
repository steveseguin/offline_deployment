FROM node:24-alpine AS website
RUN apk add --no-cache git
WORKDIR /build
COPY vdoninja-version.txt ./
RUN git init /site && git -C /site remote add origin https://github.com/steveseguin/vdo.ninja.git \
    && git -C /site -c pack.threads=2 fetch --depth=1 origin "$(cat vdoninja-version.txt)" \
    && git -C /site checkout --detach FETCH_HEAD && rm -rf /site/.git
COPY scripts/configure-site.js ./configure-site.js
RUN node configure-site.js /site

FROM node:24-alpine
WORKDIR /app
ENV npm_config_jobs=2 UV_THREADPOOL_SIZE=2 MAKEFLAGS=-j2
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY --from=website /site /site
ENV PORT=8443 WEB_ROOT=/site CERT_PATH=/certs/server.crt KEY_PATH=/certs/server.key
EXPOSE 8443
USER node
CMD ["node", "server.js"]
