FROM node:20-alpine

WORKDIR /var/vdo/webserver
COPY . .
RUN npm install

ADD --keep-git-dir=true https://github.com/steveseguin/vdo.ninja.git /var/vdo/vdo.ninja
WORKDIR /var/vdo/vdo.ninja
RUN sed -i 's/\/\/ session\.customWSS = true;/session\.wss = "wss:\/\/"+window\.location\.host;session\.customWSS = true;session\.salt = "vdo\.ninja";session.configuration = {}/' ./index.html

ENV PORT=8443

EXPOSE 8443

CMD ["node", "/var/vdo/webserver/server.js"]
