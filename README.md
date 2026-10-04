# VDO.Ninja on your local network

Host VDO.Ninja on a Linux computer or Raspberry Pi for phones and computers on the same network. Start here; **Docker is optional**.

![The local server supplies the website and handshake service. Audio and video travel between devices.](docs/images/local-network.png)

**Already installed?** [Publish and watch](#6-trust-the-root-and-test-two-browsers) · [Use OBS](docs/devices.md#watch-in-obs) · [Troubleshooting](docs/troubleshooting.md)

## 1. Choose a stable server address

Find the server's LAN address with `hostname -I`. Reserve it in your router so it stays the same.

This guide uses **192.168.1.28**. Replace it with your server's address everywhere.

| Use | Address |
|---|---|
| Website | `https://192.168.1.28:8443/` |
| Handshake server | `wss://192.168.1.28:8443` |

Use the same LAN/Wi-Fi, not a guest network. Keep **:8443** in the addresses.

## 2. Install the tools

Run on the **Linux server**, with internet available:

```sh
sudo apt update
sudo apt install -y git openssl nodejs npm
node --version
```

You need **Node.js 22 or newer**. If yours is older, [install a supported version](https://nodejs.org/en/download) before continuing.

## 3. Download and prepare the website

```sh
mkdir -p ~/vdo-local
cd ~/vdo-local
git clone https://github.com/steveseguin/offline_deployment.git
cd offline_deployment
bash install.sh
```

Wait for **Website ready**. The installer updates `site/index.html` to use this server for signaling, sets the salt to `vdo.ninja`, and disables public STUN/TURN. The local website is ready to use without editing files or adding handshake options to your links.

## 4. Create your local certificates

Follow [Create your server certificates](docs/certificates.md#create-server-certificates), then return here.

![Install the public root certificate on your devices. Keep private keys on the server.](docs/images/certificate-trust.png)

Copy **only `certs/rootCA.crt`** to your devices. Keep the `.key` files private.

## 5. Start the secure server

From the `offline_deployment` folder:

```sh
export PORT=8443
export WEB_ROOT="$PWD/site"
export CERT_PATH="$PWD/certs/server.crt"
export KEY_PATH="$PWD/certs/server.key"
export UV_THREADPOOL_SIZE=2
node server.js
```

Leave this terminal open. Allow TCP **8443 from your LAN** through the server's firewall if needed. No internet port forwarding is needed.

## 6. Trust the root and test two browsers

1. [Install the root certificate](docs/certificates.md) on both devices. Restart their browsers.
2. On the camera device, open `https://192.168.1.28:8443/?push=lancheck`. Start the camera and microphone.
3. On the other device, open `https://192.168.1.28:8443/?view=lancheck`.
4. Confirm picture **and sound**. Neither browser should show a certificate warning.

Use matching passwords if you set one. To check offline use, disconnect the internet uplink when it will not disrupt others, keep Wi-Fi/LAN running, disable phone cellular data, and reload both pages.

## Using other VDO.Ninja pages

The prepared local website already connects to your server. To point another VDO.Ninja website at it, append this to both the publisher and viewer links:

```text
&wss2=192.168.1.28:8443&salt=vdo.ninja
```

Use `?` instead of the first `&` if the URL has no query yet. This server uses **`wss2=`**. Keep using your local website address for offline use; loading `vdo.ninja` requires internet.

## Optional hybrid use with internet access

The website defaults to local connections. For internet-assisted STUN/TURN or VPN troubleshooting, see [hybrid connections](docs/hybrid.md).

## What to do next

| Need | Guide |
|---|---|
| Start at boot, renew certificates, or update | [Maintenance](docs/maintenance.md) |
| Docker | [Optional Docker setup](docs/docker.md) |
| Existing proxy or VPS | [Other setups](docs/other-setups.md) |
| Optional apps and integrations | [Connection settings](docs/devices.md#optional-apps-and-integrations) |
| Something does not connect | [Troubleshooting](docs/troubleshooting.md) |
