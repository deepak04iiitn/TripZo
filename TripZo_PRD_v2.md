# 🗺️ TripZo — Product Requirements Document
**Version 1.0 · 2025 · Confidential**

> *Explore More. Waste Less Time. Travel Smart.*

---

## Table of Contents

| # | Section |
|---|---------|
| 01 | [Product Overview](#01-product-overview) |
| 02 | [Problem Statement](#02-problem-statement) |
| 03 | [Product Vision and Goals](#03-product-vision-and-goals) |
| 04 | [Target Users](#04-target-users) |
| 05 | [Key Value Proposition](#05-key-value-proposition) |
| 06 | [Core Features — MVP](#06-core-features--mvp) |
| | [6.1 Smart Itinerary Generator](#61-smart-itinerary-generator) |
| | [6.2 Multi-Day Itinerary Generation](#62-multi-day-itinerary-generation) |
| | [6.3 Route Optimization](#63-route-optimization) |
| | [6.4 Map Visualization](#64-map-visualization) |
| | [6.5 Restaurant Recommendations](#65-restaurant-recommendations) |
| | [6.6 Nearby ATM Suggestions](#66-nearby-atm-suggestions) |
| | [6.7 Trip Progress Mode](#67-trip-progress-mode) |
| | [6.8 Traveler Notes and Reviews](#68-traveler-notes-and-reviews) |
| | [6.9 Private Notes](#69-private-notes) |
| | [6.10 Shareable Itineraries](#610-shareable-itineraries) |
| 07 | [Algorithms and Technical Logic](#07-algorithms-and-technical-logic) |
| 08 | [Technical Architecture](#08-technical-architecture) |
| 09 | [UI / UX Design Theme](#09-ui--ux-design-theme) |
| 10 | [Success Metrics and KPIs](#10-success-metrics-and-kpis) |
| 11 | [Monetization Strategy](#11-monetization-strategy) |

---

## 01 Product Overview

TripZo is a **smart travel planning mobile application** that helps users plan and optimize their trips efficiently — whether exploring a city for a few hours, a full day, or multiple days. The app automatically generates **optimized travel itineraries** based on location, travel preferences, available time, and nearby attractions.

### Core Capabilities

| Capability | Description |
|---|---|
| **Route Optimization** | Calculates the most efficient visiting order to minimize total travel time and distance between attractions. |
| **Restaurant Finder** | Suggests budget-appropriate dining spots after every 2–3 sightseeing locations along your route. |
| **Live Trip Progress** | Real-time tracking with mark-visited, skip-location, and auto route recalculation features. |
| **Shareable Itineraries** | One-tap link sharing so travel companions can import and sync any trip plan instantly. |
| **Community Tips** | Real traveler notes and upvoted insights surface authentic, up-to-date local knowledge. |
| **ATM Finder** | Shows nearby ATMs with bank name and walking distance so you are never caught without cash. |

---

## 02 Problem Statement

Travelers planning trips face consistent, unsolved frustrations. Current tools are either too generic, too manual, or ignore real-world constraints — leading to wasted time and missed experiences.

| Problem | Description |
|---|---|
| 🔴 **Unoptimized Routes** | Attractions visited in random order cause exhausting back-and-forth travel across the city. |
| 🟠 **Generic Recommendations** | Travel blogs offer one-size-fits-all lists with no adaptation to real-time location or schedule. |
| 🟣 **No Smart Scheduling** | Existing planners ignore visit durations, opening hours, and real distances between places. |
| 🔵 **Missing Essentials** | Finding restaurants, ATMs, and services mid-trip is disruptive and ruins the flow of travel. |
| 🟢 **Missed Attractions** | Poor planning causes travelers to run out of time or skip key destinations entirely. |

---

## 03 Product Vision and Goals

> *"To become the world's smartest travel companion — turning any trip into a perfectly optimized adventure."*

### Strategic Goals

- Help users **plan efficient, optimized trips** with minimal manual effort
- Enable travelers to **explore more places** by dramatically reducing wasted transit time
- Surface **real traveler insights** from a growing community to enhance trip quality
- Build a **scalable platform** supporting short city hops and extended multi-day vacations
- Become the **default travel companion** for solo travelers, tourists, and backpackers globally

---

## 04 Target Users

| User Segment | Profile | Primary Use Case | Trip Duration |
|---|---|---|---|
| **Tourists** | Visiting an unfamiliar city | Discover top landmarks efficiently | 1–3 days |
| **Backpackers** | Budget multi-city travelers | Pack maximum sights on a tight budget | Multi-day |
| **Solo Travelers** | Independent, self-guided | Safe, structured solo exploration | Any |
| **Business Travelers** | Limited free-time windows | Quick, efficient city highlights | 2–4 hours |
| **Local Explorers** | Residents rediscovering home | Find hidden gems and new local spots | Half-day |
| **Weekend Warriors** | Short-getaway enthusiasts | Pack a full experience into two days | 1–2 days |

---

## 05 Key Value Proposition

| Value | Description |
|---|---|
| ⏱️ **Save 40% Travel Time** | Automated TSP-based route optimization eliminates unnecessary back-and-forth transit between attractions. |
| 📅 **Smart Multi-Day Planning** | Automatically distributes attractions across days keeping each day geographically compact and time-balanced. |
| 🌍 **Discover More Places** | Surface hidden gems and community-vetted tips that go far beyond standard tourist guides and travel blogs. |
| 🤝 **Community Intelligence** | Real traveler notes and upvoted tips provide authentic, seasonally-relevant, up-to-date local insights. |
| 📲 **All-in-One Companion** | Maps, restaurants, ATMs, and progress tracking — everything a traveler needs in a single seamless app. |
| 🔗 **Instant Trip Sharing** | One-tap shareable links let travel companions sync plans or import complete itineraries instantly. |

---

## 06 Core Features — MVP

These ten features form TripZo's Minimum Viable Product, selected to deliver maximum user value from day one with clear expansion paths in future releases.

---

### 6.1 Smart Itinerary Generator

The core engine. Builds a complete, ready-to-use travel plan by analyzing location, time budget, attraction data, and opening hours simultaneously.

| Input | Description |
|---|---|
| **User Location** | GPS-detected or manually entered starting point |
| **Available Time** | 4 Hours · 1 Day · 2 Days · 3 Days · Custom |
| **Nearby Attractions** | Fetched via Google Places API by type and proximity |
| **Opening Hours** | Closed attractions are automatically excluded from results |
| **Visit Duration** | Pre-estimated by type: 45 min museum, 20 min monument, etc. |

**Trip duration options:** `4 Hours` · `1 Day` · `2 Days` · `3 Days` · `Custom`

---

### 6.2 Multi-Day Itinerary Generation

Clusters geographically nearby attractions into the same day, ensuring balanced schedules and minimal daily travel distances across a 2–3 day trip.

**Example — Delhi 2-Day Trip:**

| Day | Attraction | Visit Time |
|---|---|---|
| Day 1 | Red Fort | 60 min |
| Day 1 | Jama Masjid | 45 min |
| Day 1 | Chandni Chowk | 90 min |
| Day 2 | Lotus Temple | 50 min |
| Day 2 | Humayun's Tomb | 60 min |
| Day 2 | India Gate | 45 min |

---

### 6.3 Route Optimization

Calculates the optimal visiting order for all selected attractions, cutting unnecessary transit. The comparison below shows a real-world impact for a Delhi trip.

| Without TripZo (Random Order) | With TripZo (Optimized Order) |
|---|---|
| Red Fort → India Gate → Jama Masjid → Chandni Chowk | Red Fort → Jama Masjid → Chandni Chowk → India Gate |
| ❌ ~28 km total distance | ✅ ~14 km total distance **(50% reduction)** |

---

### 6.4 Map Visualization

- Interactive map with all itinerary stops plotted and connected by route lines
- Color-coded markers: Attractions (coral pin), Restaurants (fork), ATMs (bank icon)
- Real-time blue dot showing the user's current GPS position
- Tap any marker to see attraction details, hours, and estimated visit time

**Marker Key:**

| Marker | Type | Color |
|---|---|---|
| 📍 | Attraction | Coral `#FF6B6B` |
| 🍴 | Restaurant | Amber `#FFC947` |
| 🏧 | ATM | Sky Blue `#0EA5E9` |
| 🔵 | Current Location | Navy `#0F2044` |

---

### 6.5 Restaurant Recommendations

- Auto-inserted after every 2–3 sightseeing stops at a logical meal time
- Three budget tiers: **Low** (under ₹300), **Medium** (₹300–800), **Premium** (₹800+)
- Sourced from Google Places API filtered by proximity and rating
- Example suggestions in Delhi: Karim's, Al Jawahar, Haveli Dharampura

| Budget Tier | Price Range | Example (Delhi) |
|---|---|---|
| 🟢 Low Budget | Under ₹300/person | Karim's, Al Jawahar |
| 🟡 Medium Budget | ₹300–₹800/person | Haveli Dharampura |
| 🔴 Premium | ₹800+/person | The Spice Route, Lodi |

---

### 6.6 Nearby ATM Suggestions

- Displays ATM name, bank, and walking distance near each attraction
- Example: SBI ATM at 200m with tap-to-navigate walking directions
- Updated automatically based on current GPS location during the trip

---

### 6.7 Trip Progress Mode

- Live progress counter: e.g., **3 of 6 places completed**
- Single-tap to mark a location as visited and advance the route
- Skip any stop and the route recalculates automatically around it
- Shows next destination with ETA and turn-by-turn directions

---

### 6.8 Traveler Notes and Reviews

- Add short public tips visible to all users visiting the same place
- Upvote helpful notes to surface the most useful insights for others
- Photo spot callouts, crowd level tips, and seasonal advice from real travelers

---

### 6.9 Private Notes

- Personal notes visible only to the logged-in user
- Examples: *"Buy souvenirs here"*, *"Try the street food stall on the left"*
- Persists across sessions and syncs to user profile for next visit

---

### 6.10 Shareable Itineraries

- Unique shareable URL generated per itinerary: `tripzo.app/i/delhi-2-day-trip`
- Publicly viewable without requiring a TripZo account
- One-tap import for logged-in users to add the full plan to their trips
- Shared plan includes all stops, timings, route sequence, and meal slots

---

## 07 Algorithms and Technical Logic

TripZo's intelligence runs on two algorithms: **TSP-based route optimization** for finding the shortest efficient path through attractions, and a **Greedy Time Allocation** system for distributing stops across multiple days. Both run server-side in real time.

---

### 7.1 Route Optimization — TSP Approach

The core routing challenge is a variant of the **Traveling Salesman Problem**: find the shortest route that visits N attractions exactly once. Because exact TSP is O(n!), TripZo chains three heuristic methods for a near-optimal result in real time.

| Algorithm | Approach | Complexity | Role in TripZo |
|---|---|---|---|
| **Nearest Neighbor** | Start at user location, always visit the closest unvisited attraction next | O(n²) | Primary route generator — fast enough for real-time use |
| **Distance Matrix API** | Replace straight-line estimates with real road travel times including live traffic | API call | Accuracy layer — corrects for one-way streets and terrain |
| **2-Opt Optimization** | Post-generation pass: swap pairs of route edges that reduce total distance | O(n²) per pass | Route polish — typically cuts 10–20% additional distance |

#### Nearest Neighbor — Step by Step

| Step | Action |
|---|---|
| **1. Start** | Begin at the user's current GPS location as the trip origin point. |
| **2. Scan** | Query Distance Matrix API for travel time to all unvisited attractions. |
| **3. Pick** | Select the attraction with the shortest travel time as the next stop. |
| **4. Advance** | Mark it visited, move to that location, and repeat from Step 2. |
| **5. Complete** | Continue until all selected attractions have been visited exactly once. |
| **6. Polish** | Run 2-Opt passes to swap route segments and reduce total travel distance. |

---

### 7.2 Multi-Day Scheduling — Greedy Time Allocation

For multi-day trips, attractions are clustered by geographic proximity then greedily packed into each day's schedule up to a configured daily time limit before starting the next day.

| Step | Description |
|---|---|
| **Step 1: Estimate** | Calculate visit duration per attraction type plus inter-stop travel time |
| **Step 2: Cluster** | Group attractions by geographic proximity so nearby places share a day |
| **Step 3: Fill Day** | Greedily add to Day 1 until daily time budget is fully used |
| **Step 4: Overflow** | Remaining attractions roll to Day 2, and so on until all are scheduled |
| **Step 5: Insert Meals** | After every 2–3 stops, insert a restaurant recommendation slot |
| **Step 6: Validate** | Confirm each day meets minimum stops and does not exceed time limit |

---

## 08 Technical Architecture

TripZo is built on a modern, scalable stack optimized for mobile performance, real-time map interactions, and rapid feature iteration. The architecture cleanly separates the frontend, backend API, database, and third-party integrations.

### Stack Overview

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | React Native Expo | Cross-platform iOS and Android app with native performance. Renders interactive maps, itinerary views, and trip progress UI. Shared codebase accelerates iteration. |
| **Backend** | Node.js + Express.js | RESTful API server handling itinerary generation, route optimization, user management, and data persistence. Stateless design enables horizontal scaling. |
| **Database** | MongoDB | Document-oriented NoSQL store for user profiles, itineraries, traveler notes, and tips. Flexible schema accommodates dynamic itinerary structures without migrations. |
| **Auth** | Firebase Auth | Google Sign-In via Firebase Authentication. Handles OAuth token management, session persistence, and secure credential storage on-device. |
| **Maps** | Google Maps Platform | Maps SDK for visualization, Places API for attraction and restaurant data, Distance Matrix API for travel times, Directions API for route rendering. |

---

### Google Maps API Integration

| API | Purpose | Endpoint |
|---|---|---|
| **Maps SDK** | Render interactive map with markers and route polylines | Maps SDK iOS/Android |
| **Places API** | Fetch nearby attractions, restaurants, and ATMs by type and radius | `/place/nearbysearch/json` |
| **Distance Matrix** | Calculate real travel time and distance between all location pairs | `/distancematrix/json` |
| **Directions API** | Render turn-by-turn route polyline on the map canvas | `/directions/json` |

---

## 09 UI / UX Design Theme

TripZo's visual identity is built around **"Coastal Light"** — a modern premium light theme that feels warm, energetic, and trustworthy. Inspired by the spontaneity of travel and the clarity of a sunny day, it pairs a crisp white canvas with a coral-to-amber gradient signature, deep navy typography, and sky-blue functional accents.

> *Coastal Light — Crisp white canvas · Coral-to-amber warmth · Deep navy ink · Sky-blue accents*

---

### Color Palette

| Swatch | Name | Hex Code | Usage |
|---|---|---|---|
| 🟥 | **Coral** | `#FF6B6B` | Primary brand. CTAs, active states, key highlights. |
| 🟧 | **Tangerine** | `#FF8E53` | Mid gradient. Secondary buttons, progress fills. |
| 🟨 | **Amber** | `#FFC947` | Warm accent. Badges, warnings, starred items. |
| 🟦 | **Navy** | `#0F2044` | Primary text, headers, nav bars. |
| 🔷 | **Navy Mid** | `#1E3A6E` | Section headings, card titles. |
| 🔵 | **Sky Blue** | `#0EA5E9` | Links, info states, map route line, chips. |
| 🟩 | **Emerald** | `#10B981` | Success, completed items, positive metrics. |
| 🟪 | **Violet** | `#8B5CF6` | Premium features, sharing, community badges. |
| ⬜ | **Snow** | `#F8F9FC` | Page background, all card backgrounds. |
| 🔲 | **Mist** | `#E2E8F2` | Borders, dividers, table stripes. |

#### Gradient Signature
```
linear-gradient(135deg, #FF6B6B 0%, #FF8E53 50%, #FFC947 100%)
```
Applied to: Hero headers · Primary CTAs · Progress bars · Cover backgrounds · Tab active indicators

---

### Typography System

| Role | Font | Size | Weight | Color | Usage |
|---|---|---|---|---|---|
| **Display / Hero** | Poppins | 32–48px | Bold | Navy `#0F2044` | Screen titles, hero text, cover |
| **Section Headings** | Poppins | 22–28px | SemiBold | Navy Mid | Major screen section titles |
| **Card Titles** | Poppins | 16–18px | Medium | Navy | Attraction names, feature headers |
| **Body Text** | DM Sans | 14–15px | Regular | Ink Mid `#374151` | All readable content, line-height 1.6 |
| **Captions / Labels** | DM Sans | 12–13px | Regular | Ink Soft `#6B7280` | Timestamps, distances, metadata |
| **Micro / Tags** | DM Sans | 11px | SemiBold | — | Uppercase, +0.5px letter-spacing, budget tags |

---

### Spacing, Radius and Shadow System

| Property | Value | Notes |
|---|---|---|
| **Base spacing unit** | `8px` | All padding and margin values are multiples of 8 (8, 16, 24, 32, 48) |
| **Card radius** | `16px` | Standard cards, attraction cards, tip cards |
| **Button radius** | `12px` | Primary and secondary action buttons |
| **Chip / tag radius** | `100px` | Pill shape for all status chips and budget tags |
| **Input radius** | `10px` | Search fields, text inputs |
| **Bottom sheet radius** | `24px` (top only) | Slide-up sheets and modals |
| **Card shadow** | `0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)` | Subtle lift, no heavy drop shadows |
| **Modal shadow** | `0 20px 60px rgba(15,32,68,0.18)` | Navy-tinted for depth without darkness |
| **Iconography** | Phosphor Icons | Filled for active, Regular for inactive — 24px minimum touch target |

---

### Key Screen Design Notes

| Screen | Design Notes |
|---|---|
| **Home / Onboarding** | Full-bleed coral-to-amber gradient hero with white wave curve. Floating location input card. Bold white CTA pill: "Start Planning". |
| **Itinerary View** | White card-per-stop list. Coral numbered step bubbles. Sky-blue time chips. Amber dividers for restaurant slots between stops. |
| **Map View** | Google Maps light style canvas. Custom coral attraction pins, teal restaurant markers, sky-blue ATM markers. Coral route polyline. |
| **Trip Progress Screen** | Full-screen map with floating bottom sheet showing current stop. Coral animated progress bar. Green checkmarks for completed stops. |
| **Community Tips Feed** | Card-per-tip layout sorted by upvotes. Coral upvote button. Violet verified-traveler badge. Muted gray time-since-visit label. |
| **Itinerary Share Sheet** | Clean modal with QR code and link preview. Coral map thumbnail card. Coral "Copy Link" CTA. WhatsApp and Instagram share shortcuts. |

---

## 10 Success Metrics and KPIs

### Key Targets at a Glance

| Metric | Target |
|---|---|
| Daily Active Users | Growing MoM |
| App Store Rating | 4.5+ stars |
| Monthly Churn Rate | < 10% |
| Avg Places Per Trip | 3+ stops |

### Full KPI Dashboard

| Metric | Priority | Description |
|---|---|---|
| **Itineraries Generated** | Primary | Core volume metric. Total trip plans created. Primary product health indicator. |
| **Daily Active Users (DAU)** | Primary | Measures retention and sustained ongoing engagement with the product. |
| **Trip Completion Rate** | Primary | Percentage of started trips marked complete. Reflects real-world usefulness. |
| **Shared Itineraries** | Growth | Viral coefficient. Organic word-of-mouth and referral growth driver. |
| **Avg Places Per Trip** | Quality | Reflects optimization quality. Higher count signals better route efficiency. |
| **Traveler Tips Submitted** | Community | Community health metric. More tips produce a richer, more authentic experience. |
| **App Store Rating** | Quality | Target 4.5 stars or above. Direct reflection of overall product quality. |
| **Monthly Churn Rate** | Health | Target under 10% monthly. Monitors long-term retention and delivered value. |

---

## 11 Monetization Strategy

TripZo follows a **freemium model**: the free tier delivers the full core experience to maximize adoption, while four revenue streams scale sustainably with the user base without compromising the free user experience.

---

### 💎 TripZo Pro — Subscription

- Unlimited multi-day itinerary generation *(free tier: single-day only)*
- Offline maps and downloadable itineraries for areas with no signal
- Advanced customization: pace settings, attraction type filters, custom start times
- Priority support and early access to new features before public release
- **Pricing:** ₹199/month  ·  ₹1,499/year *(2 months free)*

---

### 🤝 Restaurant and Venue Partnerships

- Featured placement in restaurant recommendations *(clearly labeled as Sponsored)*
- Exclusive TripZo-user discounts and offers from partner restaurants
- Commission earned on reservations completed directly through the app
- Tourism board partnerships for promoted attractions in new cities

---

### 🏨 Travel Bookings and Affiliate Revenue

- In-app hotel booking integration via Booking.com and Airbnb affiliate APIs
- Tour and activity bookings through GetYourGuide and Viator integration
- Commission per completed booking, typically **5–12% of booking value**
- Transport options: ride-booking integration via Ola and Uber APIs

---

### 📢 Sponsored Attractions and Advertising

- Promoted placement in itinerary generation results *(clearly labeled as promoted)*
- Sponsored pins on the map view for museums, parks, and new experiences
- Pay-per-impression model for tourism boards and local government clients
- City discovery cards featuring sponsored hidden gems and new venue openings

---

## Document Info

| Property | Detail |
|---|---|
| **Product** | TripZo |
| **Version** | 1.0 — MVP |
| **Prepared by** | TripZo Product Team |
| **Year** | 2025 |
| **Status** | Confidential |
| **Design Theme** | Coastal Light |
| **Stack** | React Native Expo · Node.js · MongoDB · Google Maps · Firebase |
| **Website** | tripzo.app |

---

*© 2025 TripZo · All rights reserved · Confidential*
