# 🌍 Earth Tracker — Roadmap v2

> **Hedef:** Zoom Earth + Google Earth + ISS Tracker hibrit —
> gerçek uydu görüntüleri, canlı hava katmanları, 3D dış bakış, akıcı zoom.
> **Sıfır API key. Sıfır kayıt. Tamamen açık kaynak.**

---

## Vizyon

```
Uzakta → Google Earth gibi 3D dış bakış (ISS tracker stili)
Yakında → Zoom Earth gibi 2D uydu harita + katman sistemi
İkisi arası → sorunsuz zoom geçişi
```

---

## ✅ Faz 0 — Temel Altyapı (Tamamlandı)

- [ ] Three.js 3D dünya globu
- [ ] Bloom + atmosfer GLSL shader
- [ ] Dönen bulut katmanı
- [ ] Yıldız arka planı (procedural)
- [ ] OrbitControls (döndür, zoom, pan)
- [ ] Katman toggle sistemi
- [ ] Şehir arama (Open-Meteo Geocoding)
- [ ] Globe'a tıklayınca hava durumu
- [ ] Kamera uçuş animasyonu
- [ ] Next.js + TypeScript + Tailwind

---

## 🚧 Faz 1 — Çift Mod: 3D Globe ↔ 2D Harita

> Projenin omurgası. Her şey buna oturur.

### 1A — 3D Dış Bakış (Google Earth / ISS Tracker stili)
- [ ] Uzay perspektifinden tam globe görünümü (mevcut)
- [ ] Zoom out → yıldızlar, atmosfer glow aktif
- [ ] ISS yörüngesi görünür
- [ ] Gece/gündüz çizgisi görünür
- [ ] Bulut katmanı döner

### 1B — 2D Uydu Modu (Zoom Earth stili)
- [ ] Zoom in → dünya yüzeyi tile bazlı haritaya geçer
- [ ] ESRI World Imagery uydu tile (key yok)
  ```
  https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}
  ```
- [ ] OpenStreetMap sokak haritası modu
- [ ] OpenTopoMap terrain modu
- [ ] Stadia dark harita modu

### 1C — Geçiş Sistemi
- [ ] Zoom seviyesine göre otomatik mod geçişi
- [ ] 3D → 2D arası yumuşak blend animasyonu
- [ ] Manuel mod butonu (toolbar)
- [ ] Zoom level göstergesi (HUD)

**Kaynaklar:** Three.js, Leaflet.js, ESRI CDN, OSM tiles (key yok)

---

## 🚧 Faz 2 — Canlı Uydu Görüntüleri (NASA GIBS)

> Zoom Earth'in kalbi — gerçek zamanlı uydu geçişleri

- [ ] NASA GIBS WMTS entegrasyonu (key yok)
- [ ] Bugünün uydu görüntüsü (Terra/Aqua MODIS)
- [ ] Tarihsel uydu görüntüsü + tarih seçici slider
- [ ] True color / false color toggle
- [ ] Gece ışıkları katmanı (NASA Black Marble)
- [ ] Kar örtüsü katmanı (MODIS)
- [ ] Deniz buzu katmanı (NSIDC)

**Kaynaklar:** NASA GIBS WMTS (tamamen açık, key yok)

---

## 🚧 Faz 3 — Gece / Gündüz Sistemi

- [ ] Terminator çizgisi (SunCalc.js)
- [ ] Gece tarafı GLSL karartma shader'ı
- [ ] Güneş konumu hesabı (SunCalc.js, offline)
- [ ] Ay konumu göstergesi
- [ ] Gündoğumu / günbatımı (koordinata göre)
- [ ] UTC + yerel saat paneli
- [ ] Güneş yüksekliği & azimut

**Kaynaklar:** `suncalc` npm (offline, key yok)

---

## 🚧 Faz 4 — Hava Durumu Katmanları

> Zoom Earth'teki gibi gerçek zamanlı overlay'ler

### 4A — Anlık Nokta Verisi (tıklanınca)
- [ ] Sıcaklık & hissedilen
- [ ] Nem, yağış, basınç
- [ ] WMO hava kodu + ikon
- [ ] Rüzgar hızı & yön

### 4B — Global Overlay Katmanları
- [ ] Bulut katmanı — NASA GIBS MODIS
- [ ] Sıcaklık haritası — Open-Meteo grid renk overlay
- [ ] Yağış radar — Open-Meteo precipitation
- [ ] Kar örtüsü — NASA GIBS MODIS Snow Cover
- [ ] Fırtına takibi — tropikal sistem animasyonu

**Kaynaklar:** Open-Meteo (key yok), NASA GIBS (key yok)

---

## 🚧 Faz 5 — Rüzgar Akış Animasyonu

