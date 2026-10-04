# Illustration source notes

These raster illustrations were generated with the built-in image-generation tool on 2026-10-04 and visually checked for labels and connection/trust meaning. They are conceptual illustrations, not screenshots. The accompanying Markdown carries the actionable instructions and alt text.

## local-network.png

Saved as `docs/images/local-network.png`.

Prompt:

```text
Use case: infographic-diagram. Create a polished raster educational illustration for a beginner VDO.Ninja offline installation README, landscape 1536x1024. Warm white background, very legible dark navy sans-serif type, restrained teal and amber accents, friendly softly shaded physical devices, lots of whitespace. Title exactly 'Your local VDO.Ninja setup'. Top center: a small Linux mini PC labeled 'Local server' and beneath it 'Website + handshake server'. Bottom left: a smartphone labeled 'Publisher'. Bottom right: a laptop labeled 'Viewer'. Draw teal two-way connector lines from each device to the server, each labeled 'HTTPS / WSS'. Draw a separate amber arrow directly from phone to laptop labeled 'Audio + video'. Bottom caption exactly 'All devices on the same local network'. Include no cloud, internet, extra devices, commands, or invented UI. The illustration must clearly communicate that the server introduces the peers while audio and video flow between the publisher and viewer on a typical LAN. No arrow from server labeled media. Use exact short labels only. No watermark.
```

## certificate-trust.png

Saved as `docs/images/certificate-trust.png`.

Prompt:

```text
Use case: infographic-diagram. Raster educational illustration for a beginner HTTPS guide. Landscape 1536x1024 warm white background, dark navy readable sans-serif type, teal accents, soft shaded paper and device illustrations. Title exactly 'Trust the root. Keep the keys private.' Two clear horizontal zones. Upper zone: a paper certificate with a teal seal labeled 'Root certificate' at left, an arrow labeled 'Signs' to a second paper labeled 'Server certificate' in center, then a small server at right labeled 'Used by your server'. Below the root certificate a downward arrow labeled 'Install a copy' points to a phone and laptop together in lower left, caption 'Devices trust your local CA'. In lower right a closed navy lockbox labeled 'Private keys' with caption 'Stay on the server'. Keep private keys visually separate from the installation arrow, no connection from keys to devices. Strong visual hierarchy, large simple labels, ample whitespace, exact text only, no fake settings UI or commands, no watermark. The meaning is root certificate is public and installed on client devices, while private keys must never be shared. Server certificates are signed by the local CA.
```
