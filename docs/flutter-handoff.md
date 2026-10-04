# Flutter follow-up: tested Android candidate

The separate Flutter task implemented and tested a local **5.0.104 candidate** on Pixel 4a / Android 13. This is a development build, not a claim that the published app includes these changes. No Flutter files were edited by this deployment task. Both repositories retain uncommitted work; nothing was committed or pushed as part of this follow-up.

## What changed in the app

- An Advanced Settings certificate exception is **off by default** and applies only to the explicitly selected custom WSS host and port. Changing the endpoint clears it.
- The exception keeps encryption but skips certificate identity checks, including hostname and expiry checks. It does not install or trust a CA.
- There is no global TLS override, in-app CA importer or native WebRTC-fork change. Android API 21 support is preserved.
- Routed browser viewer links use `wss2=`. An explicitly entered salt is no longer overwritten when leaving the handshake field.

Installing the public root on each device remains the preferred setup. However, on this Android device, Dart still rejected the installed CA while Brave trusted it. The candidate's exception enabled the custom-server connection. Use it only for the server/network you trust; normal certificate verification remains the default.

## What was verified

The Flutter handoff reports certificate exception off/on/off behavior, endpoint isolation and saved-setting behavior. Direct publishing, room publishing, built-in microphone audio and recovery after a local signaling-server restart worked.

The release build passed, 88 focused tests passed, and analysis reported zero errors with existing warnings/info. One existing Meshcast accessibility failure was reproduced on untouched HEAD. These are functional results, not smoothness qualification: frame drops and other quality limits remain recorded in the Flutter evidence.

The original app **5.0.103** failed with `CERTIFICATE_VERIFY_FAILED: unable to get local issuer certificate` even after CA installation and a full restart. Its generated viewer link used `wss=`. Keep that historical result separate from the candidate's successful tests.

## Offline defaults remain unchanged

The website retains `session.configuration = {};` and does not automatically fetch public STUN/TURN servers. The native app independently fetches public TURN servers when its TURN field is empty or contains its placeholder.

With Speedify enabled, the ordinary offline viewer stalled despite successful signaling. Pausing Speedify allowed a working LAN connection; browser `.local` lookup still failed on the phone, so this did not establish that mDNS was repaired. Numeric browser LAN candidates also worked with Speedify enabled. Optional viewer STUN or TURN URL overrides restored media with Speedify continuously enabled.

See the [hybrid instructions](../README.md#optional-hybrid-use-with-internet-access) and [recorded evidence](validation.md#offline-and-hybrid-connectivity-follow-up). Successful internet-assisted tests do **not** establish internet-disconnected operation. An app-side TURN allocation alone does not prove that a usable relay path exists.

## Deferred checks

USB microphone receiver verification and Android USB camera testing are **on hold at Steve's request**. Built-in microphone success does not establish USB device support. A real internet-disconnected LAN test and optional iOS validation also remain unverified. No further app changes or device tests are requested by this documentation update.

## Development handoff record

The Flutter checkout's `docs/release-coverage.md` contains the detailed results. Its ignored `artifacts/offline-handshake-20261004/` directory contains test evidence. The locally built APK is `E:/vdon-android-api21/vdo-ninja-5.0.104-handshake.apk`; this is a development-machine path, not a public download.

At handoff, streams were stopped, the original stream ID and blank room/password were restored, the certificate exception was off, and Speedify was connected. The test server was left available at `https://10.0.0.9:18443` with the existing test certificate. Wi-Fi ADB was verified at `10.0.0.47:5555`; no USB microphone test followed. These are recorded handoff conditions, not a live availability check.
