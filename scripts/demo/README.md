# Product demo recorder (issue #127)

Generates a ~30 second product walkthrough as `demo.mp4` (Twitter/LinkedIn) and
`demo.gif` (Reddit) by screenshotting the real Next.js pages with headless
Chromium and stitching the frames together with ffmpeg + crossfades and
captions.

This is a **synthetic walkthrough**, not a raw screen recording — it captures
real UI but the dashboard auth flow is mocked so we can render the team grid
without a Supabase session, and the magic-link email is rendered standalone
rather than shown opening in Gmail.

## Prerequisites

- `ffmpeg` (system package)
- `puppeteer` (downloads its own Chromium): `npm install --no-save puppeteer`
- Two scaffolding routes that ship gated to `NODE_ENV !== 'production'`:
  - `app/api/demo-email/route.js` — returns rendered recap email HTML
  - `app/demo-dashboard/page.js` — renders the team-grid UI without auth

## How to regenerate

In two terminals (or one with the server in the background):

```sh
# 1. Start the dev server with stub Supabase env so the landing/login pages
#    render without real credentials.
NEXT_PUBLIC_SUPABASE_URL=https://stub.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=stub \
SITE_URL=http://localhost:3000 \
TIP_URL=https://example.com/tip \
FROM_EMAIL=highlights@ninthinning.email \
  npm run dev

# 2. Capture frames + build the video.
node scripts/demo/record.mjs       # writes scripts/demo/out/frames/*.png
node scripts/demo/build-video.mjs  # writes scripts/demo/out/demo.{mp4,gif}
```

Outputs land in `scripts/demo/out/` (gitignored). Upload the MP4 and GIF
wherever you need them — the issue suggests Drive/Dropbox, or commit to
`public/` if under 5 MB.

## Tweaking

- **Per-scene caption / duration**: edit the `scenes` array at the top of
  `build-video.mjs`. Total runtime is the sum of `dur` minus crossfade overlap.
- **Different team in the email**: pass `?teamId=147` (Yankees, etc.) when
  hitting `/api/demo-email`, and update the dashboard `?followed=...` ids in
  `record.mjs` to match.
- **Dimensions**: `W` and `H` constants in `build-video.mjs`. The email frame
  is captured at a smaller viewport (600×800) and letterboxed to match.
