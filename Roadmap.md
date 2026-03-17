# 🎯 ISS Earth Tracker — Kapsamlı Geliştirme Planı

---

## 📊 **Proje Durumu Özeti**

| Kategori | Durum | İlerleme |
|----------|-------|----------|
| **Core Features** | 26/31 Roadmap ✅ | 84% |
| **Visual Effects** | 15/17 ✅ | 88% |
| **UI/UX** | 6/6 ✅ | 100% |
| **Architecture** | 5/8 ✅ | 62% |
| **Error Handling** | ⚠️ Eksik | 0% |
| **Testing** | ⚠️ Eksik | 0% |
| **Performance** | ⚠️ Kısmi | 40% |
| **Accessibility** | ⚠️ Kısmi | 30% |
| **Mobile** | ⚠️ Kısmi | 50% |

---

# 🔴 PHASE 1: KRİTİK EKSIKLER (Foundation — 2 Hafta)

Ürün production'a hazır olmadan mutlaka tamamlanmalı.

## 1️⃣ Error Handling & User Feedback System
**Öncelik:** ⭐⭐⭐⭐⭐ (Kritik)
**Tahmini Zaman:** 3-4 saat
**Etki:** Robustness +90%, User confidence +75%

### Hedefler
- [ ] Global React Error Boundary (GlobeCanvas, MapCanvas, API errors)
- [ ] Toast/Notification system (success, warning, error, info)
- [ ] API error recovery (retry logic, exponential backoff)
- [ ] User-facing error messages (TR/EN)
- [ ] Error logging service (Sentry integration veya custom)

### Teknik Detaylar
```typescript
// components/ErrorBoundary.tsx
- Catch boundaries
- Fallback UI
- Error recovery button

// hooks/useNotification.ts
- useContext + createContext
- Toast queue
- Auto-dismiss + manual

// lib/errorHandler.ts
- API error codes
- Retry mechanism
- Offline detection
```

### Başarı Kriterleri
- [ ] All API calls have try/catch
- [ ] User sees error message, not blank screen
- [ ] 404/500 errors recoverable
- [ ] Network timeout handled gracefully

---

## 2️⃣ Offline Mode & Network Resilience
**Öncelik:** ⭐⭐⭐⭐⭐ (Kritik)
**Tahmini Zaman:** 2-3 saat
**Etki:** Reliability +80%, UX +60%

### Hedefler
- [ ] Service Worker (install, activate, fetch strategy)
- [ ] Cache-first strategy (static assets)
- [ ] Network-first + fallback (API calls)
- [ ] Offline indicator UI
- [ ] Cached data fallback (last 7 days ISS, weather)

### Teknik Detaylar
```typescript
// public/sw.ts (Service Worker)
- Workbox precache
- Runtime cache
- Offline response

// lib/cacheManager.ts
- IndexedDB storage
- Expiration logic
- Data versioning

// components/OfflineIndicator.tsx
- Network status listener
- Visual indicator + message
```

### Başarı Kriterleri
- [ ] App works offline (static view)
- [ ] Cached data shown with timestamp
- [ ] Service worker updates (skipWaiting)
- [ ] No console errors on offline mode

---

## 3️⃣ Mobile Responsiveness Audit & Fix
**Öncelik:** ⭐⭐⭐⭐⭐ (Kritik)
**Tahmini Zaman:** 2-3 saat
**Etki:** Mobile traffic +200%, UX rating +85%

### Hedefler
- [ ] Tablet/Mobile layout (325px - 768px - 1024px breakpoints)
- [ ] Touch-friendly controls (min 44x44px buttons/inputs)
- [ ] Responsive panels (stack vertically on mobile)
- [ ] Landscape/portrait auto-adjustment
- [ ] Haptic feedback (vibration API)

### Teknik Detaylar
```typescript
// Tailwind breakpoints
// components/ files
- sm: mobile (640px)
- md: tablet (768px)
- lg: desktop (1024px)

// lib/touchDetect.ts
- Touch event listeners
- Swipe gesture detection
- Double-tap zoom override

// public/manifest.json
- display: standalone
- viewport: width=device-width
```

