'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const net = require('net');
const { spawn, spawnSync } = require('child_process');
const { once } = require('events');
const WebSocket = require('ws');

const repo = path.resolve(__dirname, '..');
const testRoot = path.join(repo, '.test-output');
fs.mkdirSync(testRoot, { recursive: true });
const work = fs.mkdtempSync(path.join(testRoot, 'setup-'));
const certs = path.join(work, 'certs');
const website = path.join(work, 'site');
fs.mkdirSync(website);
const index = path.join(website, 'index.html');
fs.writeFileSync(index, '<html><script>// session.customWSS = true;\n</script></html>');

function run(script, args = [], env = {}) {
  return spawnSync(process.execPath, [path.join(repo, script), ...args], {
    cwd: repo, env: { ...process.env, UV_THREADPOOL_SIZE: '2', ...env },
    encoding: 'utf8', timeout: 30000, windowsHide: true
  });
}
function success(result) { assert.equal(result.status, 0, result.stderr || result.stdout); }
function digest(name) { return crypto.createHash('sha256').update(fs.readFileSync(path.join(certs, name))).digest('hex'); }
function openssl(args) {
  const result = spawnSync('openssl', args, { encoding: 'utf8', timeout: 30000, windowsHide: true });
  success(result);
  return result.stdout;
}

