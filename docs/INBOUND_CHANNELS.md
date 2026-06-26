# Inbound Channels — Photo Metadata Survival

Citizens can report via several channels. Each one preserves photo metadata
(specifically EXIF GPS) differently. This matters because `nagarik/geo/resolver.py`
prefers EXIF over browser GPS — but only when EXIF is present.

| Channel | EXIF GPS survives? | Browser GPS? | Strategy |
|---|---|---|---|
| **Web `/report` PWA** (current) | ✅ Yes — raw upload via Supabase signed URL | ✅ Yes — `navigator.geolocation` | Use both, EXIF wins. |
| **iOS native app** (future) | ✅ Yes if user picks from camera roll | ✅ Yes — CoreLocation | Use both, EXIF wins. |
| **Android native app** (future) | ✅ Yes — `MediaStore` preserves EXIF | ✅ Yes — FusedLocationProvider | Use both, EXIF wins. |
| **WhatsApp Business inbound** (future) | ❌ **NO — strips EXIF automatically** | ❌ N/A unless user shares Live Location | See below — must request live location. |
| **SMS gateway** (future) | ❌ NO — texts don't carry GPS | ❌ NO | Geocode the free-text address via Nominatim. |
| **Helpline (voice → transcript)** (future) | n/a | ❌ NO | Geocode + ask agent to confirm ward. |

## The WhatsApp problem

Meta's image processing pipeline strips ALL EXIF metadata before delivery to
the recipient — this is a privacy feature for users sending photos, and it
cannot be disabled. The receiver (us, on the Business API webhook) sees only
pixels, no GPS, no orientation, no original timestamp.

### Workaround

When a citizen sends a photo to our WhatsApp Business number with no
location attached, the bot replies:

> "Got the photo! To make sure the crew reaches you, please tap the
> paperclip → Location → Send your current location."

WhatsApp's Live Location and One-time Location messages DO carry coordinates
through to the Business API webhook. The geo resolver receives these as
`browser_lat` / `browser_lng` equivalents.

If the citizen refuses to share location, the bot asks for a free-text
landmark ("nearest cross / bus stop / shop name") and routes through the
Nominatim geocoder fallback in `nagarik/geo/geocoder.py`.

### Why we don't strip EXIF ourselves on the web flow

The /report PWA uploads raw bytes to Supabase Storage. We deliberately do
NOT strip EXIF before storage because:

1. EXIF is the most truthful location source — stripping would erase it.
2. The photo is only ever visible to ops + the assigned crew, not to the
   public. We're not publishing it.
3. After resolution we can run a `scripts/strip_exif.py` background job to
   anonymise resolved photos for archival.

### What HAPPENS to EXIF in our stack

```
Camera takes photo                  → EXIF embedded (GPS, time, camera model)
PWA upload to Supabase              → EXIF preserved (raw upload)
nagarik/geo/resolver.py reads bytes → extracts GPS, NOTHING ELSE
Photo stored in GCS/Supabase        → full EXIF intact
ResolutionAgent CLIP / CNN          → uses pixels only
After resolution (optional)         → run strip_exif.py to anonymise
```

## Geocoder fallback (already wired)

`nagarik/geo/geocoder.py` calls OSM Nominatim when both EXIF and browser GPS
are missing but the citizen typed an address. Nominatim is free, no API key,
and biased to the Bengaluru bounding box for precision. Low-confidence
results (`importance < 0.4`) get auto-flagged for ops review.

## HEIC support (already wired)

iPhone defaults to HEIC encoding. `pillow-heif` is now a dependency and is
auto-registered with PIL on first call. iPhone EXIF GPS now works without
the citizen having to "convert to JPEG" first.
