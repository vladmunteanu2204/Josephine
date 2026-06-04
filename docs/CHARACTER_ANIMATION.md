# Josephine & Narya — Character + Animation Spec (AI-only pipeline)

Goal: make **Josephine** (the guide) and **Narya** (her Australian Shepherd) feel
*alive* across the app — **without an illustrator and without 3D**. We pre-generate
a small library of short looping clips with AI and swap them by app state. No
real-time AI cost, no per-user cost.

**Decisions locked (owner):** fully **stylized cohesive world** (characters AND
scenery move to a painterly look); start with **prompts + spec** before any code.

> Why not 3D / Tripo3D: the bottleneck is rigging+animation, not mesh resolution.
> AI video skips rigging entirely. Why stylized: painterly animates far better than
> photoreal (no uncanny valley in motion), hides AI artifacts, and is ownable/shareable.

---

## 1. Visual direction — "South Tyrol storybook"

Warm, hand-painted 2D, **Studio-Ghibli-meets-the-Dolomites**: soft volumetric
golden-hour light, painterly brush texture, gentle film grain, soft edges (not
flat-vector, not 3D render, not photoreal).

**Palette (match the app tokens):**
- Forest greens `#1f2d27` / `#2d4a3e`
- Warm gold `#c9a84c` / `#d4a05a`
- Cream `#f0ece6`
- Dawn peach/pink skies for warmth

## 2. The "character lock" (paste into EVERY prompt)

Consistency is 80% of success. Generate ONE master reference first, then use it as
the image reference for every clip. Keep this block appended verbatim:

> **Josephine** — South Tyrolean mountain guide, late 20s, light-brown hair in a
> loose side braid, warm calm friendly face, forest-green soft-shell jacket over an
> oatmeal base layer, slim earth-tone hiking trousers, a small brass/gold accent.
> **Narya** — blue-merle Australian Shepherd, tan-and-white points, one ice-blue
> eye, alert and friendly. Painterly Ghibli-style alpine storybook, warm golden
> light, muted forest-green/gold/cream palette, soft brush texture, gentle grain.

---

## 3. Generation pipeline (do in this order)

### Step A — Master reference (text-to-image)
Tool: Midjourney v6 (use `--cref`/`--sref` for consistency) or Flux. Produce a
clean front/3-quarter two-shot. Lock the seed/style you like.

```
Hand-painted 2D character illustration, warm Studio-Ghibli-inspired alpine
storybook style, soft volumetric golden-hour light, painterly brush texture,
gentle film grain, soft edges. Full-body two-shot, three-quarter view, looking
toward viewer, neutral friendly pose:
<PASTE CHARACTER LOCK>
Soft clean background with subtle Dolomite peaks in bokeh, dawn-peach sky.
Character-design-sheet clarity, highly consistent, detailed faces.
--ar 4:5 --no text, watermark, logo, extra fingers, harsh black outlines, 3d render, photoreal, plastic skin
```
Also generate from the same seed: a **head-and-shoulders** crop (for the chat
avatar) and a **side profile walking** pose (for the trail). Save the best as the
canonical references.

### Step B — The clip library (image-to-video)
Tool: Kling 1.6 / Runway Gen-3 / Hailuo(MiniMax) / Luma. **Feed the Step-A
reference as the input image.** Rules for consistency: lock the camera (no zoom/pan),
keep it ONE continuous shot, 2–4s, ask for a **seamless loop**, regenerate if the
face/dog morphs.

| state | use in app | prompt (image-to-video, + character lock) |
|---|---|---|
| `idle` | chat avatar at rest, trail page | "Subtle living portrait: Josephine breathes gently and blinks, faint warm smile; Narya shifts slightly, ears twitch, one slow tail wag. Locked camera, minimal motion. Seamless 3s loop." |
| `thinking` | while Josephine is 'typing'/loading | "Josephine tilts her head, glances aside thoughtfully as if recalling a trail; Narya perks her ears and looks up at her. Gentle, curious. Locked camera. Seamless 3s loop." |
| `delight` | a plan/answer just arrived | "Josephine's face brightens into a warm genuine smile and a small approving nod; Narya wags her tail and gives a little bounce. Joyful but gentle. Locked camera. Seamless 3s loop." |
| `walking` | live-trail map companion | "Side three-quarter view: Josephine and Narya walk forward together along a soft alpine path, gentle bob, Narya trotting beside her, content. Loopable walk cycle, subtle parallax. 3s." |
| `celebrate` | summit / hike complete | "Josephine raises a hand in quiet celebration with a big warm smile; Narya spins once and jumps for joy. Soft golden larch-needles drifting like confetti. Locked camera. 3s loop." |

