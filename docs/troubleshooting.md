# Find the failing step

[Back to the guide](../README.md)

Work from top to bottom: **reach the server → trust HTTPS → upgrade to WSS → match client settings → receive media**. Changing the salt cannot repair a TLS failure.

| What you see | What to check next |
|---|---|
| npm reports `package.json` missing | Run `bash install.sh` from this repository. Do not create a nested `webserver` folder. |
| Server stops immediately | Read its terminal output. Confirm `WEB_ROOT` contains `index.html`, certificate paths exist, the account can read the key, and `PORT` is valid. |
| `EADDRINUSE` | Another process already uses the port, possibly your manual server and systemd service. Stop the duplicate. |
| `EACCES` | Check file permissions. For low ports, use 8443 as documented instead of running the whole server as root. |
| Page times out / connection refused | Server running? Correct LAN IP and port? LAN firewall rule? Both devices on the same network? Guest Wi-Fi/client isolation off? |
| Browser says certificate authority is unknown | Import the correct **root**, then restart that browser. Check whether it has a separate trust store. |
| Browser says certificate name is wrong | The address in the URL must be included in the certificate SANs. Renew for the exact IP/hostname; installing the root again does not fix this. |
| Expired / not yet valid certificate | Check both clocks and certificate dates. Renew an expired server certificate. |
| HTTPS works but WebSocket fails | Use `wss://` and the same port. Check proxy upgrade handling, if you have a proxy. This package needs no separate signaling port. |
| Caddy log ends with TLS handshake EOF | The client closed the handshake. Certificate rejection is plausible, but EOF alone does not identify the cause; inspect the app's TLS error. |
| Browser works, native VDO.Ninja app reports a certificate error | Check the server address and certificate. App certificate trust can differ from browser trust; see [app settings](devices.md#native-vdoninja-app). |
| Connected, but viewers do not find the stream | Same local server, stream ID, password and salt at both ends? Enter app salt `vdo.ninja` after leaving the handshake field. |
| Connection opens but stops working after upgrading this server | Upgrade/reload the deployment copy too: it must use `customWSS = false`. Replace browser `wss` URL overrides with `wss2`. See [migration steps](maintenance.md#update-the-website). The app field remains a plain `wss://...` URL. |
| View link opens the public site | Replace the origin with your local `https://IP:PORT/`, preserving the intended view/password parameters. |
| Signaling connects but no audio/video arrives | Check client isolation, device firewalls and browser camera/mic permissions. WSS success does not prove peer-to-peer media can pass. The website disables public STUN/TURN for offline use. With internet available, see [hybrid URL options](hybrid.md). |
| Media stalls with a VPN enabled | A VPN can hide usable LAN addresses or interfere with `.local` discovery. Test with it paused if appropriate. For internet-assisted use, explicitly enable viewer STUN/TURN using the [hybrid options](hybrid.md); the app and website have separate settings. |
| The app has TURN configured, but the viewer still stalls | Configure the viewer separately using the [hybrid options](hybrid.md), or check VPN and LAN access for a local connection. |
| USB mic is not heard | First prove browser/app streaming works. Select the USB microphone in the app and verify its audio at the receiver; a local meter is not enough. |
| Works until container replacement | Persist certificates/CA outside containers. Regenerating the CA invalidates the root already trusted by devices. |

## Check the certificate and connection

From the server's `offline_deployment` folder:

```sh
curl --cacert certs/rootCA.crt https://192.168.1.28:8443/
openssl x509 -in certs/server.crt -noout -subject -issuer -dates -ext subjectAltName
```

Replace the IP with yours. The first command should return the website; the second shows which addresses the certificate covers and when it expires.

## Ask for help with useful details

Include OS/app versions, which step first fails, the website/handshake address (redact public-sensitive details), direct install versus Docker/proxy, the error message, and the relevant error. Say whether two browsers work **without bypassing certificate warnings**, and whether the test was offline.

Do not attach private keys, passwords, tokens, or an entire `certs/` archive. Certificate subjects, dates and fingerprints are normally enough for trust troubleshooting.
