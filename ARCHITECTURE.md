# CBS Görselleştirme Motoru ve ISS Takip Uygulaması: Mimari ve Geliştirici Kılavuzu

Bu belge, WebGL2 tabanlı 2D/3D entegre yeryüzü ve ISS takip uygulamasının teknik mimarisini, dosya yapısını, veri akışlarını, alt sistemlerini ve gelecekte projede çalışacak yazılımcı ve yapay zekâ (AI) ajanları için yol haritasını detaylandırmaktadır.

---

## 📂 Dosya ve Dizin Kılavuzu

Uygulama, Next.js App Router yapısı üzerine inşa edilmiş ve istemci tarafında (Client-Side) Deck.gl ile MapLibre GL kütüphanelerini kullanarak zengin WebGL görselleştirmeleri gerçekleştirecek şekilde tasarlanmıştır.

```
ISS/
├── app/                              # Uygulama Arayüzü ve Sayfa Düzenleri
│   ├── page.tsx                      # Ana Sayfa Orkestrasyonu, State Yönetimi ve Modül/Panel Kompozisyonu
│   ├── layout.tsx                    # Root Layout, Global Toast Provider ve HTML Meta Verileri
│   └── globals.css                   # Global CSS, WCAG AA Kontrast Kuralları, Shimmer Efektleri ve Responsive Tasarım
├── components/                       # Yeniden Kullanılabilir Bileşenler Katmanı
│   ├── earth/
│   │   └── EarthCanvas.tsx           # Birleşik Render Motoru: MapLibre GL (küre/mercator projeksiyon + native raster/gündüz-gece katmanları) + Deck.gl MapboxOverlay (animasyonlu parçacıklar, deniz noktaları, imleç) ve WebGL Context Loss Yönetimi
│   ├── panels/                       # Bilgi ve Analiz Panelleri (HUD)
│   │   ├── BookmarksPanel.tsx        # localStorage Kayıtlı Favori Konumlar Listesi ve Haritada Uçuş Tetikleyicisi
│   │   ├── LocationDetailPanel.tsx   # Tıklanan Konumun Detayları, 15 Noktalı SVG Yükseklik Profili, SVG İklim Anomalisi Eğrisi ve Favori Ekleme Düğmesi
│   │   └── WeatherPanel.tsx          # Konum Seçilmediğindeki Genel Hava ve Deniz Durumu Paneli
│   └── ui/                           # Genel Kullanıcı Arayüzü Elemanları
│       ├── CoordDisplay.tsx          # Harita Üzerindeki İmleç/Seçim Koordinat Göstergesi (HUD)
│       ├── ErrorBoundary.tsx         # WebGL Render Çökmelerini İzole Eden Güvenlik Çerçevesi
│       ├── LayerOrderPanel.tsx       # Kullanıcının Katman Render Sırasını (Z-index) Değiştirmesini Sağlayan Sıralama Kontrolü
│       ├── ParticleSettingsPanel.tsx # Windy Tarzı Yoğunluk, Kalınlık, Hız ve Kuyruk Ayarları Arayüzü
│       ├── ScaleBar.tsx              # Harita Ölçek Göstergesi
│       ├── SearchBar.tsx             # Open-Meteo Geocoding Entegrasyonlu Şehir/Konum Arama Kutusu
│       ├── SkeletonLoader.tsx        # Yükleme Sırasında Gösterilen Gölgeli/Animasyonlu İskelet Şablonları (Shimmer Effect)
│       ├── TimeLegend.tsx            # Katman Göstergeleri ve Renk Skalaları (Sıcaklık, Yağış, Rüzgar, Bulut, SST)
│       ├── Toast.tsx                 # Bildirim ve Hata Toast Arayüzü
│       └── Toolbar.tsx               # Modülleri, Altlık Haritaları ve Hava Katmanlarını Açıp Kapatan Ana HUD Araç Çubuğu
├── hooks/                            # Dinamik Yaşam Döngüsü ve State Hook'ları
│   ├── useModules.ts                 # Modül Açma/Kapama, Görünüm Modu (globe3D/map2D) ve Karşılıklı Dışlayan Seçim Grupları (Mutex) ile Parçacık Ayarları
│   └── useSun.ts                     # SunCalc Astronomik Hesaplamalar, Terminatör Sınırı ve Alacakaranlık Feathering Bandları
├── lib/                              # Çekirdek Kütüphaneler ve API Bağlantıları
│   ├── api.ts                        # Open-Meteo, Marine ve Tarihsel İklim Arşivi API Entegrasyonları ve Dil Çeviri Tesisleri
│   ├── audio.ts                      # Web Audio API Siber-Akustik Beep ve Telemetri Ses Sentezleyicisi
│   ├── canvasStyle.ts                # Tek MapLibre GL motoru için taban stilleri (satellite/street/topo) ve küre (globe) / düz (mercator) projeksiyon yapısı
│   ├── fetchWithRetry.ts             # Host Başına Eşzamanlı İstek Sınırlayıcı, Exponential Backoff, 429 Hata Yönetimi ve Tip Güvenliği Validatörleri (safeNum/safeStr)
│   ├── geo.ts                        # Ters Coğrafi Kodlama (Reverse Geocoding), Konum Detayı ve basit geometrik geçiş tahmini yardımcısı (predictUpcomingPasses — şu an UI'a bağlı değil)
│   ├── map.ts                        # Rüzgar Verisi için IDW (Inverse Distance Weighting) Enterpolasyonu ve GPU Trips Katmanı Yol Üreticisi
│   ├── pulse.ts                      # Cursor/seçim için farklı frekanslı ışık darbesi (Pulse) hesaplayıcısı
│   └── tiles.ts                      # NASA GIBS, RainViewer ve Uydu Altlık Haritaları URL Üreticileri
├── data/                             # Statik GeoJSON Verileri
│   └── major_cities.geojson          # Büyük şehir noktaları (public/data/ altında da kopyası bulunur)
├── public/                           # Statik Dosyalar ve Servis İşçileri
│   ├── sw.js                         # Stale-While-Revalidate Map Tiles ve Network-First API Çevrimdışı Önbellekleme Katmanı (v3)
│   └── data/major_cities.geojson     # Servis edilen büyük şehir GeoJSON verisi
├── legacy/                           # Eski/arşiv prototip kodları (aktif uygulamada kullanılmaz)
└── types/                            # Global Veri Tipleri
    └── index.ts                      # Tüm Uygulamanın TypeScript Interface ve Tip Tanımlamaları
```

