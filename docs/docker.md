# Optional: run with Docker

[Back to the vanilla guide](../README.md)

Docker packages the same website and HTTPS/WSS server. The address, certificate trust, salt and media-networking requirements are the same. Read the [basic explanation](../README.md#what-you-are-setting-up) first.

These commands target a Linux Docker host with Docker Compose installed. Docker Desktop host networking, mounts and firewalls can differ. You still need a stable server IP and certificates valid for that address.

## 1. Prepare files on the host

Clone this repository and enter it as described in the main guide. Install Node.js 22+ and OpenSSL on the host to use the certificate helper; you do not need to run `install.sh` for this Docker path.

```sh
node scripts/create-certificates.js 192.168.1.28
export LOCAL_UID="$(id -u)"
export LOCAL_GID="$(id -g)"
```

Run these as a regular user. Compose uses that user ID inside the container so it can read the owner's private key without making the key public. Repeat these exports in a fresh shell before Compose commands, or save the numeric values in a local `.env` file. Docker defaults to UID/GID 1000 if you do not set them.

The supplied Compose file mounts **only the server certificate and server key**, read-only. The signing CA key stays outside the container. Create the files before starting Compose; missing bind-mount sources can otherwise become directories.

## 2. Build, then start

The build needs internet access for base images, packages and the pinned VDO.Ninja revision. Configure Docker's CPU allowance to at most half the machine's logical processors before building; the included dependency commands use two workers. The Compose service itself is capped at two CPUs. On a two-thread machine reduce the service limit and build-tool worker limits to one.

```sh
docker compose build
docker compose up -d
docker compose logs --tail=50
```

The default URL is `https://192.168.1.28:8443/`. Set `HTTPS_PORT=443` before starting Compose if you deliberately want host port 443 and it is free. The container still listens on 8443; the website uses the browser's external host and port automatically.

The image uses Node 24, a pinned website commit, `npm ci`, an explicit file-copy list and `.dockerignore`. Local certificates, `.git`, host `node_modules` and local site copies are excluded from the build context. Base-image tags can receive updates; this is not a promise of byte-identical builds.

## 3. Trust and verify

Install the host's `certs/rootCA.crt` on connecting devices, then follow the [two-browser test](../README.md#6-trust-the-root-and-test-two-browsers). The [native-app limitation](../README.md#7-connect-the-native-app) still applies.

For the optional Node diagnostic, install this repository's dependencies on the host with `npm ci --omit=dev`, then run `scripts/check-connection.js` as documented. You can instead perform the browser checks directly.

## Renew, restart and take offline

Keep `certs/` on the host across container rebuilds. Stop the service, renew with the same CA, then recreate the container:

```sh
docker compose stop
node scripts/create-certificates.js --renew 192.168.1.28
docker compose up -d --force-recreate
```

Build before disconnecting the internet. Start the prepared installation offline with `docker compose up -d --no-build --pull never`. To move it to another offline Docker host of the **same compatible architecture**, use `docker save` / `docker load`, transfer the Compose file and server certificate/key securely, and configure permissions and the host IP. Never include the CA private key in a published image.

This change was not container-runtime tested because a Docker engine was unavailable in the development environment. See [validation](validation.md) before treating it as a tested deployment recipe.
