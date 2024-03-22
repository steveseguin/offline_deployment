FROM node:20-alpine

WORKDIR /var/certs

RUN apk add openssl
RUN openssl req  -nodes -new -x509  -keyout key.pem -out cert.pem -subj "/C=/ST=/L=/O=/OU=/CN="

WORKDIR /var/vdo/webserver
COPY . .
RUN npm install

ADD --keep-git-dir=true https://github.com/steveseguin/vdo.ninja.git /var/vdo/vdo.ninja
WORKDIR /var/vdo/vdo.ninja
RUN sed -i 's/\/\/ session\.customWSS = true;/session\.wss = "wss:\/\/"+window\.location\.hostname+":8443";session\.customWSS = true;session.configuration = {}/' ./index.html

EXPOSE 443

ENV KEY_PATH=/var/certs/key.pem
ENV CERT_PATH=/var/certs/cert.pem

CMD ["node", "/var/vdo/webserver/server.js"]