> earth.nullschool.net tarzı akıcı streamline animasyonu

- [ ] Global rüzgar grid verisi (Open-Meteo)
- [ ] Streamline partikül animasyonu (globe yüzeyinde akar)
- [ ] Rüzgar hızına göre renk gradyanı (mavi → kırmızı)
- [ ] Parçacık yoğunluğu ayarı
- [ ] Yükseklik seçimi (10m / 100m / 1000m)

**Kaynaklar:** Open-Meteo (key yok)

---


---

## 🚧 Faz 7 — ISS Tracker

> Mevcut prototipin rafine hali

- [ ] Gerçek zamanlı konum (5 sn. polling)
- [ ] 3D ISS modeli (gövde + güneş panelleri)
- [ ] Geçmiş yörünge trail (son 200 nokta)
- [ ] Gelecek yörünge tahmini (kesikli çizgi)
- [ ] ISS HUD paneli (enlem, boylam, irtifa, hız)
- [ ] ISS'e kamera kilitle / takip modu
- [ ] ISS altındaki koordinata tıklayınca hava

**Kaynaklar:** wheretheiss.at (key yok)

--                  
---

## 🔮 Faz 9 — Okyanus & Deniz

- [ ] Deniz yüzey sıcaklığı (NASA GIBS SST)
- [ ] Dalga yüksekliği & yönü (Open-Meteo Marine)
- [ ] Okyanus akıntıları animasyonu
- [ ] Gel-git verisi (NOAA Tides)
- [ ] Deniz buzu (NSIDC WMS)

**Kaynaklar:** NASA GIBS, Open-Meteo Marine, NOAA (key yok)

---

## 🔮 Faz 10 — Teleskop / Uzay Modu

- [ ] Kamera uzaklaştıkça yıldızlar belirginleşir
- [ ] HYG yıldız katalogu (statik JSON, offline)
- [ ] Takım yıldızı çizgileri
- [ ] Hover → yıldız adı etiketi
- [ ] Gezegen pozisyonları (SunCalc)

**Kaynaklar:** HYG Catalog (offline), SunCalc.js

---

## 🔮 Faz 11 — Fırtına & Şimşek

- [ ] Tropikal fırtına simülasyonu
- [ ] Şimşek flash efekti
- [ ] Open-Meteo yağış verisiyle senkronize yoğunluk

**Kaynaklar:** Procedural, Open-Meteo

---

## 🎨 Faz 12 — UI / UX Polish

> Her fazda paralel yürütülür

- [ ] Sol kenar dikey katman paneli (Zoom Earth toolbar stili)
- [ ] Aktif katman renk skalası legend
- [ ] Cursor altında anlık lat/lon göstergesi
- [ ] Zoom'a göre ölçek çubuğu (km / mi)
- [ ] Zaman slider'ı (geçmiş uydu görüntüsü)
- [ ] Minimap (dünya üzerinde konum)
- [ ] Globe yüklenirken loading ekranı
- [ ] Mobil pinch zoom desteği
- [ ] Klavye kısayolları
- [ ] Tam ekran modu

---

## 🚀 Faz 13 — Deploy & Portföy

- [ ] Vercel deploy
- [ ] Custom subdomain (`earth.yourdomain.com`)
- [ ] GitHub README + ekran görüntüleri
- [ ] Demo GIF / video kaydı
- [ ] Portföy sitesinde proje kartı
- [ ] Open Graph meta (sosyal önizleme)

---

## 📊 Genel Bakış

| Faz | Konu | Durum | Öncelik |
|---|---|---|---|
| 0 | Temel altyapı | ✅ Tamamlandı | — |
| 1 | 3D ↔ 2D çift mod | 🔲 | 🔴 Kritik |
| 2 | NASA GIBS uydu görüntüleri | 🔲 | 🔴 Kritik |
| 3 | Gece / Gündüz | 🔲 | 🔴 Yüksek |
| 4 | Hava durumu katmanları | 🔲 | 🔴 Yüksek |
| 5 | Rüzgar akış animasyonu | 🔲 | 🟡 Orta |
| 6 | Hava kalitesi | 🔲 | 🟡 Orta |
| 7 | ISS tracker | 🔲 | 🟡 Orta |
| 8 | Uçak takibi | 🔲 | 🟡 Orta |
| 9 | Okyanus & deniz | 🔲 | 🟢 Düşük |
| 10 | Teleskop modu | 🔲 | 🟢 Düşük |
| 11 | Fırtına & şimşek | 🔲 | 🟢 Düşük |
| 12 | UI / UX polish | 🔲 | 🟡 Sürekli |
| 13 | Deploy & portföy | 🔲 | 🔴 Final |

---