after(() => {
  // Only remove the unique directory allocated for this test, inside this repo.
  if (path.dirname(path.resolve(work)) === testRoot && path.basename(work).startsWith('setup-')) {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

test('configure the deployment copy once; reject unknown templates without changing them', () => {
  success(run('scripts/configure-site.js', [website]));
  const configured = fs.readFileSync(index, 'utf8');
  assert.match(configured, /window.location.host/);
  assert.match(configured, /session.salt = "vdo.ninja"/);
  assert.match(configured, /session.customWSS = false;/);
  success(run('scripts/configure-site.js', [website]));
  assert.equal(fs.readFileSync(index, 'utf8'), configured);
  // Upgrade only the exact block installed by the previous helper, including CRLF files.
  fs.writeFileSync(index, configured.replace('session.customWSS = false;', 'session.customWSS = true;').replace(/\n/g, '\r\n'));
  success(run('scripts/configure-site.js', [website]));
  assert.equal(fs.readFileSync(index, 'utf8'), configured);
  const unsupported = path.join(work, 'unsupported');
  fs.mkdirSync(unsupported);
  fs.writeFileSync(path.join(unsupported, 'index.html'), '<html>No configuration anchor</html>');
  assert.equal(run('scripts/configure-site.js', [unsupported]).status, 1);
  assert.equal(fs.readFileSync(path.join(unsupported, 'index.html'), 'utf8'), '<html>No configuration anchor</html>');
});

test('create valid IP, IPv6 and DNS certificates; preserve them until explicit renewal', () => {
  success(run('scripts/create-certificates.js', ['--out', certs, '127.0.0.1', '::1', 'localhost']));
  const ca = new crypto.X509Certificate(fs.readFileSync(path.join(certs, 'rootCA.crt')));
  const leaf = new crypto.X509Certificate(fs.readFileSync(path.join(certs, 'server.crt')));
  assert.equal(ca.ca, true);
  assert.equal(leaf.ca, false);
  assert.equal(leaf.verify(ca.publicKey), true);
  assert.equal(leaf.checkIP('127.0.0.1'), '127.0.0.1');
  assert.ok(leaf.checkIP('::1'));
  assert.equal(leaf.checkHost('localhost'), 'localhost');
  assert.equal(leaf.checkIP('192.0.2.1'), undefined);
  assert.ok(leaf.checkPrivateKey(crypto.createPrivateKey(fs.readFileSync(path.join(certs, 'server.key')))));
  const rootBefore = digest('rootCA.crt');
  const keyBefore = digest('rootCA.key');
  const leafBefore = digest('server.crt');
  success(run('scripts/create-certificates.js', ['--out', certs, '192.0.2.1']));
  assert.equal(digest('server.crt'), leafBefore);
  success(run('scripts/create-certificates.js', ['--out', certs, '--renew', '127.0.0.1', 'localhost']));
  assert.equal(digest('rootCA.crt'), rootBefore);
  assert.equal(digest('rootCA.key'), keyBefore);
  assert.notEqual(digest('server.crt'), leafBefore);
  assert.equal(digest('server.crt.previous'), leafBefore);
});

test('failed renewal preserves the active pair and backups, including on retry', () => {
  const preload = path.join(work, 'fail-certificate-install.cjs');
  fs.writeFileSync(preload, `
    const fs = require('fs');
    const path = require('path');
    for (const operation of ['copyFileSync', 'renameSync']) {
      const original = fs[operation];
      fs[operation] = function (source, target, ...args) {
        if (path.dirname(target) === process.env.CERT_TEST_OUT &&
            path.basename(target) === process.env.CERT_TEST_FAIL_TARGET &&
            !String(source).endsWith('.restore')) {
          throw Object.assign(new Error('simulated certificate installation failure'), { code: 'EIO' });
        }
        return original.call(this, source, target, ...args);
      };
    }
  `);
  for (const backupsExist of [false, true]) {
    for (const failTarget of ['server.key.previous', 'server.crt.previous', 'server.key', 'server.crt']) {
      const directory = fs.mkdtempSync(path.join(work, 'failed-renewal-'));
      const names = ['rootCA.key', 'rootCA.crt', 'server.key', 'server.crt'];
      if (backupsExist) names.push('server.key.previous', 'server.crt.previous');
      for (const name of names) fs.copyFileSync(path.join(certs, name), path.join(directory, name));
      const before = new Map(names.map(name => [name, fs.readFileSync(path.join(directory, name))]));
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = spawnSync(process.execPath, ['--require', preload,
          path.join(repo, 'scripts/create-certificates.js'), '--out', directory, '--renew', 'localhost'], {
          cwd: repo, encoding: 'utf8', timeout: 30000, windowsHide: true,
          env: { ...process.env, UV_THREADPOOL_SIZE: '2', CERT_TEST_OUT: directory, CERT_TEST_FAIL_TARGET: failTarget }
        });
        assert.equal(result.status, 1, result.stderr || result.stdout);
        assert.match(result.stderr, /simulated certificate installation failure/);
        assert.deepEqual(fs.readdirSync(directory).sort(), [...before.keys()].sort());
        for (const [name, contents] of before) {
          assert.deepEqual(fs.readFileSync(path.join(directory, name)), contents, failTarget + ': ' + name);
        }
      }
    }
  }
});

test('failed rollback retains its recovery files and prints their location', () => {
  const directory = fs.mkdtempSync(path.join(work, 'failed-rollback-'));
  const preload = path.join(work, 'fail-certificate-rollback.cjs');
  const names = ['rootCA.key', 'rootCA.crt', 'server.key', 'server.crt'];
  for (const name of names) fs.copyFileSync(path.join(certs, name), path.join(directory, name));
  const originalKey = fs.readFileSync(path.join(directory, 'server.key'));
  fs.writeFileSync(preload, `
    const fs = require('fs');
    const path = require('path');
    const rename = fs.renameSync;
    fs.renameSync = function (source, target) {
      if (path.basename(source) === 'server.crt' || path.basename(source) === 'server.key.restore') {
        throw Object.assign(new Error('simulated disk error'), { code: 'EIO' });
      }
      return rename.call(this, source, target);
    };
  `);
  const result = spawnSync(process.execPath, ['--require', preload,
    path.join(repo, 'scripts/create-certificates.js'), '--out', directory, '--renew', 'localhost'], {
    cwd: repo, encoding: 'utf8', timeout: 30000, windowsHide: true,
    env: { ...process.env, UV_THREADPOOL_SIZE: '2' }
  });
  assert.equal(result.status, 1, result.stderr || result.stdout);
  const stages = fs.readdirSync(directory).filter(name => name.startsWith('.creating-'));
  assert.equal(stages.length, 1);
  const stage = path.join(directory, stages[0]);
  assert.ok(result.stderr.includes('Recovery files preserved in ' + stage));
  assert.deepEqual(fs.readFileSync(path.join(stage, 'server.key.restore')), originalKey);
});

test('private key permissions on filesystems supporting POSIX modes', t => {
  if (process.platform === 'win32') return t.skip('Windows uses ACLs, not POSIX modes.');
  const probe = path.join(work, 'permissions-probe');
  fs.writeFileSync(probe, 'probe', { mode: 0o600 });
  fs.chmodSync(probe, 0o600);
  if ((fs.statSync(probe).mode & 0o777) !== 0o600) {
    return t.skip('This filesystem does not enforce POSIX modes (for example WSL on a Windows mount).');
  }
  assert.equal(fs.statSync(path.join(certs, 'rootCA.key')).mode & 0o777, 0o600);
  assert.equal(fs.statSync(path.join(certs, 'server.key')).mode & 0o777, 0o600);
  assert.equal(fs.statSync(certs).mode & 0o777, 0o700);
});

test('invalid addresses and incomplete CA never replace existing trust', () => {
  const rootBefore = digest('rootCA.crt');
  for (const host of ['https://localhost', 'localhost:8443', '999.1.2.3', '*.example.com', 'host\nDNS:evil']) {
    assert.equal(run('scripts/create-certificates.js', ['--out', certs, '--renew', host]).status, 1);
  }
  assert.equal(digest('rootCA.crt'), rootBefore);
  const partial = path.join(work, 'partial');
  fs.mkdirSync(partial);
  fs.copyFileSync(path.join(certs, 'rootCA.crt'), path.join(partial, 'rootCA.crt'));
  assert.equal(run('scripts/create-certificates.js', ['--out', partial, 'localhost']).status, 1);
  assert.equal(fs.existsSync(path.join(partial, 'rootCA.key')), false);
});

async function freePort() {
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}
async function startServer(t, cert = 'server.crt') {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(repo, 'server.js')], {
    cwd: work, windowsHide: true,
    env: { ...process.env, PORT: String(port), WEB_ROOT: website,
      KEY_PATH: path.join(certs, 'server.key'), CERT_PATH: path.join(certs, cert), UV_THREADPOOL_SIZE: '2' }
  });
  t.after(async () => {
    if (child.exitCode === null) {
      const stopped = once(child, 'exit');
      child.kill();
      await stopped;
    }
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
    let logs = '';
    child.stderr.on('data', data => { logs += data; });
    child.on('error', reject);
    child.on('exit', () => { clearTimeout(timer); reject(new Error(logs)); });
    child.stdout.on('data', data => {
      logs += data;
      if (logs.includes('WSS handshake server listening')) { clearTimeout(timer); resolve(); }
    });
  });
  return { port, ca: fs.readFileSync(path.join(certs, 'rootCA.crt')) };
}
function get(port, ca, pathname = '/', servername) {
  return new Promise((resolve, reject) => {
    https.get({ hostname: '127.0.0.1', port, path: pathname, ca, servername, rejectUnauthorized: true }, response => {
      let body = '';
      response.on('data', data => { body += data; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
      response.on('error', reject);
    }).on('error', reject);
  });
}

test('HTTPS and WSS use the supplied CA; reject missing trust and wrong names; keep keys private', async t => {
  const { port, ca } = await startServer(t);
  assert.equal((await get(port, ca)).status, 200);
  await assert.rejects(get(port, undefined), /certificate|issuer|self.signed/i);
  await assert.rejects(get(port, ca, '/', 'wrong.example'), /altname|altnames|hostname/i);
  for (const target of ['/certs/server.key', '/rootCA.key', '/.git/config', '/../certs/rootCA.key']) {
    assert.equal((await get(port, ca, target)).status, 404);
  }
  const result = run('scripts/check-connection.js', ['https://127.0.0.1:' + port, path.join(certs, 'rootCA.crt')]);
  success(result);
  assert.equal((result.stdout.match(/PASS:/g) || []).length, 2);
  assert.equal(run('scripts/check-connection.js', ['https://127.0.0.1:' + port]).status, 1);
});

async function peer(t, server) {
  const socket = new WebSocket('wss://127.0.0.1:' + server.port, { ca: server.ca });
  const messages = [];
  socket.on('message', raw => messages.push(JSON.parse(raw)));
  t.after(() => socket.terminate());
  await once(socket, 'open');
  return {
    socket, messages,
    send(message) { socket.send(JSON.stringify(message)); },
    next(predicate = () => true) {
      return new Promise((resolve, reject) => {
        function check() {
          const index = messages.findIndex(predicate);
          if (index < 0) return;
          clearTimeout(timer);
          socket.off('message', check);
          resolve(messages.splice(index, 1)[0]);
        }
        const timer = setTimeout(() => {
          socket.off('message', check);
          reject(new Error('Timed out waiting for signaling message: ' + JSON.stringify(messages)));
        }, 3000);
        socket.on('message', check);
        check();
      });
    },
    async flush() {
      const pong = once(socket, 'pong');
      socket.ping();
      await pong;
    },
    async close() {
      const closed = once(socket, 'close');
      socket.close();
      await closed;
    }
  };
}

test('advanced routing accepts Flutter-style requests without from and routes SDP/ICE by server identity', async t => {
  const server = await startServer(t);
  const publisher = await peer(t, server);
  const viewer = await peer(t, server);
  const observer = await peer(t, server);
  publisher.send({ request: 'seed', streamID: 'local-test' });
  await publisher.flush();
  viewer.send({ request: 'play', streamID: 'local-test' });
  const offerRequest = await publisher.next();
  assert.equal(offerRequest.request, 'offerSDP');
  assert.match(offerRequest.UUID, /^[0-9a-f-]{36}$/);
  publisher.send({ UUID: offerRequest.UUID, from: 'spoofed', description: { type: 'offer', sdp: 'test-sdp' }, session: 'session-1' });
  const offer = await viewer.next();
  assert.equal(offer.from, undefined);
  assert.notEqual(offer.UUID, offerRequest.UUID);
  assert.equal(offer.description.sdp, 'test-sdp');
  assert.equal(offer.session, 'session-1');
  viewer.send({ UUID: offer.UUID, candidate: { candidate: 'test-candidate' }, session: 'session-1' });
  const candidate = await publisher.next();
  assert.equal(candidate.UUID, offerRequest.UUID);
  assert.equal(candidate.candidate.candidate, 'test-candidate');
  await observer.flush();
  assert.deepEqual(observer.messages, []);
  // Bad JSON and valid JSON of the wrong shape must not crash the server.
  for (const raw of ['{', 'null', '[]', '42', '"text"']) publisher.socket.send(raw);
  await publisher.flush();
  assert.equal((await get(server.port, server.ca)).status, 200);
});

test('waiting viewers are notified, duplicate streams rejected, and disconnected publishers can reconnect', async t => {
  const server = await startServer(t);
  const viewer = await peer(t, server);
  viewer.send({ request: 'play', streamID: 'later' });
  await viewer.flush();
  const publisher = await peer(t, server);
  publisher.send({ request: 'seed', streamID: 'later' });
  assert.equal((await publisher.next()).request, 'offerSDP');
  const duplicate = await peer(t, server);
  duplicate.send({ request: 'seed', streamID: 'later' });
  assert.equal((await duplicate.next()).request, 'alert');
  await publisher.close();
  await viewer.flush();
  duplicate.send({ request: 'seed', streamID: 'later' });
  await duplicate.flush();
  viewer.send({ request: 'play', streamID: 'later' });
  assert.equal((await duplicate.next()).request, 'offerSDP');
});

test('room listing unblocks Flutter join-then-seed, with director and room discovery messages', async t => {
  const server = await startServer(t);
  const director = await peer(t, server);
  director.send({ request: 'joinroom', roomid: 'studio', claim: true });
  assert.deepEqual(await director.next(), { request: 'listing', list: [], claim: true });
  const publisher = await peer(t, server);
  publisher.send({ request: 'joinroom', roomid: 'STUDIO' });
  const listing = await publisher.next();
  assert.equal(listing.request, 'listing');
  assert.equal(listing.list.length, 1);
  assert.equal(listing.director, listing.list[0].UUID);
  const joined = await director.next();
  assert.equal(joined.request, 'someonejoined');
  publisher.send({ request: 'seed', streamID: 'room-stream' });
  const added = await director.next();
  assert.deepEqual(added, { request: 'videoaddedtoroom', UUID: joined.UUID, streamID: 'room-stream' });
  const viewer = await peer(t, server);
  viewer.send({ request: 'joinroom', roomid: 'studio' });
  const viewerListing = await viewer.next();
  assert.ok(viewerListing.list.some(member => member.UUID === joined.UUID && member.streamID === 'room-stream'));
  viewer.send({ request: 'play', streamID: 'room-stream' });
  assert.equal((await publisher.next(message => message.request === 'offerSDP')).request, 'offerSDP');
  const outsider = await peer(t, server);
  outsider.send({ request: 'play', streamID: 'room-stream' });
  await outsider.flush();
  await publisher.flush();
  assert.equal(publisher.messages.some(message => message.request === 'offerSDP'), false);
});

test('an expired leaf is rejected even with the correct root', async t => {
  openssl(['req', '-new', '-key', path.join(certs, 'server.key'), '-out', path.join(certs, 'expired.csr'), '-subj', '/CN=localhost']);
  fs.writeFileSync(path.join(certs, 'expired.ext'), 'subjectAltName=IP:127.0.0.1,DNS:localhost\nextendedKeyUsage=serverAuth\n');
  openssl(['x509', '-req', '-in', path.join(certs, 'expired.csr'), '-CA', path.join(certs, 'rootCA.crt'),
    '-CAkey', path.join(certs, 'rootCA.key'), '-set_serial', '99', '-days', '-1',
    '-extfile', path.join(certs, 'expired.ext'), '-out', path.join(certs, 'expired.crt')]);
  const { port, ca } = await startServer(t, 'expired.crt');
  await assert.rejects(get(port, ca), /expired/i);
});

test('startup failures are actionable and never downgrade to HTTP', () => {
  const env = { WEB_ROOT: website, CERT_PATH: path.join(certs, 'missing.crt'), KEY_PATH: path.join(certs, 'server.key'), PORT: '8443' };
  const missing = run('server.js', [], env);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /HTTPS startup failed/);
  const badPort = run('server.js', [], { ...env, PORT: 'abc' });
  assert.equal(badPort.status, 1);
  assert.match(badPort.stderr, /PORT must/);
  const noSite = run('server.js', [], { ...env, WEB_ROOT: path.join(work, 'missing') });
  assert.equal(noSite.status, 1);
  assert.match(noSite.stderr, /index.html not found/);
});
