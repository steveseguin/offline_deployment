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

Renew before expiry or when the server address changes. Keep the same root CA so devices continue to trust it.

1. Back up `certs/` privately and stop the server.
2. Check that `certs/server.ext` lists the current addresses. For an older installation without this file, create it using the [certificate instructions](certificates.md#create-server-certificates).
3. From `offline_deployment`, run:

```sh
(
set -e
umask 077
openssl req -new -key certs/server.key -out certs/server.csr \
  -subj '/CN=VDO.Ninja Local Server'
openssl x509 -req -in certs/server.csr -CA certs/rootCA.crt \
  -CAkey certs/rootCA.key -CAcreateserial -days 397 -sha256 \
  -extfile certs/server.ext -out certs/server.next.crt
openssl verify -CAfile certs/rootCA.crt certs/server.next.crt
cp certs/server.crt certs/server.crt.previous
mv certs/server.next.crt certs/server.crt
)
```

Restart the server and open the local website. For Docker, use `docker compose up -d --force-recreate`.

If the root expires or its key is lost or compromised, create a new CA in a new private directory and install its root on every device.

## Update the website

For an older fanout deployment, use `session.customWSS = false` in the site's self-hosting configuration and change browser URL overrides from `wss=` to `wss2=`. Keep the existing address, salt and certificates.

The installer and Docker build use the website revision in `vdoninja-version.txt`.

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
