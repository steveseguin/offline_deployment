# Find the failing step

[Back to the guide](../README.md)

Work from top to bottom: **reach the server → trust HTTPS → upgrade to WSS → match client settings → receive media**. Changing the salt cannot repair a TLS failure.

| What you see | What to check next |
|---|---|
| npm reports `webserver/package.json` missing | This came from the old clone/rename installer layout (issue #2). The current `install.sh` runs from its own repository directory and uses the included `package.json` and lockfile. Run `bash /path/to/offline_deployment/install.sh`; do not create a nested `webserver` folder or run npm there. Preserve existing certificates/site data when migrating. |
| Server stops immediately | Read its terminal output. Confirm `WEB_ROOT` contains `index.html`, certificate paths exist, the account can read the key, and `PORT` is valid. |
| `EADDRINUSE` | Another process already uses the port, possibly your manual server and systemd service. Stop the duplicate. |
| `EACCES` | Check file permissions. For low ports, use 8443 as documented instead of running the whole server as root. |
| Page times out / connection refused | Server running? Correct LAN IP and port? LAN firewall rule? Both devices on the same network? Guest Wi-Fi/client isolation off? |
| Browser says certificate authority is unknown | Import the correct **root**, then restart that browser. Check whether it has a separate trust store. |
| Browser says certificate name is wrong | The address in the URL must be included in the certificate SANs. Renew for the exact IP/hostname; installing the root again does not fix this. |
| Expired / not yet valid certificate | Check both clocks and certificate dates. Renew an expired server certificate. |
| HTTPS works but WebSocket fails | Use `wss://` and the same port. Check proxy upgrade handling, if you have a proxy. This package needs no separate signaling port. |
| Caddy log ends with TLS handshake EOF | The client closed the handshake. Certificate rejection is plausible, but EOF alone does not identify the cause; inspect the app's TLS error. |
| Android browser works, native beta app fails | Reproduced with Brave and app 5.0.103 on Pixel 4a / Android 13 after CA installation and a full app restart. The app still rejected the issuer. A local 5.0.104 candidate passed using an opt-in custom-server certificate exception; this is not a confirmed public release. See [app limitation](../README.md#7-connect-the-native-app). |
| Connected, but viewers do not find the stream | Same local server, stream ID, password and salt at both ends? Enter app salt `vdo.ninja` after leaving the handshake field. |
| Connection opens but stops working after upgrading this server | Upgrade/reload the deployment copy too: it must use `customWSS = false`. Replace browser `wss` URL overrides with `wss2`. See [migration steps](maintenance.md#update-the-website). The app field remains a plain `wss://...` URL. |
| View link opens the public site | Replace the origin with your local `https://IP:PORT/`, preserving the intended view/password parameters. |
| Signaling connects but no audio/video arrives | Check client isolation, device firewalls and browser camera/mic permissions. WSS success does not prove peer-to-peer media can pass. The website disables public STUN/TURN for offline use. With internet available, see [hybrid URL options](../README.md#optional-hybrid-use-with-internet-access). |
| Media stalls with a VPN enabled | A VPN can hide usable LAN addresses or interfere with `.local` discovery. Test with it paused if appropriate. For internet-assisted use, explicitly enable viewer STUN/TURN using the [hybrid options](../README.md#optional-hybrid-use-with-internet-access); the app and website have separate settings. |
| The app has TURN configured, but the offline viewer still stalls | The viewer advertises local addresses only by default. An app-side TURN allocation alone may not establish a path to unresolved browser addresses. The recorded VPN test worked after enabling viewer STUN or TURN. Do not remove the website's offline configuration line. |
| USB mic is not heard | First prove browser/app streaming works. Select the USB microphone in the app and verify its audio at the receiver; a local meter is not enough. |
| Works until container replacement | Persist certificates/CA outside containers. Regenerating the CA invalidates the root already trusted by devices. |

## Check from the server or another computer with Node

```sh
node scripts/check-connection.js https://192.168.1.28:8443/ certs/rootCA.crt
```

This explicitly supplies the root **only to this check**; it does not install it into an OS or app. Two PASS lines establish a trusted HTTPS response and secure WebSocket upgrade. They do not test signaling messages, stream passwords, media, USB audio, or the mobile app.

To inspect the server certificate:

```sh
openssl x509 -in certs/server.crt -noout -subject -issuer -dates -ext subjectAltName
```

## Ask for help with useful details

Include OS/app versions, which step first fails, the website/handshake address (redact public-sensitive details), direct install versus Docker/proxy, the connection-check output, and the relevant error. Say whether two browsers work **without bypassing certificate warnings**, and whether the test was offline.

Do not attach private keys, passwords, tokens, or an entire `certs/` archive. Certificate subjects, dates and fingerprints are normally enough for trust troubleshooting.