### Başarı Kriterleri
- [ ] All panels readable on iPhone 12 mini
- [ ] No horizontal scrolling needed
- [ ] Touch targets >= 44px
- [ ] Landscape mode fully functional

---

## 4️⃣ Accessibility (WCAG 2.1 AA)
**Öncelik:** ⭐⭐⭐⭐ (Kritik)
**Tahmini Zaman:** 3-4 saat
**Etki:** User base +30%, Legal compliance ✅

### Hedefler
- [ ] Semantic HTML (heading hierarchy, landmarks)
- [ ] ARIA labels (buttons, regions, live regions)
- [ ] Keyboard navigation (Tab, Enter, ESC, Arrows)
- [ ] Focus indicators (visible outline 2px)
- [ ] Color contrast (AAA: 7:1 ratio)
- [ ] Screen reader testing (NVDA, iOS VoiceOver)

### Teknik Detaylar
```typescript
// components/
- <button>, <a> semantic tags
- aria-label, aria-describedby, aria-pressed
- <nav>, <main>, <region> landmarks

// app/globals.css
- :focus-visible { outline: 2px cyan }
- --text: {AAA compliant color values}

// lib/a11y.test.ts
- axe-core integration
- Color contrast checker
- ARIA validator
```

### Başarı Kriterleri
- [ ] axe DevTools: 0 violations
- [ ] Keyboard-only navigation works
- [ ] Screen reader announces all content
- [ ] Color contrast >= 7:1

---

## 5️⃣ State Persistence (LocalStorage/URL)
**Öncelik:** ⭐⭐⭐⭐ (Önemli)
**Tahmini Zaman:** 1-2 saat
**Etki:** UX retention +40%, Bookmarking +100%

### Hedefler
- [ ] LocalStorage persistence (moduleState, last location)
- [ ] Query parameters (lat, lon, zoom shareable)
- [ ] Session restoration (page refresh remembered)
- [ ] Favorites/bookmarks system

### Teknik Detaylar
```typescript
// hooks/usePersistence.ts
- useEffect save moduleState to localStorage
- useCallback restore on mount

// lib/urlParams.ts
- searchParams encode/decode
- router.push() with params

// components/Favorites.tsx
- Saved locations list
- Quick access buttons
```

### Başarı Kriterleri
- [ ] Refresh keeps modul state
- [ ] Share URL includes location
- [ ] localStorage < 10MB
- [ ] Favorites persist across sessions

---

# 🟡 PHASE 2: ÜSTÜNLÜKLERİ EKLENECEK ÖZELLIKLER (Enhancement — 3 Hafta)

Production launch sonrası eklenmesi istenen, kullanıcı deneyimini önemli ölçüde geliştirecek özellikler.

## A. Gelişmiş Harita Araçları
**Öncelik:** ⭐⭐⭐⭐ (Yüksek)
**Tahmini Zaman:** 3-4 saat
**Fayda:** Scientific + educational use cases

### Hedefler
- [ ] Distance measurement (iki nokta arası mesafe)
- [ ] Area selection (polygon/rectangle)
- [ ] Coordinate export (CSV, JSON)
- [ ] Grid overlay toggle (UTM/Lat-Lon)
- [ ] Elevation profile (cross-section)

### Teknik Stack
- Leaflet.Measure
- Leaflet.Draw
- GeoJSON export

---

## B. Timeline & Playback System
**Öncelik:** ⭐⭐⭐⭐ (Yüksek)
**Tahmini Zaman:** 3-4 saat
**Fayda:** Historical trends, educational simulation

### Hedefler
- [ ] ISS 24-hour orbit replay
- [ ] Weather timeline (past/future scrub)
- [ ] Sunrise/sunset timeline
- [ ] Play/pause/speed controls
- [ ] Timestamp indicator

### Teknik Detaylar
```typescript
// hooks/useTimeline.ts
- currentTime state
- isPlaying boolean
- playbackSpeed (0.5x - 2x)

// lib/ephemeris-archive.ts
- Predict ISS position @ time T
- Fetch historical weather data

// components/TimelinePlayer.tsx
- Slider + buttons
- Time display (HH:MM:SS)
```

---