> **Doğruluk Notu:** Bu dosya ağacı mevcut kaynak kodla eşleştirilmiştir. `README.md` ve aşağıdaki alt sistem açıklamalarında bahsi geçen bazı ISS özellikleri (SGP4 motoru, canlı ISS telemetrisi, NASA canlı yayını, adanmış ISS/PassPredictor panelleri) **şu anki kod tabanında bulunmamaktadır** — ilgili notlar için "Alt Sistem" bölümüne ve sonundaki "Bağımlılık ve Doğruluk Notu"na bakınız.

---

## ⚙️ Çekirdek Alt Sistemlerin Çalışma Mantığı

### 1. Geçiş Tahmini Yardımcısı (`lib/geo.ts`) — Basitleştirilmiş
> **Kod Durumu:** Bu bölümün önceki sürümü, tam teşekküllü bir SGP4/TLE/Kepler yörünge motoru (`lib/sgp4.ts`), `useISS.ts` hook'u ve `PassPredictorPanel.tsx`/`ISSPanel.tsx` panelleri tanımlıyordu. **Bu dosyalar ve SGP4 motoru mevcut kod tabanında bulunmamaktadır.** Kodda yalnızca aşağıdaki basitleştirilmiş yardımcı yer alır.

`lib/geo.ts` içinde `predictUpcomingPasses()` fonksiyonu ve `ISSUpcomingPass` arayüzü tanımlıdır. Bu fonksiyon:
* Gerçek yörünge mekaniği (SGP4/TLE/Kepler) **kullanmaz**; kendisine dışarıdan verilen bir `{lat, lon}[]` tahmini yörünge halkası üzerinde basit bir geometrik görünürlük testi (`|Δlat, Δlon| < 60°`) uygular.
* Gözlemciye en yakın geçişleri yaklaşık zaman, süre, tepe yükseklik açısı (kaba geometrik yaklaşım) ve pusula yönü (`azimuthLabel`) ile döndürür.
* **Şu anda `page.tsx` veya herhangi bir panel tarafından import edilmemektedir** — atıl (dormant) bir yardımcı olarak durmaktadır. Uygulama şu an canlı ISS konumu çekmez (`wheretheiss.at`/CelesTrak entegrasyonu kodda yoktur).

