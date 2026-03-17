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
│   │   └── ISSPanel.tsx      <p align="center">
  <img src="https://img.shields.io/badge/🌍_Earth_Tracker-00e5ff?style=for-the-badge&labelColor=000011" alt="Earth Tracker"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.1-000000?style=flat-square&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Three.js-0.183-000000?style=flat-square&logo=three.js&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Leaflet-1.9-199900?style=flat-square&logo=leaflet&logoColor=white" />
  <img src="https://img.shields.io/badge/API_Key-Gerekmez!-00e676?style=flat-square" />
</p>

---

## 🚀 Nedir?

**Earth Tracker**, ISS takibi + Zoom Earth + Google Earth özelliklerini tek bir uygulamada birleştiren, tamamen **API anahtarı gerektirmeyen** bir gerçek zamanlı dünya görselleştirme platformudur.

3D küre ↔ 2D harita arasında otomatik geçiş yapılır; uydu görüntüleri, hava durumu katmanları, rüzgar parçacıkları, gece ışıkları, bulut örtüsü ve ISS yörünge tahmini tek arayüzde sunulur.

---

## ✨ Özellikler

| Kategori | Özellik | Durum |
|----------|---------|-------|
| 🌐 **3D Küre** | Three.js WebGL küre, atmosfer shader, yıldız alanı | ✅ |
| 🗺️ **2D Harita** | Leaflet tabanlı, Esri/OSM/OpenTopo katmanları | ✅ |
| 🔄 **Otomatik Geçiş** | Zoom seviyesine göre 3D ↔ 2D fade geçişi | ✅ |
| 🛰️ **ISS Takip** | 5s aralıkla canlı konum, 51.6° yörünge tahmini | ✅ |
| 🌤️ **Hava Durumu** | Open-Meteo API — sıcaklık, nem, rüzgar, yağış | ✅ |
| 🌊 **Deniz Durumu** | Dalga yüksekliği, periyot, su sıcaklığı | ✅ |
| 💨 **Rüzgar** | GPU parçacık sistemi, hız bazlı renk gradyanı | ✅ |
| 🌧️ **Yağış** | RainViewer radar katmanı (ücretsiz, API key yok) | ✅ |
| 🌡️ **Sıcaklık** | NASA GIBS Land Surface Temp katmanı | ✅ |
| ☁️ **Bulutlar** | NASA GIBS bulut örtüsü (3D + 2D) | ✅ |
| 🌃 **Gece Işıkları** | NASA Black Marble katmanı | ✅ |
| 🌗 **Gündüz/Gece** | SunCalc terminator shader, şehir ışıkları twinkle | ✅ |
| 🛸 **NASA GIBS** | Corrected Reflectance uydu görüntüsü | ✅ |
| 🔍 **Şehir Arama** | Open-Meteo Geocoding, otomatik flyTo | ✅ |
| 🖱️ **Harita Tıklama** | 2D haritada tıklayarak konum seçme | ✅ |

---

## 🛠️ Teknoloji Yığını

```
Frontend     → Next.js 16 (App Router) + React 18
3D Engine    → Three.js 0.183 + Custom Shaders
2D Map       → Leaflet 1.9 + Esri/OSM/Topo/NASA GIBS
Styling      → TailwindCSS 3.4 + Glassmorphism
Hava API     → Open-Meteo (sıfır anahtar)
Yağış        → RainViewer (sıfır anahtar)
Uydu         → NASA GIBS (sıfır anahtar)
ISS          → open-notify.org (sıfır anahtar)
Güneş Pozisyonu → SunCalc
```

---

## 📦 Kurulum

```bash
# Repoyu klonla
git clone https://github.com/<kullanici>/earth-tracker.git
cd earth-tracker

# Bağımlılıkları kur
npm install

# Geliştirme sunucusu
npm run dev

# Üretim build
npm run build
npm start
```

> 💡 **API anahtarı gerekmez!** Tüm veri kaynakları ücretsiz ve anahtarsız çalışır.

---

## 🎮 Kullanım

| İşlem | Açıklama |
|-------|----------|
| 🔍 Arama çubuğu | Şehir adı yazın → otomatik uçuş |
| 🖱️ Harita tıklama | 2D modda tıklayın → hava verisi yükle |
| ⚡ Modül butonları | Alt çubuktaki butonlarla katmanları aç/kapat |
| 🔧 Sol araç çubuğu | Hızlı erişim katman toggle'ları |
| 🔄 Zoom geçişi | 3D'de yakınlaş → otomatik 2D'ye geç |

---

## 🎨 Görsel Özellikler

- **Atmosfer Shader** — Mavi-cyan rim gradient, gerçekçi Dünya halesi
- **Yıldız Alanı** — 8000 yıldız, renk varyasyonu (mavi/sarı/beyaz)
- **ISS Modeli** — Güneş panelleri + merkez modül + nabız beacon
- **Rüzgar Parçacıkları** — Her karede animasyon, hız bazlı renk (mavi→cyan→yeşil→sarı→kırmızı)
- **Gece Işıkları** — Terminator shader, şehir parıltısı twinkle efekti
- **Bulut Örtüsü** — NASA GIBS cloud mesh (3D) / tile overlay (2D)
- **Glassmorphism UI** — backdrop-blur-xl, cyan border glow, fade-in animasyonları
- **Geçiş Efekti** — 3D ↔ 2D arasında yumuşak opacity fade

---

## 📂 Proje Yapısı

```
app/
├── globals.css        # Global stiller, animasyonlar
├── layout.tsx         # Root layout
└── page.tsx           # Ana sayfa — tüm state ve bileşen orkestrasyonu

components/
├── globe/GlobeCanvas  # Three.js 3D küre wrapper
├── map/MapCanvas      # Leaflet 2D harita wrapper
├── panels/            # WeatherPanel, ISSPanel
└── ui/                # ModulesBar, Toolbar, SearchBar, CoordDisplay, ScaleBar, TimeLegend

hooks/
├── useGlobe.ts        # Three.js sahne yaşam döngüsü, animasyon loop
├── useISS.ts          # ISS konum polling, yörünge tahmini
├── useModules.ts      # Modül toggle state yönetimi
└── useSun.ts          # Güneş pozisyon hesaplama

lib/
├── api.ts             # Tüm API fetch fonksiyonları
├── globe.ts           # Three.js 3D nesne builder'ları
└── tiles.ts           # Tile URL şablonları

types/
└── index.ts           # TypeScript interface tanımları
```

---

## 🌐 Veri Kaynakları

| Kaynak | Kullanım | Maliyet |
|--------|----------|---------|
| [Open-Meteo](https://open-meteo.com/) | Hava durumu, deniz, geocoding, rüzgar | 🆓 Ücretsiz |
| [NASA GIBS](https://gibs.earthdata.nasa.gov/) | Uydu, bulut, kar, sıcaklık | 🆓 Ücretsiz |
| [RainViewer](https://www.rainviewer.com/) | Yağış radarı | 🆓 Ücretsiz |
| [Open Notify](http://open-notify.org/) | ISS konumu | 🆓 Ücretsiz |
| [Esri](https://www.arcgis.com/) | Uydu harita karoları | 🆓 Ücretsiz |
| [OpenStreetMap](https://www.openstreetmap.org/) | Yol haritası | 🆓 Ücretsiz |

---

## 📄 Lisans

MIT

---

<p align="center">
  <sub>🌍 Earth Tracker — Gerçek zamanlı dünya izleme platformu</sub>
</p> verileri
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
