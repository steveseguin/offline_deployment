# Trust your local server

[Back to setup](../README.md#6-trust-the-root-and-test-two-browsers)

**Install the public root certificate on each connecting device.** For this guide that is `certs/rootCA.crt`. For an existing Caddy installation it is the root exported from Caddy. Installing the wrong root will not help.

## Create server certificates

Run this on the Linux server, inside `offline_deployment`. Replace **192.168.1.28** with your server's IP in both places below.

For a **new installation**:

```sh
(
set -e
umask 077
mkdir -m 700 certs
openssl req -x509 -newkey rsa:3072 -sha256 -nodes -days 3650 \
  -keyout certs/rootCA.key -out certs/rootCA.crt \
  -subj '/CN=VDO.Ninja Local CA' \
  -addext 'basicConstraints=critical,CA:TRUE,pathlen:0' \
  -addext 'keyUsage=critical,keyCertSign,cRLSign'
openssl req -new -newkey rsa:2048 -nodes -sha256 \
  -keyout certs/server.key -out certs/server.csr \
  -subj '/CN=VDO.Ninja Local Server'
cat > certs/server.ext <<'EOF'
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=IP:192.168.1.28
EOF
openssl x509 -req -in certs/server.csr -CA certs/rootCA.crt \
  -CAkey certs/rootCA.key -CAcreateserial -days 397 -sha256 \
  -extfile certs/server.ext -out certs/server.crt
openssl verify -CAfile certs/rootCA.crt -verify_ip 192.168.1.28 certs/server.crt
)
```

Look for **`certs/server.crt: OK`**. The block stops if `certs/` already exists; use [renewal instructions](maintenance.md#renew-the-server-certificate) for an existing installation.

If you use a hostname too, include it in the `subjectAltName` line, for example `IP:192.168.1.28,DNS:studio.home.arpa`. Devices must be able to resolve that hostname.

## Before installing

Keep the server's certificate directory private. The commands above create it with Linux mode 700 and private files with mode 600. Existing directories, Windows and WSL mounts may need their own access-control settings; use a native Linux filesystem for the vanilla installation. Do not make keys world-readable to fix a permission error.

- Transfer the root through a channel you trust, such as USB. Never transfer `rootCA.key` or `server.key` to clients.
- Compare the root's SHA-256 fingerprint on the server and the receiving device. On the server you can display it again with:

```sh
openssl x509 -in certs/rootCA.crt -noout -subject -fingerprint -sha256
```

- Only trust a CA you control or whose administrator you trust. A root installed system-wide can authorize certificates beyond this one site. Remove it when it is no longer needed.
- Check device and server clocks. Trust does not fix an expired certificate, a wrong clock, or an address missing from the server certificate.

**Success means:** opening your exact local HTTPS address without a certificate warning, then granting camera/microphone permission. Clicking through a warning is not the completed trust setup.

## Windows: Chrome, Edge and OBS

1. Copy `rootCA.crt` to Windows and open it. Inspect the issuer/name and fingerprint using the certificate details or a trusted certificate tool.
2. Choose **Install Certificate**, then **Current User** for the account running the browser/OBS.
3. Choose **Place all certificates in the following store** and select **Trusted Root Certification Authorities**. Finish and confirm that you intend to trust your own CA.
4. Fully close and reopen the browser and OBS. Open your local HTTPS address in the browser first, then use the local `?view=...` link as an OBS Browser Source.

If OBS runs under another account, that account also needs the trust entry. OBS builds and packaging can differ: browser success is a useful checkpoint, not a guarantee about every OBS runtime. Do not disable certificate checking to hide an installation problem.

To remove it, open **Manage user certificates** (`certmgr.msc`), find this specific CA under **Trusted Root Certification Authorities → Certificates**, verify its identity, and delete only that entry. Administrator-managed computers may need IT to install or remove roots.

## Android: browser trust and app trust are separate

1. Transfer `rootCA.crt` to the device.
2. In Settings, search for **Install a certificate** or **Encryption & credentials**. On many devices the path is **Security & privacy → More security settings → Encryption & credentials → Install a certificate → CA certificate**.
3. Select **CA certificate**, accept the device warning for your own CA, unlock the device if asked, and choose the file. Do not choose a Wi-Fi/client certificate option for this HTTPS root.
4. Restart Chrome and open the local HTTPS address.

Menu wording varies by Android version and manufacturer. Google's [certificate management guide](https://support.google.com/pixelphone/answer/2844832) covers the general settings and removal controls; its Wi-Fi-specific installation example is a different certificate use.

**Native VDO.Ninja app:** if the browser connects but the app reports a certificate error, see [app connection settings](devices.md#native-vdoninja-app).

For removal, use the device's **Trusted credentials / User** or **User credentials** screen, inspect the specific CA, and remove it. Avoid **Clear credentials**, which can remove unrelated certificates too.

## iPhone and iPad

1. Transfer/open the public root certificate on the device using a trusted method.
2. Open Settings and install the downloaded profile; it may appear under **Profile Downloaded** or **General → VPN & Device Management**.
3. Open **Settings → General → About → Certificate Trust Settings**.
4. Enable full trust for your root certificate. Installing the profile alone does not automatically enable SSL trust for a manually installed root.
5. Restart the browser/app and test the local HTTPS address.

See [Apple's certificate-trust instructions](https://support.apple.com/en-us/102390).

To remove it, remove the matching certificate profile under **VPN & Device Management**. Do not remove unrelated profiles.

## macOS

Import the public root into **Keychain Access**, using the appropriate keychain for the account/application. Open the certificate, expand **Trust**, and explicitly trust it for SSL. Authenticate if prompted, then restart the browser/OBS. See [Apple's trust settings instructions](https://support.apple.com/guide/keychain-access/change-the-trust-settings-of-a-certificate-kyca11871/mac).

Remove the matching imported CA in Keychain Access when finished. Test OBS separately from the browser.

## Debian / Ubuntu / Raspberry Pi OS clients

To add this root to the operating system's CA store, run on the **client machine** with your copied root:

```sh
sudo cp rootCA.crt /usr/local/share/ca-certificates/vdoninja-local.crt
sudo update-ca-certificates
```

Some browsers, sandboxed applications and OBS packages use their own trust store. If the OS trusts the root but that application does not, import the same root through its certificate-authority settings. For Firefox, look under **Privacy & Security → Certificates → View Certificates → Authorities** and authorize it to identify websites. Treat application packaging differences as a separate check.

To remove the OS entry installed by the command above:

```sh
sudo rm /usr/local/share/ca-certificates/vdoninja-local.crt
sudo update-ca-certificates --fresh
```

Also remove any copies imported separately into applications.

## If it still reports a certificate error

Match all four items: **correct root**, **correct server IP/hostname**, **valid dates**, and **the actual application's trust store**. A root trusted in one browser is not proof that another application trusts it. Continue with the [troubleshooting table](troubleshooting.md).