Optional later: `concerned` (off-trail/caution), `sleeping` (night/idle).

### Step C — Hero / splash (one-off, higher fidelity)
```
Cinematic wide painterly Ghibli alpine: Josephine and Narya stand on a ridge at
dawn looking out over the misty Dolomites, larch forests below, soft golden light,
gentle wind in hair and fur. Slow subtle push-in. <CHARACTER LOCK>. 5s, loopable.
--ar 16:9
```

### Step D — Scenery restyle (progressive, for the "cohesive world")
Going fully stylized means trail/hut hero images move to the same painterly look —
but do this **gradually** (it's a lot of assets). Re-generate trail heroes over time
with: `painterly Ghibli-style South Tyrol <place>, golden light, muted green/gold/cream`.
Characters + splash + chat first; scenery can follow.

---

## 4. Technical asset spec (what to export for the code)

The avatar is shown in **circular** frames (chat, map), so frame the characters
centered with a soft painterly background we can crop to a circle (no transparency
needed — a solid/soft bg reads fine inside the circle).

| file | dims | length | budget | notes |
|---|---|---|---|---|
| `public/josephine/idle.webm` (+ `.jpg` poster) | 512×512 | 2–4s loop | ≤400 KB | circular-safe framing |
| `public/josephine/thinking.webm` (+poster) | 512×512 | 2–4s | ≤400 KB | |
| `public/josephine/delight.webm` (+poster) | 512×512 | 2–4s | ≤400 KB | |
| `public/josephine/walking.webm` (+poster) | 512×512 | 2–4s | ≤500 KB | side framing |
| `public/josephine/celebrate.webm` (+poster) | 512×512 | 2–4s | ≤500 KB | |
| `public/josephine/hero.webm` (+poster) | 1920×1080 | 4–6s | ≤2.5 MB | splash/onboarding |

- **Format:** export `webm` (VP9). Also keep an `mp4` (H.264) fallback for Safari if
  needed. Each clip ships with a **`.jpg` poster** (a single frame) for the
  static fallback.
- **fps:** 24–30. **Loop:** seamless (first frame ≈ last frame). Mute, no audio.
- **Compress:** `ffmpeg -i in.mp4 -c:v libvpx-vp9 -b:v 0 -crf 34 -an -vf scale=512:512 idle.webm`
  (raise `-crf` toward 40 to shrink; check quality).
- **Naming is the contract** — exact paths above let the player pick them up with
  zero code change.

---

## 5. What I (the code) will build next — `<JosephineAvatar>`

Once a couple of clips exist, I'll build a reusable component:
`<JosephineAvatar state="idle|thinking|delight|walking|celebrate" size=… />`
- Plays the matching clip, **cross-fades** on state change.
- **Static `.jpg` poster fallback** when: `prefers-reduced-motion`, save-data, slow
  connection, or a clip is missing → so it degrades to today's static portrait.
- Lazy-loads; never blocks the UI; pauses offscreen.
- Drop-in wiring: chat avatar (`idle`→`thinking` while typing→`delight` on a plan),
  live-trail map companion (`walking`, `celebrate` at summit), completion card.

So: **you generate the clips from §3; I make them come alive at the right moments.**

---

## 6. Risks / guardrails
- **Consistency** is the hard part — same reference image, short locked-camera clips,
  regenerate drift. Build a small "approved frames" set before scaling.
- **Performance** — keep clips tiny, posters always present, honor reduced-motion.
- **Cohesive-world cost** — restyling ALL scenery is large; phase it (characters +
  splash + chat first). The app must look intentional at every step, not half-migrated.
- **Animation never changes Josephine's words** — her copy still comes from the
  deterministic layers; we only animate delivery (never-fabricate intact).
- **Quality bar** — a bad clip looks worse than a clean static image. Ship a state
  only when its clip clears the bar; the poster fallback covers the rest.
