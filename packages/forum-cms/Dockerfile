FROM node:20-slim

## Install system dependencies, `gcsfuse` in particular.
## [SC-002] 改用 signed-by keyring 方式加入 Google apt key，取代已棄用的 apt-key add -，
## 避免未 pin trust anchor 的供應鏈風險。
RUN set -e; \
    apt-get update -y && apt-get install -y \
    curl \
    gnupg2 \
    tini \
    lsof \
    openssl \
    lsb-release; \
    gcsFuseRepo=gcsfuse-`lsb_release -c -s`; \
    curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg \
        | gpg --dearmor \
        | tee /usr/share/keyrings/cloud-google-archive-keyring.gpg > /dev/null; \
    echo "deb [signed-by=/usr/share/keyrings/cloud-google-archive-keyring.gpg] \
        http://packages.cloud.google.com/apt $gcsFuseRepo main" \
        | tee /etc/apt/sources.list.d/gcsfuse.list; \
    apt-get update; \
    apt-get install -y gcsfuse \
    && apt-get clean

ENV APP_DIR /app
## Set fallback mount directory
ENV MNT_DIR /app/gcs
ENV HOST 0.0.0.0
ENV PORT 3000

RUN mkdir -p $APP_DIR

WORKDIR $APP_DIR

COPY . $APP_DIR

## 靜態 JSON：bundler 讀取 data/；靜態網址 /files/*.json 需 public/files
RUN mkdir -p public/files \
    && cp data/countries.json public/files/countries.json \
    && cp data/keywords.json public/files/keywords.json

## Install application dependencies
RUN yarn install
RUN yarn postinstall
## 確保 @prisma/client 與目前 schema.prisma 一致（enum @@map／欄位變更時避免沿用快取或舊層）
RUN npx prisma generate

## Build arguments for frontend-embedded config (public keys only)
ARG RECAPTCHA_ENABLED=false
ARG RECAPTCHA_SITE_KEY=
ENV RECAPTCHA_ENABLED=$RECAPTCHA_ENABLED
ENV RECAPTCHA_SITE_KEY=$RECAPTCHA_SITE_KEY

## Build application bundles
RUN yarn build

RUN yarn cache clean

RUN whereis http2-proxy-server
## Ensure the script is executable
RUN chmod +x run.sh

EXPOSE 3000

## Use tini to manage zombie processes and signal forwarding
## https://github.com/krallin/tini
ENTRYPOINT ["/usr/bin/tini", "--"]

## Pass the startup script as arguments to Tini
CMD [ "/app/run.sh"]
