---
title: Surface Josephine's voice in trail detail pages — add a short editorial note per trail
---
# Add Josephine editorial trail notes

  ## What & Why
  Trail detail pages currently display facts and stats. The Josephine brand is built on warmth and local knowledge — a short one-or-two sentence "Josephine says" note per trail (e.g. "Best in late September when the larch trees turn gold.") would make the experience feel genuinely curated rather than just a database.

  ## Done looks like
  - Each trail in `backend/data/trails.json` has an optional `josephineNote` field (EN/IT/DE)
  - Trail detail page displays the note in a small styled callout attributed to Josephine
  - A handful of real trails already have notes written
  - Admin panel allows adding/editing the note field

  ## Relevant files
  - `backend/data/trails.json`
  - `web-frontend/src/components/TrailDetail.jsx`
  - `web-frontend/src/components/AdminPanel.jsx`
  - `web-frontend/src/locales/en.json` (new trailDetail.josephineNote key)