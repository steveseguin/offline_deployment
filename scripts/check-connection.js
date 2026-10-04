'use strict';

const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');

async function main() {
  if (!process.argv[2]) throw new Error('Usage: node scripts/check-connection.js https://SERVER:8443 [rootCA.crt]');
  const url = new URL(process.argv[2]);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use an https:// address without credentials.');
  const options = { rejectUnauthorized: true };
  if (process.argv[3]) options.ca = fs.readFileSync(process.argv[3]);
  await new Promise((resolve, reject) => {
    const request = https.get(url, options, response => {
      response.resume();
      if (response.statusCode !== 200) return reject(new Error('HTTPS returned ' + response.statusCode + '; check the website path.'));
      response.on('end', resolve);
      response.on('error', reject);
    });
    request.setTimeout(10000, () => request.destroy(new Error('HTTPS connection timed out.')));
    request.on('error', reject);
  });
  console.log('PASS: HTTPS certificate, address and website response.');
  url.protocol = 'wss:';
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { ...options, handshakeTimeout: 10000 });
    socket.once('error', reject);
    socket.once('open', () => { socket.close(); resolve(); });
  });
  console.log('PASS: secure WebSocket upgrade. This does not test media, salt or the phone app.');
}
main().catch(error => {
  console.error('Connection check failed: ' + error.message);
  console.error('Check the address, port, device clock, certificate names and trusted root. See docs/troubleshooting.md.');
  process.exitCode = 1;
});