## C. Konum Zinciri (Favorites & History)
**Öncelik:** ⭐⭐⭐⭐ (Yüksek)
**Tahmini Zaman:** 2 saat
**Fayda:** UX convenience, sharing

### Hedefler
- [ ] Bookmark şehir/koordinat
- [ ] Visit history (son 20)
- [ ] QR code share
- [ ] URL slug mekanizması (/tracker?id=istanbul)
- [ ] Export favorites (JSON)

### Teknik Detaylar
```typescript
// hooks/useFavorites.ts
- addFavorite(), removeFavorite()
- FavoritesContext
- localStorage sync

// lib/qr.ts
- Generate QR code from location

// components/FavoritesPanel.tsx
- Favorites dropdown
- History list
- Quick access buttons
```

---

## D. Onboarding & Layer Guide
**Öncelik:** ⭐⭐⭐⭐ (Yüksek)
**Tahmini Zaman:** 2-3 saat
**Fayda:** First-time user conversion +50%

### Hedefler
- [ ] Interactive onboarding (5-step tour)
- [ ] Layer information modals (kaynak, açıklama)
- [ ] Veri kaynakları linkler
- [ ] Legend açıklamaları
- [ ] Keyboard shortcuts cheat sheet

### Teknik Detaylar
```typescript
// hooks/useOnboarding.ts
- Steps sequence
- Completion tracking
- Skip option

// components/LayerGuide.tsx
- Popover per layer
- Data source + license
- Tutorial link
```

---

## E. Gelişmiş Hava Tahmini
**Öncelik:** ⭐⭐⭐ (Orta-Yüksek)
**Tahmini Zaman:** 4-5 saat
**Fayda:** Public health, emergency preparedness

### Hedefler
- [ ] 15-day hourly forecast
- [ ] Severe weather alerts (WWO integration)
- [ ] Pollen forecast
- [ ] Air quality timeline + WHO standards
- [ ] UV index warnings
- [ ] Precipitation probability

---

## F. Gemi & Uçak Tracking Tabakası
**Öncelik:** ⭐⭐⭐ (Orta-Yüksek)
**Tahmini Zaman:** 3-4 saat
**Fayda:** Multi-object tracking, comparison

### Hedefler
- [ ] AIS feed (cargo ships)
- [ ] ADSB feed (aircraft)
- [ ] Real-time position update
- [ ] Filter by type/speed
- [ ] Click for details (route, destination)

---

## G. Customizable Dashboard
**Öncelik:** ⭐⭐⭐ (Orta)
**Tahmini Zaman:** 3-4 saat
**Fayda:** Personalization, retention

### Hedefler
- [ ] Drag-drop panel arrangement
- [ ] Color scheme toggle (dark/light/custom)
- [ ] Font size accessibility
- [ ] Layout templates
- [ ] Widget visibility toggle

---

## H. Notlar & Ek Açıklamalar
**Öncelik:** ⭐⭐⭐ (Orta)
**Tahmini Zaman:** 3 saat
**Fayda:** Education, research

### Hedefler
- [ ] Named coordinate pins (etiketi)
- [ ] Canvas drawing (polygon, rectangle, text)
- [ ] Note saving (linked to coordinates)
- [ ] JSON export (study data)
- [ ] Screenshot with watermark

---

# 🎯 PHASE 3: EXECUTION TIMELINE (2 Hafta)

## **Hafta 1: Foundation (Kritik Sistemler)**

### Pazartesi-Salı (8 saat)
- [ ] Error Boundary + Toast System
  - `components/ErrorBoundary.tsx`
  - `hooks/useNotification.ts`
  - `lib/errorHandler.ts`
  - Tüm API calls try/catch update

- [ ] Service Worker (Offline mode)
  - `public/sw.ts` setup
  - Cache strategies
  - Network fallback
  - `lib/cacheManager.ts`

### Çarşamba-Perşembe (8 saat)
- [ ] Mobile Responsive Audit
  - Breakpoint audit (325px, 640px, 768px)
  - Panel stack test
  - Touch target validation

- [ ] ARIA + Keyboard Navigation
  - Semantic HTML audit
  - aria-label additions
  - Focus management
  - Keyboard event handlers

