<p align="center">
  <img src="https://img.shields.io/badge/%F0%9F%8C%8D_Earth_Tracker-00e5ff?style=for-the-badge&labelColor=000011" alt="Earth Tracker"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Three.js-0.183-000000?style=flat-square&logo=three.js&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Deck.gl-9-199900?style=flat-square" />
  <img src="https://img.shields.io/badge/MapLibre-5-1a73e8?style=flat-square" />
  <img src="https://img.shields.io/badge/API_Key-Gerekmez!-00e676?style=flat-square" />
</p>

# 🌍 Earth Tracker

3D interaktif dünya — ISS takibi, hava durumu, hava kalitesi, gece/gündüz sınırı, yörünge tahmini, yükselti profili, iklim anomalisi.

## Kurulum

```bash
npm install
npm run dev
```

Tarayıcıda aç: [http://localhost:3000](http://localhost:3000)

## Özellikler

| Katman | Kaynak | API Key? |
|---|---|---|
| 3D Dünya (deck.gl GlobeView) | Esri World Imagery | ❌ |
| 2D Harita (MapLibre) | CartoDB Dark Matter | ❌ |
| Hava Durumu | Open-Meteo | ❌ |
| Hava Kalitesi | Open-Meteo Air Quality | ❌ |
| Deniz Durumu | Open-Meteo Marine | ❌ |
| Rüzgar Parçacıkları | Open-Meteo + GPU TripsLayer | ❌ |
| Yağış Radarı | RainViewer | ❌ |
| Sıcaklık / Bulut | NASA GIBS | ❌ |
| Gece Işıkları | NASA Black Marble | ❌ |
| Gündüz/Gece Sınırı | SunCalc + Polygon overlay | ❌ |
| ISS Takibi | wheretheiss.at | ❌ |
| ISS Yörünge Tahmini | Kepler 3. yasa hesaplaması | ❌ |
| Şehir Arama | Open-Meteo Geocoding | ❌ |
| Otomatik 3D↔2D Geçiş | Zoom eşiği (5.5× / 3.5×) | — |

**Hiçbir API key gerekmez.**

## Deploy (Vercel)

```bash
npx vercel --prod
```

## Proje Yapısı

```
earth-tracker/
├── app/
│   ├── page.tsx               # Ana sayfa — orchestration + auto 3D↔2D
│   ├── layout.tsx             # Root layout (ToastProvider)
│   └── globals.css            # Global stiller, animasyonlar
├── components/
│   ├── globe/GlobeCanvas.tsx  # Deck.gl GlobeView (3D)
│   ├── map/MapCanvas.tsx      # MapLibre + Deck.gl overlay (2D)
│   ├── panels/                # WeatherPanel, ISSPanel, LocationDetailPanel
│   └── ui/                    # Toolbar, SearchBar, CoordDisplay, ScaleBar, TimeLegend, Toast, ErrorBoundary
├── hooks/
│   ├── useISS.ts              # ISS polling + Kepler tahmini + antimeridian split
│   ├── useModules.ts          # Modül toggle state + mutex grupları
│   └── useSun.ts              # Güneş pozisyon + terminator poligonu
├── lib/
│   ├── api.ts                 # Open-Meteo, ISS, geocoding fetch'leri
│   ├── geo.ts                 # Reverse geocoding, location detail, ISS pass prediction
│   ├── map.ts                 # Wind IDW + GPU particle path generator
│   ├── tiles.ts               # Tile URL şablonları
│   ├── pulse.ts               # Paylaşılan pulse matematiği (cursor/ISS ayrımı)
│   ├── canvasStyle.ts         # 2D/3D base style + auto-switch eşikleri
│   └── audio.ts               # Web Audio API telemetry beep'leri
└── types/
    └── index.ts               # TypeScript interface'leri
```

## Mimarî Notlar

- **Mutex toggle grupları:** Base style (satellite/street/topo) ve tile grupları (precipitation/temperature/clouds) birbirini dışlar — UI'da `●` ile aktif olanı işaretlenir.
- **Paylaşılan pulse:** `lib/pulse.ts` cursor (0.5 Hz) ve ISS (0.85 Hz) için farklı faz/frekanslar sunar, böylece iki nokta aynı anda pulse etmez.
- **Antimeridian split:** `splitTrailByAntimeridian` ISS trail'ini -180/+180 sınırında otomatik böler, "kırık gerdanlık" önlenir.
- **Auto 3D↔2D:** Globe zoom > 5.5× → 2D'ye, 2D zoom < 3.5× → 3D'ye, 1.2 sn gecikme kilidi ile.
- **Performance Mode:** Aktifken parçacık sayısı 1800 → 600'e düşer (mobile için).
- **Cursor fade:** `cursorFadeRef` ile seçim pin'i mount/unmount fade (300 ms) ile görünür/kaybolur.
- **Terminator:** SunCalc + dec tabanlı poligon, 3D ve 2D'de aynı kaynaktan çizilir.

## Veri Kaynakları

| Kaynak | Kullanım | Maliyet |
|---|---|---|
| [Open-Meteo](https://open-meteo.com/) | Hava durumu, deniz, geocoding, rüzgar | 🆓 |
| [NASA GIBS](https://gibs.earthdata.nasa.gov/) | Uydu, bulut, sıcaklık, gece ışıkları | 🆓 |
| [RainViewer](https://www.rainviewer.com/) | Yağış radarı | 🆓 |
| [Open Notify](https://wheretheiss.at/) | ISS konumu | 🆓 |
| [CartoDB Basemaps](https://carto.com/basemaps) | 2D harita altlığı | 🆓 |
| [Esri World Imagery](https://www.arcgis.com/) | 3D uydu altlığı | 🆓 |

## Lisans

MIT
