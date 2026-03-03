# 🌍 Earth Tracker

3D interaktif dünya — ISS takibi, hava durumu, hava kalitesi, gece/gündüz sınırı.

## Kurulum

```bash
npm install
npm run dev
```

Tarayıcıda aç: http://localhost:3000

## Özellikler

| Katman | Kaynak | API Key? |
|---|---|---|
| 3D Dünya | Three.js | ❌ |
| Hava Durumu | Open-Meteo | ❌ |
| Hava Kalitesi | Open-Meteo Air Quality | ❌ |
| ISS Takibi | wheretheiss.at | ❌ |
| Şehir Arama | Open-Meteo Geocoding | ❌ |
| Gece/Gündüz | SunCalc hesaplama | ❌ |

**Hiçbir API key gerekmez.**

## Deploy (Vercel)

```bash
npx vercel --prod
```

## Proje Yapısı

```
earth-tracker/
├── app/
│   ├── page.tsx          # Ana sayfa — orchestration
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global stiller
├── components/
│   ├── globe/
│   │   └── GlobeCanvas.tsx   # Three.js canvas
│   ├── panels/
│   │   ├── WeatherPanel.tsx  # Hava durumu + hava kalitesi
│   │   └── ISSPanel.tsx      # ISS verileri
│   └── ui/
│       ├── ModulesBar.tsx    # Katman toggle bar
│       └── SearchBar.tsx     # Şehir arama
├── hooks/
│   ├── useGlobe.ts       # Three.js logic
│   └── useModules.ts     # Katman state
├── lib/
│   ├── api.ts            # Fetch fonksiyonları
│   └── globe.ts          # Three.js utilities
└── types/
    └── index.ts          # TypeScript tipleri
```

## Gelecek Özellikler (Roadmap)

- [ ] Uçak takibi (OpenSky Network)
- [ ] Rüzgar animasyonu (partiküller)
- [ ] Yağış radar katmanı
- [ ] Fırtına / şimşek simülasyonu
- [ ] Deprem katmanı (USGS)
- [ ] Yangın katmanı (NASA FIRMS)
