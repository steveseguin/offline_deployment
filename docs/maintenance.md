# Keep the installation working

[Back to the guide](../README.md)

## Start at boot

First finish the manual browser test. Stop the manually started server with Ctrl+C before starting the service, so they do not compete for the port.

From the deployment folder, collect these values:

```sh
whoami
pwd
command -v node
```

Open `vdoninja.service` in a text editor. Replace **every** `/ABSOLUTE/PATH/offline_deployment` with the `pwd` output, replace `YOUR_USER` with the regular account that owns the files, and set the executable at the start of `ExecStart` to the absolute Node path. Keep the full script path after it. For example:

```ini
User=alex
WorkingDirectory=/home/alex/vdo-local/offline_deployment
ExecStart=/usr/bin/node /home/alex/vdo-local/offline_deployment/server.js
```

Also replace the paths in the three `Environment` entries. Systemd does not expand `$PWD` or `~` in those values. If Node is installed through a version manager, use its absolute executable path and revisit the service when upgrading Node.

```sh
sudo cp vdoninja.service /etc/systemd/system/vdoninja.service
sudo systemctl daemon-reload
sudo systemctl enable --now vdoninja.service
sudo systemctl status vdoninja.service --no-pager
```

**Checkpoint:** the service is active and your HTTPS/browser checks still work. After a planned reboot, repeat them. To read logs:

```sh
journalctl -u vdoninja.service -n 50 --no-pager
```

The template uses a regular user and port 8443. It does not need to run as root. It is a template, not a ready-to-install file until you replace the placeholders.

## Renew the server certificate

Renew before the printed expiry date, or whenever you add/change the server's IP/hostname. Keep the **same root CA** so clients do not need to trust a new root.

Stop the server first (Ctrl+C, `sudo systemctl stop vdoninja`, or `docker compose stop`). Then, from this folder:

```sh
node scripts/create-certificates.js --renew 192.168.1.28
```

List **all** addresses that must remain valid, including any hostname:

```sh
node scripts/create-certificates.js --renew 192.168.1.28 studio.home.arpa
```

The helper reuses `rootCA.crt`/`rootCA.key`, replaces the server pair, and saves the previous pair as `server.crt.previous` and `server.key.previous`. Back up the folder securely first. Restart the server and rerun the connection check. Node reads certificates at startup, not automatically on file change. For Docker bind mounts, use `docker compose up -d --force-recreate` after renewal.

If the root private key was archived offline, restore it with its matching root certificate before renewal. If a CA file is missing, the helper stops rather than silently creating another CA. If you lose the CA key, the CA expires, or the key is compromised, create a new CA in a **new private directory**, switch the server paths, install the new root on every client, and remove trust in the old root. This is a deliberate migration, not ordinary renewal.

## Update the website

**Migrating from the previous fanout server:** update the server and the deployment copy together. Stop the server and run:

```sh
node scripts/configure-site.js site
```

This upgrades the exact configuration block written by the earlier helper to `customWSS = false`. Restart the server and reload all publishing/viewing pages. Existing certificates, salt and ports stay the same. If your older deployment was configured manually or by the old `sed` command, set `session.customWSS = false` in that deployment's self-hosting configuration while retaining its local `session.wss`, salt and ICE settings; the helper intentionally refuses unrecognized customizations. Browser links using `&wss=` must use `&wss2=` instead. For Docker, rebuild the image and recreate the container so server and website are upgraded together.

The version in `vdoninja-version.txt` is a specific upstream commit. Both vanilla and Docker use it. The helper only changes the deployment copy's existing self-hosting configuration; it does not change VDO.Ninja's upstream code or another checkout.

To rebuild the selected version or recover an interrupted install, stop the server and preserve the old site:

```sh
mv site "site-backup-$(date +%Y%m%d-%H%M%S)"
bash install.sh
```

Keep backups **outside `site/`**, and do not point `WEB_ROOT` at the repository root. Backup names are unique; do not overwrite an existing backup. For an upgrade, deliberately select a reviewed 40-character upstream commit in `vdoninja-version.txt` before reinstalling. A missing/changed configuration marker makes setup fail instead of silently connecting to public signaling.

Repeat the two-browser offline test before accepting the new version. If necessary, stop the server, preserve the failed new site under another name, and restore the prior directory to `site/`. Certificates live separately and do not need replacing for a website update. Updating this repository's Node dependencies also requires `npm ci --omit=dev` and a server restart; keep existing local changes backed up.

## Back up and stop using the service

Back up `certs/` privately, the service configuration and `vdoninja-version.txt`. Never publish a backup containing private keys or put it inside the web root.

To disable the installed systemd service:

```sh
sudo systemctl disable --now vdoninja.service
sudo rm /etc/systemd/system/vdoninja.service
sudo systemctl daemon-reload
```

Then remove this CA's trust entry from each device if it is no longer needed. Keep or securely retire the private backup according to your needs.
