# Validation and remaining checks

Reviewed 2026-10-04. These results distinguish code checks from real device testing. The original 5.0.103 certificate failure is preserved below; the separate Flutter task tested a local 5.0.104 candidate with an endpoint-specific certificate exception. Installed-CA trust itself remains unsupported in that tested Dart connection.

| Check | Result | Evidence / limit |
|---|---|---|
| Vanilla installer | PASS | Ran in Ubuntu under WSL, Node 22.22.1 / OpenSSL 3.0.13. Downloaded the recorded upstream commit and applied the existing local-site configuration. A second run refused to overwrite it. Not a fresh Raspberry Pi OS installation. |
| Certificate creation and renewal | PASS | Automated checks cover valid IP/IPv6/DNS names, matching keys, CA signature, repeated-run preservation, explicit renewal with the same CA, and backup of the previous leaf. |
| Invalid input / incomplete CA | PASS | Rejected without silently replacing the existing trust root. |
| Linux private-file permissions | NOT VERIFIED | The test detected that this WSL Windows mount does not enforce POSIX modes and skipped that assertion. Windows uses ACLs. Verify native Linux directory/key permissions before deploying. |
| HTTPS and WSS | PASS | Live local server with explicitly supplied root; website response and secure WebSocket upgrade succeeded. Missing trust, wrong hostname and expired leaf were rejected. Missing certificate/site and invalid-port errors were checked. |
| Private files outside web root | PASS | Requests for certificate keys and `.git/config` did not expose files in the test deployment. Keep backups and keys outside the web root in real installations too. |
| Advanced routing protocol | PASS, focused cases | Requests without `from`, server-authored sender UUIDs, directed SDP/ICE, no unrelated-client broadcast, waiting viewers, duplicate stream rejection, publisher reconnect, room listing/discovery, director claim and cross-room play filtering tested. Malformed message shapes are ignored. Not exhaustive migration/room lifecycle coverage. |
| Browser-to-browser video | PASS, synthetic | Repeated after the routing migration with both the prepared-site defaults and explicit `&wss2=` URL overrides: headless Chromium on Windows received a moving synthetic camera stream at 427×240. Both WSS connections stayed local, salt was `vdo.ninja`, `customWSS` was false, and ICE configuration was empty. No page errors or external requests were observed. |
| Browser certificate-store installation | PASS, user-confirmed on Android | After installing the test root as an Android CA certificate, Steve confirmed that Brave on the Pixel 4a opened the local HTTPS site without a certificate error. This is distinct from the earlier desktop synthetic test, which used an isolated profile and a leaf public-key allowance. Other browser/OS trust stores remain unverified. |
| Physical LAN / internet disconnected | PARTIAL | The 5.0.104 candidate delivered media over the LAN with Speedify paused. Internet-disconnected operation remains untested. See the physical follow-up below; internet-assisted paths are separate results. |
| Built-in microphone audio | PASS, functional | Received during the 5.0.104 candidate tests; not audio-quality qualification. |
| USB microphone / Android USB camera | DEFERRED | Receiver verification and USB camera testing are on hold at Steve's request. No USB support claim is made. |
| Android app 5.0.103 (original test) | TLS FAILED | Pixel 4a, Android 13, installed app 5.0.103: `CERTIFICATE_VERIFY_FAILED: unable to get local issuer certificate` before CA installation and after the user confirmed installing the test root as a CA certificate. Force-stopping and restarting the app gave the same result. Steve confirmed Brave opened the same HTTPS site without a certificate error. TLS failure prevented routed signaling/media tests. The generated viewer link also used `wss=`, which needs changing to `wss2=` for this routing server. No Flutter files changed in this deployment task. The separate task's candidate results follow; see [Flutter follow-up](flutter-handoff.md). |
| Android app 5.0.104 (local candidate) | PASS, functional | Separate Flutter task verified exception off/on/off, endpoint isolation, saved settings, direct/room publishing, built-in audio and server-restart recovery. API 21 support retained; not proof of smoothness, USB support or disconnected operation. |
| iOS app | NOT TESTED | Installed-profile trust and routed signaling need actual-device testing. |
| OBS | NOT TESTED | Trust behavior can depend on platform and packaging. |
| Systemd | NOT RUNTIME TESTED | Template and instructions provided; no service installed or enabled on the development machine. Replace placeholders and verify on the target Linux host. |
| Docker | PARTIAL | Compose configuration parses. No running Docker engine was available, so image build, key permissions inside the container and container startup remain unverified. |
| Guide presentation | PASS | Local Markdown links/anchors checked; README rendered at desktop width with both raster illustrations loading and no horizontal overflow. Images inspected for labels and meaning. |

The Flutter handoff reports 88 focused tests passing and a successful release build. Analysis had zero errors with existing warnings/info. An existing Meshcast accessibility failure was reproduced on untouched HEAD. These are reported results from the separate Flutter task, not checks rerun by this documentation update.

## Offline and hybrid connectivity follow-up

