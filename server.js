"use strict";
var fs = require("fs");
var https = require("https");
var express = require("express");

var app = express();

var WebSocket = require("ws");
var path = require("path");

const key = fs.readFileSync(path.resolve(__dirname, "key.pem")); /// UPDATE THIS PATH
const cert = fs.readFileSync(path.resolve(__dirname, "cert.pem")); /// UPDATE THIS PATH

var server = https.createServer({key,cert}, app);
var server_web = https.createServer({key,cert}, app);

var websocketServer = new WebSocket.Server({ server });

websocketServer.on('connection', (webSocketClient) => {
    webSocketClient.on('message', (message) => {
            websocketServer.clients.forEach( client => {
                    if (webSocketClient!=client){
                        client.send(message.toString());
                    }
            });
    });
});
server.listen(8443, () => {
        app.use('/', express.static(path.join(__dirname, './../vdo.ninja/')))
        server_web.listen(443, ()=>{
                console.log("Servers started");
        });
});
