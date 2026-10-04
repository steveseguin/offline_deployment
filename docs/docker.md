# Optional: run with Docker

[Back to the vanilla guide](../README.md)

Docker packages the same website and HTTPS/WSS server. The address, certificate trust, salt and media-networking requirements are the same.

These commands target a Linux Docker host with Docker Compose installed. Docker Desktop host networking, mounts and firewalls can differ. You still need a stable server IP and certificates valid for that address.

## 1. Prepare files on the host

Clone this repository and enter it as described in the main guide. Install OpenSSL and [create the server certificates](certificates.md#create-server-certificates). You do not need to run `install.sh` on the host for this Docker path.

```sh
export LOCAL_UID="$(id -u)"
export LOCAL_GID="$(id -g)"
```

Run these as a regular user. Compose uses that user ID inside the container so it can read the owner's private key without making the key public. Repeat these exports in a fresh shell before Compose commands, or save the numeric values in a local `.env` file. Docker defaults to UID/GID 1000 if you do not set them.

The supplied Compose file mounts **only the server certificate and server key**, read-only. The signing CA key stays outside the container. Create the files before starting Compose; missing bind-mount sources can otherwise become directories.

## 2. Build, then start

The build downloads the website and packages, so internet access is needed here.

```sh
docker compose build
docker compose up -d
docker compose logs --tail=50
```

The default URL is `https://192.168.1.28:8443/`. Set `HTTPS_PORT=443` before starting Compose if you deliberately want host port 443 and it is free. The container still listens on 8443; the website uses the browser's external host and port automatically.

## 3. Trust and verify

Install the host's `certs/rootCA.crt` on connecting devices, then follow the [two-browser test](../README.md#6-trust-the-root-and-test-two-browsers). For the native VDO.Ninja app, follow [app settings](devices.md#native-vdoninja-app).

## Renew, restart and take offline

Keep `certs/` on the host across container rebuilds. Stop the service, [renew with the same CA](maintenance.md#renew-the-server-certificate), then recreate the container:

```sh
docker compose stop
# Follow the certificate renewal instructions, then:
docker compose up -d --force-recreate
```

Build before disconnecting the internet. Start the prepared installation offline with `docker compose up -d --no-build --pull never`. To move it to another offline Docker host of the **same compatible architecture**, use `docker save` / `docker load`, transfer the Compose file and server certificate/key securely, and configure permissions and the host IP. Never include the CA private key in a published image.