### Cuma (4 saat)
- [ ] State Persistence
  - `hooks/usePersistence.ts`
  - LocalStorage integration
  - Query param encoding

- [ ] Integration Testing
  - ErrorBoundary test
  - Offline scenario test
  - Mobile viewport test

**Hafta 1 Çıktı:** Production-ready foundation

---

## **Hafta 2: UX Enhancements**

### Pazartesi-Salı (8 saat)
- [ ] Onboarding Tour
  - `components/OnboardingTour.tsx`
  - Interactive steps
  - First-time detection

- [ ] Favorites/Bookmarks System
  - `hooks/useFavorites.ts`
  - Save/load locations
  - Quick access UI

### Çarşamba-Perşembe (8 saat)
- [ ] Timeline Playback
  - `hooks/useTimeline.ts`
  - Playback state management
  - Speed controls
  - ISS ephemeris archive

- [ ] Distance Measurement Tool
  - Leaflet.Measure integration
  - UI components
  - Export functionality

### Cuma (4 saat)
- [ ] Layer Guide UI
  - Modal per layer
  - Data source links
  - Testing + Bug fixes

**Hafta 2 Çıktı:** Enhanced UX + Tools

---

# 📋 BAŞLAMAK İÇİN AKSIYON PLAN

**1. İlk Adım - Error Handling System (3 saat)**
```bash
# Yeni dosyalar:
touch components/ErrorBoundary.tsx
touch components/Notification.tsx
touch hooks/useNotification.ts
touch lib/errorHandler.ts

# Adımlar:
1. NotificationContext oluştur
2. ErrorBoundary wrap app.tsx
3. All fetch() → try/catch + notifyError()
4. Test: Network error → toast görünmeli
```

**2. Service Worker Setup (2 saat)**
```bash
# Yeni dosyalar:
touch public/sw.ts

# Adımlar:
1. Workbox v7 entegrasyonu
2. Static asset caching
3. Network fallback
4. Test: Chrome DevTools > Application > Service Workers
```

**3. Mobile Test (1 saat)**
```bash
# DevTools > Toggle device toolbar
# Test:
- iPhone 12 mini (375px)
- iPad (768px)
- Landscape mode
- Button sizes (44px minimum)
```

**4. State Persistence (1.5 saat)**
```bash
# Yeni dosya:
touch hooks/usePersistence.ts

# Adımlar:
1. moduleState → localStorage.setItem()
2. useEffect on mount → localStorage.getItem()
3. Test: localStorage > Application > Storage
```

---

# 🛠️ DEPENDENCIES & TECH STACK

## Phase 1 Paketleri
```json
"sonner": "latest",                         // Toast notifications
"workbox-window": "^7.0.0",                 // Service Worker
"zustand": "^4.4.0",                        // State management
```

## Phase 2 Paketleri
```json
"driver.js": "^1.3.1",                      // Onboarding tours
"qrcode.react": "^1.0.1",                   // QR codes
"framer-motion": "^10.16.0",                // Animations
"react-beautiful-dnd": "^13.0.0",           // Drag & drop
"leaflet-measure": "^3.1.0"                 // Measurements
```

## Dev Dependencies
```json
"@testing-library/react": "^14.0.0",
"jest": "^29.0.0",
"@types/jest": "^29.0.0",
"axe-core": "^4.7.0"
```

---

# ✅ SUCCESS METRICS

| Metrik | Hedef | Şu Anki |
|--------|-------|---------|
| Error Rate | < 0.1% | ? |
| Offline Availability | 95% | 0% |
| Mobile UX Score | > 85 | ~ 60 |
| WCAG AA Compliance | 100% | 30% |
| Avg Load Time | < 2s | ? |
| SEO Score | > 90 | ? |

---

# 📞 SORULAR & KARARLAR

1. **Team size?** (1x dev = 5 hafta, 4x dev = 1.5 hafta)
2. **Priority?** (Foundation first vs Features first)
3. **Mobile-first design?** (Yes/No)
4. **Vercel deploy ready?** (Staging vs Production URLs)
5. **Analytics?** (GA4, Plausible, Umami?)
6. **i18n needed?** (TR + EN + ?)
7. **Budget for paid services?** (Sentry, OpenWeather, etc.)?
