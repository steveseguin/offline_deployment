# Publish and watch

[Back to setup](../README.md)

Use your server's IP in place of **192.168.1.28**. These examples use port **8443**.

## First: trust the server

[Install `rootCA.crt`](certificates.md) on each phone/computer. Open `https://192.168.1.28:8443/` in its browser without a certificate warning.

## Publish from a browser

On the camera device, open:

```text
https://192.168.1.28:8443/?push=lancheck
```

Allow camera/microphone access and start publishing. Use a different stream ID in place of `lancheck` for each camera.

## Watch in a browser

On another device, open:

```text
https://192.168.1.28:8443/?view=lancheck
```

Confirm picture and sound. Use the same stream ID and password at both ends.

The prepared website connects to your handshake server automatically. For another website, see [browser URL settings](../README.md#using-other-vdoninja-pages).

## Watch in OBS

1. [Trust the root on the OBS computer](certificates.md), then restart OBS.
2. Under **Sources**, choose **+ → Browser**.
3. Paste the local viewer URL above into **URL** and click **OK**.
4. Check the picture and OBS audio mixer. Make a short recording to confirm sound.

## Connected, but no picture or sound?

Check camera/mic permissions, matching stream settings, and guest Wi-Fi isolation. Try pausing a VPN if it blocks LAN connections.

[Troubleshooting](troubleshooting.md) · [Optional internet assistance](hybrid.md)

## Optional apps and integrations

For an app or integration with custom signaling support, use these connection details in its settings:

| Setting | Value |
|---|---|
| Handshake server | `wss://192.168.1.28:8443` |
| Salt | `vdo.ninja` |
| Stream ID / password | Match the viewer |
| Certificate | Trust the server's root CA |

Setting names vary by app. Use its documentation to select the routed signaling protocol, corresponding to the browser's `wss2=` option. Configure STUN/TURN in that app separately from the website.

### Native VDO.Ninja app

Open **Publishing Settings**, then enable **Advanced Settings**.

![Example native app settings: handshake wss://192.168.1.28:8443, salt vdo.ninja, stream ID lancheck, WHIP off.](images/app-settings.png)

Enter the handshake address first, then the salt. Set **Stream ID** to `lancheck`, leave **Room name** and **Password** blank, and keep **WHIP output** off. Press **CONNECT** and allow camera/microphone access.

Watch using the [local viewer URL](#watch-in-a-browser). The app's handshake field takes `wss://IP:PORT`, without `wss2=`.

For certificate errors, check the address, certificate and device clock. If available, **Ignore certificate errors for this handshake server** keeps encryption but skips identity checks; use it only for your own trusted server. On iOS, [enable full trust for the root](certificates.md#iphone-and-ipad).

A blank TURN field uses public TURN servers by default. Use the [offline connection check](../README.md#6-trust-the-root-and-test-two-browsers) before disconnecting the internet for your session.
