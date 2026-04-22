# Licensing & ToS Research

**Status:** Research document. Not legal advice. Addresses issue #44 (MLB
licensing / ToS risk before monetization). A qualified sports-media / IP
attorney should confirm any conclusion drawn from this document before money
changes hands.

**Last reviewed:** April 2026

---

## TL;DR

Going to a paid model with the product as currently built is **Red**.

Two independent MLB terms documents each reserve commercial use:

1. **MLB.com Terms of Use** limits the site and its media to "personal,
   non-commercial home use" and explicitly prohibits redistribution of video
   "in any medium."
2. **The MLB Stats API copyright notice** (returned in every API response,
   hosted at `gdx.mlb.com/components/copyright.txt`) restricts the API to
   "individual, non-commercial, non-bulk use."

The product does three things that collide with those terms when monetized:

1. Polls `statsapi.mlb.com` on a schedule for every subscribed team (bulk,
   automated — arguably in tension with the Stats API terms even at the free
   tier).
2. Embeds MLB-hosted `.mp4` highlight URLs into emails delivered to paying
   users (direct redistribution of MLB's audiovisual content — the highest-risk
   surface).
3. Uses MLB and club trademarks (names, abbreviations; logos planned in #23).

Stats and names alone are defensible (*C.B.C. Distribution v. MLBAM*, 8th Cir.
2007). Video redistribution and logo use in a paid product are not.

---

## What the product does today

Relevant code paths:

- `lib/mlb.js` — fetches `statsapi.mlb.com/api/v1/schedule` and
  `/api/v1/game/{pk}/content`, extracts playback URLs.
- `app/api/cron/route.js` — runs on a Cloudflare cron, loops subscribed teams,
  sends emails containing the MLB-hosted playback URL.
- `lib/teams.js` — MLB team names, abbreviations, colors.

No user-hosted or user-uploaded content. Every media asset is MLB's, linked
directly from MLB's CDN.

---

## 1. MLB Stats API (`statsapi.mlb.com`)

**No public developer program, no API keys, no self-serve commercial tier.**
The endpoint powers MLB.com, the MLB mobile app, and Gameday, and is widely
used by hobbyist libraries (`MLB-StatsAPI` (Python), `pybaseball`, etc.).

Every response includes a `copyright` field pointing to
`http://gdx.mlb.com/components/copyright.txt`, which states (paraphrased from
multiple public sources, since the URL itself is not currently fetchable from
this environment):

> Only individual, non-commercial, non-bulk use of the Materials is permitted
> and any other use of the Materials is prohibited without prior written
> authorization from MLBAM.

> Authorized users of the Materials are prohibited from using the Materials in
> any commercial manner other than as expressly authorized by MLBAM.

**Practical reading:** a free, open API has been tolerated for hobby use for
~15 years. That tolerance is not a license. A subscription product built on
top of it is outside the stated terms.

**Official commercial path:** Sportradar is MLB's exclusive official data and
AV distributor (extended through 2032 in the Feb 2025 announcement). It is
enterprise-sales, priced for sportsbooks and media companies. No public tier
exists for indie developers.

---

## 2. MLB.com Terms of Use — verbatim clauses

Source: <https://www.mlb.com/official-information/terms-of-use>. Quoted
verbatim from the published ToU:

**Personal / non-commercial use:**

> Except for downloading one copy of the MLB Digital Properties on any single
> device for your personal, non-commercial home use, you must not reproduce,
> prepare derivative works based upon, distribute, perform or display the MLB
> Digital Properties without first obtaining the written permission of MLB.

**Redistribution of video / third-party content:**

> Third party text, photo, graphic, audio and/or video material contained on
> or incorporated in the MLB Digital Properties shall not be published,
> broadcast, rewritten for broadcast or publication or redistributed directly
> or indirectly in any medium.

**Services and products:**

> The Services and all other products offered via the MLB Digital Properties
> are provided for your private, non-commercial use, and you may not
> distribute, modify, translate, rebroadcast, transmit, stream, perform or
> create derivative works of them.

**Practical reading:** embedding an MLB-hosted `.mp4` URL in an email to a
paying subscriber is "redistribution in a medium." Even framing the email as
"we just include a link" is weak — the ToU scope covers indirect
redistribution.

---

## 3. Trademarks: team names, abbreviations, logos

**Names and abbreviations** (e.g., "Yankees", "NYY") in editorial/descriptive
context generally fit *nominative fair use* in the U.S. (*New Kids on the
Block v. News America Publishing*, 9th Cir. 1992). Three conditions:

1. The product/service isn't readily identifiable without the mark.
2. Only as much of the mark is used as is necessary.
3. Nothing suggests sponsorship or endorsement by the mark holder.

A disclaimer ("not affiliated with MLB or any club") and avoiding decorative /
marketing use of logos helps. Commercial fantasy and stats products have
survived on this theory plus the *C.B.C. Distribution* ruling (see below).

**Logos** are different. Registered marks owned by MLB Properties and the
individual clubs. Not fair use. Commercial use requires a license. **Issue
#23 (team logos) is blocked until a license exists or an alternative
iconography is chosen.**

---

## 4. Relevant precedents

- ***C.B.C. Distribution & Marketing v. MLBAM***, 505 F.3d 818 (8th Cir. 2007),
  cert. denied. Holds that player names and statistics are facts protected by
  the First Amendment against right-of-publicity claims; a paid fantasy
  product using names and stats without a license is lawful. *This protects
  stats and names but does **not** extend to video.*
- **MLB DMCA takedowns of GIF/clip Twitter accounts** (2015–2018, e.g.,
  @PitchingNinja). MLB has consistently used DMCA to remove user-posted clips
  of broadcast footage, regardless of whether the use is arguably fair use.
  Demonstrates an active enforcement posture against video redistribution,
  even short clips, even non-commercial.
- **Sportradar exclusivity** (2019, extended 2025 through 2032). MLB has
  publicly signalled that commercial data/AV distribution goes through one
  partner. That partnership's existence is itself evidence of MLB's position
  on who may legally redistribute.

---

## 5. Competitor landscape

| Operator | Video? | Paid? | Licensed? |
|---|---|---|---|
| MLB.TV / MLB's "Morning Lineup" newsletter | yes | yes / no | first-party |
| The Athletic MLB | no (text only) | yes | N/A |
| Baseball Savant | yes (Statcast) | no | MLB-operated |
| FanGraphs, Baseball Reference | no video | mixed | stats-only, licensed where applicable |
| r/baseball highlight bots, `@MLBGIFs`-style accounts | yes | no | no (historically DMCA'd) |
| Prior "spoiler-free MLB recap" newsletters | yes | mostly no | no (have come and gone) |

**No paid, unlicensed, openly-operating service that redistributes MLB video
was identified.** This is the most telling data point: either no one has
built it, or the ones who did were shut down.

---

## 6. Decision matrix

Framed against the original issue's Green / Yellow / Red options.

### Red — current architecture + paid subscription

Not recommended. Runs against both ToU documents simultaneously. High C&D /
DMCA risk. No viable "we'll just pay MLB" escape hatch at indie scale.

### Yellow — stay free, add a tip jar, keep current architecture

Reduces (but does not eliminate) risk. The ToU prohibitions on redistribution
are not contingent on payment — they apply to "any medium." A tip jar does,
however, substantially weaken any "commercial enterprise" framing in a
potential dispute and aligns with how most existing fan projects operate.
Combine with:

- Prominent non-affiliation disclaimer on every email and page footer.
- Attribution ("Video: MLB.com") on every embedded link.
- Response plan for any takedown notice (respond promptly, remove promptly).
- No logos. Editorial use of team names only.

### Green — relicense / repivot

Three realistic paths to a paid product:

1. **License from Sportradar / MLB directly.** Viable only if the product
   reaches enterprise scale. Budget five to six figures annually minimum
   based on public comparables. Not realistic for an indie project as a
   starting point.
2. **Pivot to user-submitted links.** Users paste a highlight URL they found;
   the product schedules a spoiler-free delivery. Moves the redistribution
   decision to the user. Still not clean (the product is still facilitating
   redistribution), but changes the legal posture meaningfully.
3. **Pivot to a sport with cleaner rules.** NCAA baseball, independent
   leagues (e.g., Atlantic League), international leagues (NPB, KBO). Smaller
   audience, fewer ToU traps, sometimes genuinely public-domain-ish footage.

---

## 7. Recommendations (for the owner, not legal advice)

Ordered by what to do next.

1. **Do not ship a paid subscription on the current architecture.** Close or
   defer issue #23 (team logos) for the same reason.
2. **Stay in free / tip-jar mode** while monetization questions are open.
   Add clear non-affiliation language and attribution to the email template.
   ✓ *Done (issue #51): non-affiliation disclaimer and "Video: MLB.com" attribution added to
   every email and the landing page. Buy Me a Coffee tip jar link added (set `BMC_URL` env var
   after creating the account).*
3. **Consult an IP / sports-media attorney before any paid launch.**
   ~$500–$1,500 of scoped consultation is cheap relative to the cost of a
   pivot after paying customers exist. Specific questions to bring:
   - Does embedding an MLB-hosted playback URL (not the video bytes) in a
     paid email count as "redistribution" under the ToU?
   - Is the Stats API copyright notice contractually enforceable against a
     user who never clicked through an agreement?
   - What is the right way to frame a tip-jar model to minimize risk?
4. **Have a takedown response plan.** A single email inbox monitored daily,
   and a one-click "pause all sends" switch, beat any legal argument.
   ✓ *Done (issue #51): kill switch implemented via `EMAILS_PAUSED` env var (set to `"true"` in
   Cloudflare dashboard for instant pause, no redeploy). Abuse inbox: `abuse@ninthinning.email`.
   See [`INCIDENT.md`](./INCIDENT.md) for the full response plan and SLA.*
5. **Re-evaluate this document annually,** or whenever MLB updates its ToU
   or Sportradar partnership terms.

---

## Sources

- MLB.com Terms of Use — <https://www.mlb.com/official-information/terms-of-use>
- MLB Stats API copyright notice — <http://gdx.mlb.com/components/copyright.txt>
  (not always reachable; quoted via community sources and API `copyright`
  field)
- MLB Stats API docs landing — <https://statsapi.mlb.com/> and
  <https://docs.statsapi.mlb.com/>
- MLB × Sportradar partnership extension (Feb 2025) —
  <https://www.mlb.com/press-release/mlb-and-sportradar-announce-official-exclusive-global-partnership>
- *C.B.C. Distribution & Marketing, Inc. v. MLBAM*, 505 F.3d 818 (8th Cir.
  2007). Summary: <https://jolt.law.harvard.edu/digest/major-league-baseball-advanced-media-v-cbc-distribution-and-marketing>
- MLB DMCA action against @PitchingNinja (Techdirt, 2018) —
  <https://www.techdirt.com/2018/04/18/stupid-copyright-mlb-shuts-down-twitter-account-guy-who-shared-cool-mlb-gifs/>
- Marquette Sports Law Review, "Fair Use of Foul Balls: MLB Advanced Media" —
  <https://scholarship.law.marquette.edu/cgi/viewcontent.cgi?article=1695&context=sportslaw>
