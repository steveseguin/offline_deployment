# Optional internet-assisted connections

[Back to setup](../README.md)


The prepared website keeps `session.configuration = {};`, disabling its automatic public STUN/TURN setup. This is intentional for offline use. **Keep that line unchanged.** The following browser URL options enable internet assistance for that link only; removing them restores the offline defaults.

STUN helps a device discover its public address. TURN relays media when a direct connection cannot be established. Public STUN/TURN requires internet access; TURN media may leave the LAN. Neither option makes your private website or handshake server reachable from outside your network.

For a simple STUN-assisted viewer test, replace the address and stream ID in:

```text
https://192.168.1.28:8443/?view=lancheck&stun=stun%3Astun.l.google.com%3A19302&turn=off
```

This enables Google STUN and leaves TURN off **in that browser**. STUN alone cannot traverse every network.

For a relay fallback, use a TURN service you operate or are authorized to use:

```text
https://192.168.1.28:8443/?view=lancheck&stun=false&turn=USERNAME%3BPASSWORD%3Bturn%3Aturn.example.net%3A3478
```

Replace the example credentials and hostname. The decoded `turn` value is `USERNAME;PASSWORD;turn:turn.example.net:3478`; URL-encode the complete value, including special characters in credentials. This example disables separate STUN servers and explicitly configures TURN. For TURN over TLS, use `USERNAME;PASSWORD;turns:turn.example.net:443` instead. Use the ports supported by your service. TURN credentials in a link are visible to anyone receiving it; use credentials intended for those clients.

Append `&relay` only when testing that the relay path itself works; omit it for normal direct-or-relay selection. Keep existing stream, password and `wss2` parameters. For two-browser publishing, add the desired options to both browser links (use `push=lancheck` for the publisher). For the native VDO.Ninja app, configure its TURN field separately; these URL options belong on the viewer link, not in the app's handshake field.

A VPN can block local connections. Try pausing it, or use the STUN/TURN options above when internet is available. Configure each browser and the native VDO.Ninja app separately.

For genuinely offline operation, keep the defaults and establish a working LAN path, including checking VPN/client isolation. A local TURN relay is another possible deployment option, but is not included in this package. Public TURN cannot provide a fallback after the internet connection is removed.
