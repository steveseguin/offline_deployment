//
// Copyright (c) 2021 Steve Seguin. All Rights Reserved.
//  Use of this source code is governed by the APGLv3 open-source 
//
// This is VDO.Ninja-specific handshake server implementation
// It has better routing isolation and performance than a generic fan-out implementation
//
// >> Use at your own risk, as it still may contain bugs or security vunlerabilities <<
//
///// INSTALLATION
// sudo apt-get update
// sudo apt-get upgrade
// sudo apt-get install nodejs -y
// sudo apt-get install npm -y
// npm install
// npm install express
// sudo add-apt-repository ppa:certbot/certbot  
// sudo apt-get install certbot -y
// sudo certbot certonly // register your domain
// nodejs server.js // port 443 needs to be open. THIS STARTS THE SERVER (or create a service instead)
//
//// Finally, within VDO.Ninja, update index.html of the ninja installation as needed, such as with:
//  session.wss = "wss://wss.contribute.cam:443";
//  session.customWSS = true;  #  Please refer to the vdo.ninja instructions for exact details on settings; this is just a demo.
/////////////////////////

"use strict";
var fs = require("fs");
var https = require("https");
var express = require("express");
var app = express();
var WebSocket = require("ws");
var cors = require('cors');
var path = require("path");

const key = fs.readFileSync(process.env.KEY_PATH || "./key.pem"); /// UPDATE THIS PATH
const cert = fs.readFileSync(process.env.CERT_PATH || "./cert.pem"); /// UPDATE THIS PATH

var server = https.createServer({ key, cert }, app);
var websocketServer = new WebSocket.Server({ server });

app.use(cors({
  origin: '*'
}));

websocketServer.on('connection', (webSocketClient) => {
  let room = false;
  
  const cleanupClient = () => {
    if (room) {
      broadcastToRoom(room, {
        type: 'disconnect',
        uuid: webSocketClient.uuid
      }, webSocketClient);
    }
  };

  const broadcastToRoom = (roomId, message, exclude) => {
    websocketServer.clients.forEach(client => {
      if (client !== exclude && client.room === roomId) {
        client.send(JSON.stringify(message));
      }
    });
  };

  webSocketClient.on('message', (message) => {
    let msg;
    try {
      msg = JSON.parse(message);
    } catch (e) {
      webSocketClient.send(JSON.stringify({ error: 'invalid message format' }));
      return;
    }

    if (!msg.from) {
      webSocketClient.send(JSON.stringify({ error: 'missing from field' }));
      return;
    }

    if (!webSocketClient.uuid) {
      if (Array.from(websocketServer.clients).some(client => 
        client.uuid && client.uuid === msg.from && client !== webSocketClient
      )) {
        webSocketClient.send(JSON.stringify({ error: 'uuid already in use' }));
        return;
      }
      webSocketClient.uuid = msg.from;
    }

    let streamID = false;
    try {
      if (msg.request === 'seed' && msg.streamID) {
        streamID = msg.streamID;
      } else if (msg.request === 'joinroom') {
        const newRoom = msg.roomid + '';
        if (room && room !== newRoom) {
          broadcastToRoom(room, {
            type: 'leave',
            uuid: webSocketClient.uuid
          }, webSocketClient);
        }
        room = newRoom;
        webSocketClient.room = room;
        if (msg.streamID) {
          streamID = msg.streamID;
        }
      }
    } catch (e) {
      return;
    }

    if (streamID) {
      if (webSocketClient.sid && streamID !== webSocketClient.sid) {
        webSocketClient.send(JSON.stringify({ error: "can't change sid" }));
        return;
      }
      if (Array.from(websocketServer.clients).some(client => 
        client.sid && client.sid === streamID && client !== webSocketClient
      )) {
        webSocketClient.send(JSON.stringify({ error: 'sid already in use' }));
        return;
      }
      webSocketClient.sid = streamID;
    }

    websocketServer.clients.forEach(client => {
      if (webSocketClient === client || 
          (msg.UUID && msg.UUID !== client.uuid) || 
          (room && (!client.room || client.room !== room)) || 
          (!room && client.room) || 
          (msg.request === 'play' && msg.streamID && (!client.sid || client.sid !== msg.streamID))) {
        return;
      }
      client.send(message.toString());
    });
  });

  webSocketClient.on('close', cleanupClient);
  webSocketClient.on('error', () => cleanupClient());
});


setInterval(() => {
  websocketServer.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.ping();
    }
  });
}, 30000);

app.use('/', express.static(path.join(__dirname, './../vdo.ninja/')))

const port = process.env.PORT || 443;
server.listen(port, () => { console.log(`Server started on port ${port}`) });