### 2. Topografik Yükseklik Profili (`lib/api.ts`, `components/panels/LocationDetailPanel.tsx`)
Seçilen noktanın çevresindeki arazi yapısını analiz etmek için dinamik bir topografik kesit motoru mevcuttur:
* **Veri Toplama:** Tıklanan merkezin enlemi sabit tutularak batısından (10 km batı, -0.18° boylam) doğusuna (10 km doğu, +0.18° boylam) kadar uzanan hat üzerinde eşit aralıklı 15 koordinat noktası üretilir.
* **API İstekleri:** Bu 15 noktanın yükselti bilgileri Open-Meteo Yükseklik API'sinden progresif olarak fetch edilir.
* **Görselleştirme:** Çekilen yükseklik değerleri detay panelinde SVG tabanlı 2D alan grafiğine dönüştürülür. Tıklanan asıl nokta grafik merkezinde kırmızı bir radar halkasıyla işaretlenir ve arazinin engebeli yapısı görsel olarak incelenebilir.

### 3. Tarihsel İklim Karşılaştırması ve Anomali Dedektörü (`lib/api.ts`, `components/panels/LocationDetailPanel.tsx`)
Küresel ısınma ve dönemsel sıcaklık sapmalarını analiz edebilmek için anomali motoru kurulmuştur:
* **Tarihsel Veri:** Open-Meteo Archive API kullanılarak seçilen lokasyonun son 3 yılına ait içinde bulunulan ayın sıcaklık verileri asenkron olarak çekilir.
* **Anomali Hesabı:** Arşiv verilerinden ilgili ayın tarihsel ortalaması (iklimsel norm) hesaplanır. Mevcut hava durumu sıcaklığı ile bu norm arasındaki fark alınarak anomali derecesi belirlenir (örn. `+2.4°C` veya `-1.2°C`).
* **SVG Çizimi:** Tarihsel sıcaklık eğrisi kesik mavi çizgilerle, güncel değer ise sıcak anomalilerde kırmızı, soğuk anomalilerde mavi renkli bir nokta ile SVG grafiği olarak çizilir.

### 4. GPU Parçacık Akış Katmanları (TripsLayer) ve Performans Yönetimi (`components/earth/EarthCanvas.tsx`, `hooks/useModules.ts`)
Rüzgar akıntıları ve yağış dalgaları haritada binlerce hareketli parçacıkla simüle edilir:
* **Deck.gl TripsLayer:** GPU üzerinde hesaplanan parçacıklar, vektör alan verilerine (Open-Meteo) göre oluşturulan iz yolları (paths) üzerinde kaydırılır.
* **Windy Kontrolleri:** Yoğunluk, kuyruk uzunluğu, kalınlık ve hız çarpanı Windy benzeri bir panelden (`ParticleSettingsPanel.tsx`) anlık olarak değiştirilebilir.
* **Performans Modu (FPS Throttle):** Cihaz donanımını yormamak amacıyla performans modu açıldığında parçacık sayısı 1/3 oranına indirilir, render döngüsü 30 FPS'e sabitlenir (`minFrameInterval = 33ms`) ve trail parametreleri optimize edilir.

### 5. WebGL Hata Kurtarma ve GPU Context Loss Yönetimi (`components/earth/EarthCanvas.tsx`)
WebGL bağlamının (context) kaybolması durumunda arayüzün kilitlenmesi veya siyah ekranda kalması engellenmiştir:
* **Bağlam İzleyici:** `webglcontextlost` ve `webglcontextrestored` olayları yakalanır.
* **State Machine:** Sistem `active` -> `lost` -> `recovering` -> `active` döngüsünde çalışır.
* **Yeniden Yükleme:** Exponential backoff süresiyle (300ms, 600ms, 1200ms) Deck.gl/MapLibre motorları arka planda otomatik olarak yeniden ayağa kaldırılır. Sekme arka plana alındığında delta-time güncellemeleri durdurularak GPU kaynakları korunur.

### 6. Ağ Direnci ve Çevrimdışı Çalışma (Service Worker & FetchWithRetry)
* **fetchWithRetry:** API çağrıları rate limitlere ve anlık kesintilere karşı korunur. Host başına en fazla 4 eşzamanlı istek sınırlandırılır, exponential backoff ile yeniden denemeler yapılır ve `safeNum/safeStr` doğrulayıcılarıyla JSON parse hataları veya NaN değerler temizlenir.
* **Service Worker (sw.js):** Harita/uydu karoları (tiles) için *Stale-While-Revalidate* stratejisi uygulanarak cached karolar anında ekrana basılır ve arkada güncellenir. API istekleri için ise *Network-First* stratejisi ve 2 dakikalık önbellek süresi (offline durumunda 10 dakikaya uzayan fallback) kullanılır.

---

