'use strict';

const fs = require('fs');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

function openssl(args) {
  const result = spawnSync('openssl', args, { encoding: 'utf8', windowsHide: true });
  if (result.error) throw new Error('OpenSSL could not start. Install openssl and make sure it is on PATH.');
  if (result.status !== 0) throw new Error('OpenSSL failed: ' + result.stderr.trim());
  return result.stdout.trim();
}

// The server is stopped during renewal. Replace whole files and roll back the
// complete set on failure, including existing recovery backups.
function replaceServerFiles(stage, out, serverExists) {
  const names = ['server.key', 'server.crt'];
  if (serverExists) {
    for (const name of names) fs.copyFileSync(path.join(out, name), path.join(stage, name + '.previous'));
    names.unshift('server.key.previous', 'server.crt.previous');
  }
  const originals = new Map();
  for (const name of names) {
    const target = path.join(out, name);
    const original = fs.existsSync(target) ? path.join(stage, name + '.restore') : null;
    if (original) fs.copyFileSync(target, original);
    originals.set(name, original);
  }
  const installed = [];
  try {
    for (const name of names) {
      fs.renameSync(path.join(stage, name), path.join(out, name));
      installed.push(name);
    }
  } catch (error) {
    const failures = [];
    for (const name of installed.reverse()) {
      try {
        const original = originals.get(name);
        if (original) fs.renameSync(original, path.join(out, name));
        else fs.unlinkSync(path.join(out, name));
      } catch (rollbackError) {
        failures.push(name + ': ' + rollbackError.message);
      }
    }
    if (failures.length) {
      error.recoveryDirectory = stage;
      error.message += '. Recovery files preserved in ' + stage + '. Restore the matching pair before restarting: ' + failures.join('; ');
    }
    throw error;
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: node scripts/create-certificates.js [--renew] [--out DIRECTORY] IP_OR_HOSTNAME [MORE_NAMES...]');
    console.log('Without --renew, existing server certificates are preserved. The existing CA is always reused.');
    return;
  }
  let out = path.join(__dirname, '../certs');
  let renew = false;
  const hosts = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--renew') renew = true;
    else if (args[i] === '--out') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('--out needs a directory.');
      out = path.resolve(args[++i]);
    } else if (args[i].startsWith('--')) throw new Error('Unknown option: ' + args[i]);
    else hosts.push(args[i]);
  }
  if (!hosts.length) throw new Error('Supply your server IP, for example: node scripts/create-certificates.js 192.168.1.28');
  for (const host of hosts) {
    const dns = host.length <= 253 && host.split('.').every(label =>
      /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label));
    if (!net.isIP(host) && (!dns || /^[\d.]+$/.test(host))) {
      throw new Error('Use an IP or hostname only, without a scheme, port, path or wildcard: ' + host);
    }
  }
  process.umask(0o077);
  fs.mkdirSync(out, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32' && (fs.statSync(out).mode & 0o077) !== 0) {
    console.warn('The certificate directory is accessible to other users. Use a private Linux directory (chmod 700), or restrict Windows ACLs on a WSL mount.');
  }
  const file = name => path.join(out, name);
  const caExists = fs.existsSync(file('rootCA.crt'));
  if (caExists !== fs.existsSync(file('rootCA.key'))) {
    throw new Error('Incomplete CA: restore the matching rootCA.crt and rootCA.key from your backup. Nothing replaced.');
  }
  const serverExists = fs.existsSync(file('server.crt'));
  if (serverExists !== fs.existsSync(file('server.key'))) {
    throw new Error('Incomplete server pair: restore the matching server.crt and server.key. Nothing replaced.');
  }
  if (serverExists && !caExists) throw new Error('Server files exist without their CA. Restore the CA; no new CA was generated.');
  if (renew && !caExists) throw new Error('--renew needs the existing CA. Restore it or omit --renew for a new installation.');
  if (serverExists && !renew) {
    console.log('Existing certificates preserved. To renew or change addresses, use --renew and list every required address.');
    return;
  }
  openssl(['version']);
  const stage = fs.mkdtempSync(path.join(out, '.creating-'));
  const staged = name => path.join(stage, name);
  let rootCert = file('rootCA.crt');
  let rootKey = file('rootCA.key');
  let preserveStage = false;
  try {
    if (!caExists) {
      rootCert = staged('rootCA.crt');
      rootKey = staged('rootCA.key');
      openssl(['req', '-x509', '-newkey', 'rsa:3072', '-sha256', '-nodes', '-days', '3650',
        '-keyout', rootKey, '-out', rootCert,
        '-subj', '/CN=VDO.Ninja Local CA ' + crypto.randomBytes(4).toString('hex'),
        '-addext', 'basicConstraints=critical,CA:TRUE,pathlen:0',
        '-addext', 'keyUsage=critical,keyCertSign,cRLSign']);
    }
    const ca = new crypto.X509Certificate(fs.readFileSync(rootCert));
    if (!ca.ca || !ca.checkPrivateKey(crypto.createPrivateKey(fs.readFileSync(rootKey)))) {
      throw new Error('Root certificate and private key must be a matching CA pair.');
    }
    if (Date.parse(ca.validTo) < Date.now() + 398 * 86400000) {
      throw new Error('The root CA expires too soon. See docs/maintenance.md before replacing your CA.');
    }
    const san = hosts.map(host => (net.isIP(host) ? 'IP:' : 'DNS:') + host).join(',');
    fs.writeFileSync(staged('server.ext'), [
      'basicConstraints=critical,CA:FALSE',
      'keyUsage=critical,digitalSignature,keyEncipherment',
      'extendedKeyUsage=serverAuth',
      'subjectAltName=' + san,
      'subjectKeyIdentifier=hash',
      'authorityKeyIdentifier=keyid,issuer', ''
    ].join('\n'));
    openssl(['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-sha256',
      '-keyout', staged('server.key'), '-out', staged('server.csr'), '-subj', '/CN=VDO.Ninja Local Server']);
    openssl(['x509', '-req', '-in', staged('server.csr'), '-CA', rootCert, '-CAkey', rootKey,
      '-set_serial', '0x' + crypto.randomBytes(16).toString('hex'), '-days', '397', '-sha256',
      '-extfile', staged('server.ext'), '-out', staged('server.crt')]);
    openssl(['verify', '-CAfile', rootCert, '-purpose', 'sslserver', staged('server.crt')]);
    fs.chmodSync(rootKey, 0o600);
    fs.chmodSync(rootCert, 0o644);
    if (!caExists) {
      fs.copyFileSync(rootKey, file('rootCA.key'), fs.constants.COPYFILE_EXCL);
      fs.copyFileSync(rootCert, file('rootCA.crt'), fs.constants.COPYFILE_EXCL);
    }
    // Set modes before publishing, so a chmod failure cannot damage the active pair.
    fs.chmodSync(staged('server.key'), 0o600);
    fs.chmodSync(staged('server.crt'), 0o644);
    replaceServerFiles(stage, out, serverExists);
    console.log('Server certificate ready for: ' + hosts.join(', '));
    console.log('Install only ' + file('rootCA.crt') + ' on your devices. Never share .key files.');
    console.log('Root SHA-256 fingerprint: ' + ca.fingerprint256);
    console.log('Server certificate expires: ' + new crypto.X509Certificate(fs.readFileSync(file('server.crt'))).validTo);
  } catch (error) {
    preserveStage = error.recoveryDirectory === stage;
    throw error;
  } finally {
    if (!preserveStage && path.dirname(path.resolve(stage)) === path.resolve(out) && path.basename(stage).startsWith('.creating-')) {
      fs.rmSync(stage, { recursive: true, force: true });
    }
  }
}
try { main(); } catch (error) {
  console.error('Certificate setup failed: ' + error.message);
  process.exitCode = 1;
}