Physical follow-up on 2026-10-04 used Pixel 4a / Android 13 and a locally built Flutter 5.0.104 candidate with a custom-server certificate exception and corrected `wss2` viewer links. These changes belong to the separate Flutter repository; the original installed 5.0.103 TLS failure above remains valid. The desktop receiver was isolated Chromium 153, trusting only the test certificate's public-key fingerprint. These runs qualify connection establishment, not full release quality or internet-disconnected operation.

| Configuration | Result | Evidence / limit |
|---|---|---|
| Offline viewer defaults, Speedify enabled | FAIL | 75 seconds, zero media. Runtime browser configuration was empty; only local candidates were available. The app obtained public TURN allocations, but no ICE path completed. |
| Offline viewer defaults, Speedify paused | PASS, connectivity | App advertised its Wi-Fi UDP address; desktop initiated a working connection with video and built-in microphone audio. `.local` lookup still failed in a separate phone check; this does not prove discovery was repaired. |
| Numeric browser LAN candidates, Speedify enabled | PASS, connectivity | A working path was established with numeric LAN candidates. This does not establish that browser `.local` lookup works. |
| Viewer TURN over UDP, Speedify enabled | PASS, connectivity | Explicit URL override and relay policy: selected viewer relay, 1668 decoded video frames and positive microphone audio energy in 30 seconds. Zero RTP loss; 195 browser display drops. |
| Viewer TURN over TLS, Speedify enabled | PASS, connectivity | Explicit URL override and relay policy: selected viewer relay with TLS transport, 1306 decoded frames and positive microphone audio energy in 25 seconds. Zero RTP loss; 156 browser display drops. TLS describes viewer-to-TURN transport, not the phone's transport. |
| Viewer STUN only, Speedify enabled | PASS, connectivity | Explicit Google STUN with viewer TURN off: selected public-address direct connection, 1332 decoded frames and positive microphone audio energy in 25 seconds. Zero RTP loss; two reported freezes and 177 display drops. |
| Internet uplink disconnected / local TURN / USB microphone | NOT TESTED in this follow-up | Public candidates and an internal microphone cannot qualify these paths. |

The offline website's empty configuration intentionally skips automatic public STUN/TURN setup. The Flutter default independently fetches public TURN servers; an empty app TURN field does not disable that behavior. The tests demonstrate that adding usable public candidates to the viewer restores connectivity with Speedify enabled. The original relay failure is consistent with the app being unable to establish TURN peer permissions for unresolved browser addresses; the TURN server's permission table was not captured.

No website configuration, installer or runtime source changed for these probes. STUN/TURN was enabled only through isolated viewer URL options. Streams were stopped, phone test settings restored and Speedify left connected. Full receiver statistics and packet captures are retained outside Git in the Flutter checkout's `artifacts/offline-handshake-20261004/`; its `docs/release-coverage.md` records the detailed investigation. See [hybrid instructions](../README.md#optional-hybrid-use-with-internet-access) for the URL options.

## Reproduce the automated checks

From this repository with Node.js 22+ and OpenSSL on PATH:

```sh
npm ci --omit=dev
npm test
```

Tests run one at a time. Their temporary certificates and website fixtures are under ignored `.test-output/`, use loopback connections, and are cleaned up after the suite. They do not install a CA into the operating system. The routing suite passed nine functional tests on Windows and Ubuntu/WSL, with a permissions test explicitly skipped on filesystems without POSIX-mode support. It also checks migration of the earlier helper's deployment block to `customWSS = false`.

The additional installer/browser runs used the ignored `site/` and `.test-output/` directories. They did not modify a sibling VDO.Ninja or Flutter checkout. Generated image prompts and provenance are recorded in [images/README.md](images/README.md).

## Dependency review

During review of dependency PR #7, the older proposed versions were superseded by **Express 4.22.3 and ws 8.22.0**, retaining the existing major versions. The regenerated lock includes patched transitive dependencies, including `qs` 6.16.0 and `path-to-regexp` 0.1.13. `npm audit` reported **zero vulnerabilities** after this update on 2026-10-04.

The dependency versions were checked against the npm registry and upstream release notes. An audit result covers known advisories at that time, not every possible vulnerability. This server remains a small trusted-LAN example, not a security-audited public service; successful functional checks do not establish public-deployment safety.

After the update, a clean `npm ci --omit=dev --ignore-scripts` and all nine functional tests passed on Windows; the POSIX-permissions test was skipped as expected. The isolated browser smoke test again received 427×240 synthetic video over local WSS with `customWSS = false`, an empty ICE configuration and no page errors or external requests.

For issue #2, the installer was also run in a fresh fixture using Git Bash on Windows, invoked by absolute path from outside that fixture. It installed the locked dependencies from the correct directory and prepared the pinned website without a missing-`package.json` warning. This supplements the earlier Ubuntu/WSL installation check; it is not a new Ubuntu 20.04 physical-machine test.

## Before calling a physical installation complete

Verify root trust on each actual device, the exact HTTPS address, two-browser picture **and sound**, the same test with the internet uplink disconnected, startup after reboot if using systemd, and certificate renewal with the same root. For the app, record whether normal certificate verification or the custom-server exception was used. USB microphone and Android USB camera checks are deferred; verify the receiver when that work resumes. Record the OS/app versions used.