## 🧾 Bağımlılık ve Doğruluk Notu

* **`@arcgis/core` (kullanılmayan/legacy bağımlılık):** `package.json` içinde `@arcgis/core ^4.34.8` çok büyük bir bağımlılık olarak listelidir, ancak `src` içinde **hiçbir yerde import edilmemektedir** (kaldırılmaya aday). Koddaki tek "arcgis" referansı, uydu altlık haritası için kullanılan `server.arcgisonline.com` **raster tile URL'sidir** (`lib/canvasStyle.ts`, `public/sw.js`) — bu, `@arcgis/core` SDK'sıyla ilgili değildir. Benzer şekilde `README.md`'de anılan **Three.js** de `package.json`'da bir bağımlılık değildir.
* **ISS/SGP4 alt sistemleri:** `README.md` ve bu belgenin önceki sürümü canlı ISS telemetrisi, NASA canlı yayını ve SGP4 tabanlı geçiş tahmini gibi özellikler tanımlar. Bu özelliklerin çoğu mevcut kod tabanında **uygulanmamıştır** (bkz. Alt Sistem §1). Mevcut uygulama bir hava durumu / CBS odaklı Dünya görselleştiricisidir.

---

## 🛣️ Yapay Zekâ (AI) Ajanları İçin Yol Haritası (Gelecek Geliştirme Adımları)

Projeye yeni özellikler eklemek isteyen AI ajanlarının aşağıdaki adımları sırasıyla izlemesi önerilir:

### Faz 5: Meteorolojik Uyarılar ve Gelişmiş CBS Katmanları
* **Hedef:** Seçili koordinatlarda aktif kasırga, ekstrem sıcaklık veya yoğun yağış uyarıları varsa kullanıcıya anlık bildirim gösterilmesi.
* **Dosyalar:**
  * `lib/api.ts` içerisine Open-Meteo Weather Alerts API'sinden veri çeken `fetchWeatherAlerts` fonksiyonu eklenmeli.
  * `components/panels/LocationDetailPanel.tsx` içerisinde bu uyarıları gösteren yanıp sönen bir acil durum HUD uyarısı tasarlanmalı.
  * `types/index.ts` dosyasına ilgili veri tipleri girilmeli.

### Faz 6: Uydu Takibi ve Yörünge Çizimleri (Sıfırdan)
* **Hedef:** ISS ve diğer uyduların (Hubble/HST, Starlink, Tiangong) anlık konumlarının takibi ve yörüngelerinin çözümlenmesi. **Not:** Mevcut kodda ISS/uydu takibi henüz yoktur (canlı konum çekimi, SGP4 motoru veya adanmış panel bulunmaz), bu faz büyük ölçüde sıfırdan inşa gerektirir.
* **Dosyalar:**
  * Yeni bir `hooks/useSatellites.ts` hook'u oluşturulmalı; seçili uydu kimliğine (NORAD ID) göre CelesTrak'tan TLE verisi çekmeli veya `wheretheiss.at` gibi keyless bir kaynaktan anlık konum almalı. (`lib/geo.ts` içindeki atıl `predictUpcomingPasses` yardımcısı başlangıç noktası olarak kullanılabilir.)
  * Yeni bir `components/panels/SatellitePanel.tsx` oluşturulmalı; uydular arası geçiş için bir açılır kutu (select box) ve telemetri göstergesi barındırmalı ve `app/page.tsx` içine eklenmeli.
  * `components/earth/EarthCanvas.tsx` içindeki mevcut Deck.gl `MapboxOverlay` katmanlarına, uydu konumlarını ve rotalarını farklı renklerde çizecek yeni `ScatterplotLayer`/`TripsLayer` katmanları eklenmeli.

### Faz 7: Progressive Web App (PWA) ve Gelişmiş Çevrimdışı Mod
* **Hedef:** Uygulamanın bir mobil uygulama gibi kurulabilmesi ve önceden kaydedilen favori konumların harita karolarının tamamen çevrimdışı görüntülenebilmesi.
* **Dosyalar:**
  * `public/manifest.json` ve uygun logolar (`public/icons/`) oluşturulmalı.
  * `public/sw.js` dosyasına statik uygulama iskeletini (app shell) ve temel yazı tiplerini önceden önbelleğe alacak (pre-cache) yaşam döngüsü eklenmeli.
  * `components/panels/BookmarksPanel.tsx` içerisindeki favori konumların çevresindeki 3 level harita tile'larını önceden indirip cache'e yazacak bir "Çevrimdışı İndir" düğmesi yerleştirilmeli.
