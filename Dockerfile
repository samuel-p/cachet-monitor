FROM node:14.6.0-alpine

MAINTAINER mail@sp-codes.de

WORKDIR monitor

COPY index.js package.json ./

RUN mkdir -p /monitor/data \
  && apk --no-cache add nmap git \
  && npm install \
  && apk del git

CMD ["node", "index.js"]
