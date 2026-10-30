# VoxSetu

> **"A bridge for every voice, from complaint to action."**  
> *Independent AI-powered civic platform turning scattered citizen reports into prioritized, explainable, and trackable action.*

---

## 1. Setup and Run Steps

### Prerequisites
- Node.js (v20+ recommended)
- `GEMINI_API_KEY` (injected automatically in Google AI Studio or configured in `.env`)

### Installation & Execution
```bash
# Install dependencies
npm install

# Run full-stack dev server (starts Express backend + Vite frontend on port 3000)
npm run dev

# Run automated logic unit tests (Priority formula, Haversine distance, Hotspots)
npm test

# Build for production
npm run build
npm start
```

Open `http://localhost:3000` to access the application.

---

## 2. Architecture

VoxSetu operates across four unified stages: **Capture**, **Understand**, **Reveal**, and **Act**.

```
[ Citizen Web Client ] <====== Server-Sent Events (SSE) / Polling ====== [ Express Backend ]
   - Voice Input (Indic)                                                    - Gemini 3.8 Flash
   - Leaflet Pin Picker                                                     - Priority Engine (Code)
   - Real-time Tracker                                                      - Hotspot Engine (Union-Find)
   - "I'm affected too"                                                     - JSON File Persistence
```

- **Frontend:** React 19 + TypeScript + Tailwind CSS v4. Mobile-first responsive single-page architecture with large tap targets (44px+), visible focus rings, and Indic script typography (`Noto Sans` font family for Hindi, Kannada, Telugu and `Public Sans` for English).
- **Backend:** Node.js + Express JSON API under `/api`. All Gemini calls execute strictly server-side with user secrets protection.
- **Live Stream:** Server-Sent Events (SSE) at `GET /api/events`. Emits events for report creation, status transitions, duplicate linkage, and upvotes; frontend falls back to 5-second polling if disconnected.
- **Storage:** In-memory store on the server, saved to `data/reports.json` upon any mutation and loaded on startup. Includes `POST /api/reset-demo` to restore initial seed data.

---

## 3. The AI Approach: What Gemini Does vs. What Code Does

VoxSetu maintains strict separation between language perception (Gemini) and mathematical authority (Code) to ensure fairness, transparency, and eliminate AI hallucination in governance.

| Responsibility | Executed By | Rationale & Mechanism |
| :--- | :--- | :--- |
| **Language Detection & Summarization** | **Gemini 3.8 Flash** | Translates Indic languages (Hindi, Kannada, Telugu) and produces structured English + native summaries (max 25 words). |
| **5-Factor Evaluation (0–5)** | **Gemini 3.8 Flash** | Scores Safety Risk, People Affected, Vulnerable Location, Recurrence, and Duration with 1-sentence evidence citations. |
| **Priority Score & Banding** | **Deterministic Code** | Formula: `[(3×Safety) + (2×People) + (2×Location) + (1.5×Recurrence) + (1×Duration)] ÷ 47.5 × 100`. Bands: 70+ Critical, 50–69 High, 30–49 Medium, <30 Low. If Safety ≥ 4, band is promoted to at least High. |
| **Duplicate Candidate Filter** | **Deterministic Code** | Haversine distance calculation filters open reports within 150m in related categories. |
| **Duplicate Decision** | **Gemini 3.8 Flash** | Compares physical defect descriptions and photos. If confidence ≥ 0.7, merges under parent report. |
| **Hotspot Detection** | **Deterministic Code** | Union-Find algorithm clusters reports within 300m with ≥3 reports; calculates radius, trend, and score. |
| **Hotspot Action Brief** | **Gemini 3.8 Flash** | Synthesizes cluster metrics into an under-60-word tactical briefing for municipal commanders citing report IDs. |
| **Citizen Status Messages** | **Gemini 3.8 Flash** | Rewrites internal officer notes into friendly, respectful citizen notifications without inventing promises or dates. |

---

## 4. Related Work & Gaps VoxSetu Addresses

1. **Swachhata App (MoHUA, India):**
   - *Limitation:* Primarily photo-upload focused; handles complaints in silos without proactive duplicate clustering, multilingual AI triage, or transparent explainable score formulas.
   - *VoxSetu Advance:* Automatically groups duplicates, boosts recurrence scores from repeated reports, and explains *why* an issue was prioritized.
2. **FixMyStreet (mySociety, UK):**
   - *Limitation:* Basic map pin logging; lacks intelligent factor weighting (school proximity, active hazards, worsening trends) and requires manual municipal reading of every submission.
   - *VoxSetu Advance:* Gemini extracts structured factors instantly and provides automated tactical briefs for geographic hotspots.
3. **Traditional AI Helpdesk Triage Tools:**
   - *Limitation:* Opaque black-box classifiers that decide priority without explainability, prone to hallucinated priority ratings.
   - *VoxSetu Advance:* Zero black-box scoring. Gemini only extracts factual factor ratings (0–5); the score calculation is transparent and reproducible in code.

---

## 5. Honesty & System Limitations

- **Prototype Status:** VoxSetu is an independent prototype built for civic demonstration. It is not affiliated with, endorsed by, or connected to any government portal or municipal corporation.
- **What is Real:** Server-side Gemini API calls, deterministic priority math, Union-Find hotspot clustering, SSE real-time broadcast, multilingual translations, and photo compression.
- **What is Mocked/Simulated:** User login (bypassed for frictionless review), target resolution deadlines (labeled "sample targets"), and department dispatch.
- **AI Error Margins & Human Oversight:**
  - AI can misjudge priority factors or duplicates; authority officers have complete manual control to confirm or unlink duplicates and reassign teams.
  - Machine translations between Indic languages and English may lose colloquial nuances; original verbatim citizen text is always preserved side-by-side.
  - Hotspot clustering displays where connected citizens report, which may reflect reporting density rather than total physical problem severity in low-connectivity areas.

---

## 6. 5-Step Demo Script

Follow this step-by-step journey to evaluate the complete end-to-end flow:

1. **Submit a Report (Citizen View):**
   - In "Citizen View", describe an issue (e.g., *"Open drain overflowing with dirty water onto the road near the market"*), or use voice typing.
   - Tap the map to select coordinates or use current location.
   - Observe the "Similar reports nearby" card if existing issues exist within 150m.
   - Click **Submit Civic Report**.
2. **Review AI Result & "Why This Priority?":**
   - View the generated tracking code (e.g. `VS-7K3Q9`).
   - Examine the AI analysis card: detected category, native summary, and the 5-factor breakdown explaining the transparent score.
3. **Explore Hotspots and Gemini Action Brief (Authority View):**
   - Toggle to **Authority View** in the header.
   - Inspect the top insights strip (Active issues, Critical count, Hotspots).
   - On the Leaflet map, click a translucent blue/orange/red circle representing a hotspot cluster.
   - Read the **Gemini AI Action Brief** under 60 words explaining what is happening, what to fix first, and citing report IDs.
4. **Assign Team & Update Status:**
   - Select a report from the priority queue or map pin.
   - In the right-hand action panel, select an assigned team (e.g., *Drainage* or *Roads*).
   - Change status to **In progress** or **Resolved** and add an officer note.
   - Review the live preview of the citizen message. Click **Apply Status & Notify Citizen**.
5. **Live Citizen Tracking:**
   - Switch back to **Citizen View** -> **Track Status** tab (or open in another browser window/tab).
   - Enter the tracking code.
   - See the vertical timeline update live with the friendly translated message, countdown timer, and action buttons (*"Confirm Fixed"* / *"Reopen"*).
