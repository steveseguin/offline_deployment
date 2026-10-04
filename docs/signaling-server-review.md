# Advanced routing server

`server.js` now uses the routing implementation from [vdoninja_advanced.js at commit 92d9bce](https://github.com/steveseguin/websocket_server/blob/92d9bce4f8c798b520cfd2781d6f7f8ae607b3fb/vdoninja_advanced.js). Copyright and AGPLv3 attribution are retained in the file.

The server assigns peer UUIDs, indexes streams, routes peer messages, queues waiting viewers and sends room listings/discovery events. Clients can send `seed`, `play` and `joinroom` without a `from` field. This matches the startup/message shape used by the reviewed Flutter app. The separately built Flutter 5.0.104 candidate passed direct and room publishing with a scoped certificate exception; see the [Flutter follow-up results](flutter-handoff.md). Installed-CA trust alone still failed in the tested Android Dart connection.

## Local adaptations

- Keep this package's Express website hosting, path settings and startup diagnostics.
- Require HTTPS; TLS errors stop startup instead of falling back to HTTP.
- Use Node's built-in `crypto.randomUUID()` instead of adding the `uuid` dependency.
- Ignore malformed/non-object messages and strip client-supplied `from` from routed messages so the server-authored `UUID` is the sender identity.
- Keep the existing WebSocket ping interval.

## Browser settings and migration

The deployment helper selects `session.customWSS = false` and keeps `session.wss` on the local HTTPS host/port. For browser URL overrides, use `wss2`, not `wss`. The Flutter handshake field remains `wss://IP:PORT`.

This replaces the previous fanout protocol. Update existing server and deployment configuration together using the [migration steps](maintenance.md#update-the-website). No upstream VDO.Ninja or Flutter files are changed here.

See [validation](validation.md) for protocol and browser evidence and remaining device checks. This small example remains intended for a trusted LAN; adopting it is not a full public-server security audit.
