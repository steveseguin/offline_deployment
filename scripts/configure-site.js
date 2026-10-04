'use strict';

// Only run against the deployment copy, never a development checkout.
const fs = require('fs');
const path = require('path');
const target = path.resolve(process.argv[2] || path.join(__dirname, '../site'));
const index = path.join(target, 'index.html');
const marker = '// offline_deployment: local HTTPS signaling';
const configuration = marker + '\n' +
  'session.wss = "wss://" + window.location.host;\n' +
  'session.customWSS = false;\n' +
  'session.salt = "vdo.ninja";\n' +
  'session.configuration = {};';
const previousConfiguration = configuration.replace('session.customWSS = false;', 'session.customWSS = true;');

try {
  const html = fs.readFileSync(index, 'utf8').replace(/\r\n/g, '\n');
  if (html.includes(configuration)) {
    console.log('Local website configuration is already in place.');
  } else if (html.includes(previousConfiguration) && html.split(marker).length === 2) {
    fs.writeFileSync(index, html.replace(previousConfiguration, configuration));
    console.log('Updated deployment copy to advanced routing (wss2 / customWSS = false).');
  } else {
    const matches = html.match(/\/\/ session\.customWSS = true;/g) || [];
    if (html.includes(marker) || matches.length !== 1) {
      throw new Error('Expected one unmodified customWSS configuration marker. No files changed.');
    }
    fs.writeFileSync(index, html.replace('// session.customWSS = true;', configuration));
    console.log('Configured deployment copy: same-host WSS routing (wss2), salt vdo.ninja, no public STUN/TURN.');
  }
} catch (error) {
  console.error('Website configuration failed: ' + error.message);
  process.exitCode = 1;
}
