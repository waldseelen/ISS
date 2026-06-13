# CBS Görselleştirme Motoru ve ISS Takip Uygulaması: Mimari ve Geliştirici Kılavuzu

Bu belge, WebGL2 tabanlı 2D/3D entegre yeryüzü ve ISS takip uygulamasının teknik mimarisini, dosya yapısını, veri akışlarını, alt sistemlerini ve gelecekte projede çalışacak yazılımcı ve yapay zekâ (AI) ajanları için yol haritasını detaylandırmaktadır.

---

## 📂 Dosya ve Dizin Kılavuzu

Uygulama, Next.js App Router yapısı üzerine inşa edilmiş ve istemci tarafında (Client-Side) Deck.gl ile MapLibre GL kütüphanelerini kullanarak zengin WebGL görselleştirmeleri gerçekleştirecek şekilde tasarlanmıştır.

```
c:/Users/HP/DEV/ISS/
├── app/                              # Uygulama Arayüzü ve Sayfa Düzenleri
│   ├── page.tsx                      # Ana Sayfa Orkestrasyonu, State Yönetimi ve 2D/3D Otomatik Geçiş Kilidi
│   ├── layout.tsx                    # Root Layout, Global Toast Provider ve HTML Meta Verileri
│   └── globals.css                   # Global CSS, WCAG AA Kontrast Kuralları, Shimmer Efektleri ve Responsive Tasarım
├── components/                       # Yeniden Kullanılabilir Bileşenler Katmanı
│   ├── globe/
│   │   └── GlobeCanvas.tsx           # 3D Dünya Görünümü (Deck.gl GlobeView), GPU Katmanları, Atmosfer Halosu ve WebGL Context Loss Yönetimi
│   ├── map/
│   │   └── MapCanvas.tsx             # 2D Harita Görünümü (MapLibre GL + Deck.gl Overlay), Katman Senkronizasyonu
│   ├── panels/                       # Bilgi ve Analiz Panelleri (HUD)
│   │   ├── BookmarksPanel.tsx        # localStorage Kayıtlı Favori Konumlar Listesi ve Haritada Uçuş Tetikleyicisi
│   │   ├── ISSPanel.tsx              # ISS Anlık Telemetri Verileri (Hız, Yükseklik) ve Gelecek Yörünge Tahmini
│   │   ├── LiveStreamPanel.tsx       # NASA ISS Canlı Video Akışı (YouTube Embed), Yerel, UTC ve Güneş Saati (LMST) Göstergeleri
│   │   ├── LocationDetailPanel.tsx   # Tıklanan Konumun Detayları, 15 Noktalı SVG Yükseklik Profili, SVG İklim Anomalisi Eğrisi ve Favori Ekleme Düğmesi
│   │   ├── PassPredictorPanel.tsx    # SGP4 Motoru ile Konum Özelinde 24 Saatlik Ufuk Üstü ISS Görünürlük Hesaplaması
│   │   └── WeatherPanel.tsx          # Konum Seçilmediğindeki Genel Hava ve Deniz Durumu Paneli
│   └── ui/                           # Genel Kullanıcı Arayüzü Elemanları
│       ├── CoordDisplay.tsx          # Harita Üzerindeki İmleç/Seçim Koordinat Göstergesi (HUD)
│       ├── ErrorBoundary.tsx         # WebGL Render Çökmelerini İzole Eden Güvenlik Çerçevesi
│       ├── LayerOrderPanel.tsx       # Kullanıcının Katman Render Sırasını (Z-index) Değiştirmesini Sağlayan Sıralama Kontrolü
│       ├── ParticleSettingsPanel.tsx # Windy Tarzı Yoğunluk, Kalınlık, Hız ve Kuyruk Ayarları Arayüzü
│       ├── ScaleBar.tsx              # Harita Ölççek Göstergesi
│       ├── SearchBar.tsx             # Open-Meteo Geocoding Entegrasyonlu Şehir/Konum Arama Kutusu
│       ├── SkeletonLoader.tsx        # Yükleme Sırasında Gösterilen Gölgeli/Animasyonlu İskelet Şablonları (Shimmer Effect)
│       ├── TimeLegend.tsx            # Katman Göstergeleri ve Renk Skalaları (Sıcaklık, Yağış, Rüzgar, Bulut, SST)
│       ├── Toast.tsx                 # Bildirim ve Hata Toast Arayüzü
│       └── Toolbar.tsx               # Modülleri, Altlık Haritaları ve Hava Katmanlarını Açıp Kapatan Ana HUD Araç Çubuğu
├── hooks/                            # Dinamik Yaşam Döngüsü ve State Hook'ları
│   ├── useISS.ts                     # ISS Anlık Konum Çekimi, SGP4 Yörünge Çözümleme Döngüsü, Kepler Fallback ve Rota Düzgünleştirme (Interpolation)
│   ├── useModules.ts                 # Modül Açma/Kapama, Karşılıklı Dışlayan Seçim Grupları (Mutex) ve Parçacık Modifikasyon Ayarları
│   └── useSun.ts                     # SunCalc Astronomik Hesaplamalar, Terminatör Sınırı ve Alacakaranlık Feathering Bandları
├── lib/                              # Çekirdek Kütüphaneler, Fizik Motorları ve API Bağlantıları
│   ├── api.ts                        # Open-Meteo, Marine ve Tarihsel İklim Arşivi API Entegrasyonları ve Dil Çeviri Tesisleri
│   ├── audio.ts                      # Web Audio API Siber-Akustik Beep ve Radar Telemetri Ses Sentezleyicisi
│   ├── canvasStyle.ts                # Harita Taban Stilleri ve Otomatik 2D↔3D Switch Eşik Sabitleri
│   ├── fetchWithRetry.ts             # Host Başına Eşzamanlı İstek Sınırlayıcı, Exponential Backoff, 429 Hata Yönetimi ve Tip Güvenliği Validatörleri
│   ├── geo.ts                        # Ters Coğrafi Kodlama (Reverse Geocoding) ve Geometrik Hesaplamalar
│   ├── map.ts                        # Rüzgar Verisi için IDW (Inverse Distance Weighting) Enterpolasyonu ve GPU Trips Katmanı Yol Üreticisi
│   ├── pulse.ts                      # Haritada Çakışmayı Önleyen Cursor/ISS Farklı Frekanslı Işık Darbesi (Pulse) Hesaplayıcısı
│   ├── sgp4.ts                       # CelesTrak TLE Parse İşlemleri, Kepler/Newton-Raphson Çözücüleri ve Gözlemci Bakış Açıları (Azimuth, Elevation)
│   └── tiles.ts                      # NASA GIBS, RainViewer ve Uydu Altlık Haritaları URL Üreticileri
├── public/                           # Statik Dosyalar ve Servis İşçileri
│   └── sw.js                         # Stale-While-Revalidate Map Tiles ve Network-First API Çevrimdışı Önbellekleme Katmanı (v3)
├── types/                            # Global Veri Tipleri
│   └── index.ts                      # Tüm Uygulamanın TypeScript Interface ve Tip Tanımlamaları
```

---

## ⚙️ Çekirdek Alt Sistemlerin Çalışma Mantığı

### 1. SGP4 Yörünge Mekaniği ve Geçiş Tahmin Motoru (`lib/sgp4.ts`, `components/panels/PassPredictorPanel.tsx`)
Uygulama, ISS'in gelecekteki rotasını çizmek ve gözlemciler için ufuk üstü görünürlük tahminleri yapmak için istemci tarafında çalışan tam teşekküllü bir yörünge mekaniği motoru barındırır:
* **TLE Verisi:** CelesTrak sunucularından güncel Two-Line Element (TLE) verileri çekilir, `localStorage`'da önbelleğe alınır ve 1 saatte bir güncellenir.
* **Kepler Çözücü:** TLE içindeki mean motion, inclination, eccentricity, RAAN ve BSTAR drag terimleri parse edilir. Newton-Raphson iterasyonu ile Kepler denklemi çözülerek ISS'in ECI (Earth-Centered Inertial) uzayındaki konumu hesaplanır.
* **Geodetic Dönüşüm:** Greenwich Sidereal Time (GST) hesaplanarak ECI koordinatları dünya enlem, boylam ve yüksekliğine (WGS84) dönüştürülür.
* **Geçiş Analizi (Pass Predictor):** Seçilen koordinatlar gözlemci kabul edilerek gelecek 24 saat 30 saniyelik adımlarla taranır. Gözlemcinin ufkuna göre ISS'in Ufuk Yüksekliği (Elevation) ve Yön Açısı (Azimuth) hesaplanır. Elevation açısı 10°'yi aşan aralıklar tespit edilip yerel zamanlar ve pusula yönleriyle listelenir.

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

### 4. GPU Parçacık Akış Katmanları (TripsLayer) ve Performans Yönetimi (`components/globe/GlobeCanvas.tsx`, `hooks/useModules.ts`)
Rüzgar akıntıları ve yağış dalgaları haritada binlerce hareketli parçacıkla simüle edilir:
* **Deck.gl TripsLayer:** GPU üzerinde hesaplanan parçacıklar, vektör alan verilerine (Open-Meteo) göre oluşturulan iz yolları (paths) üzerinde kaydırılır.
* **Windy Kontrolleri:** Yoğunluk, kuyruk uzunluğu, kalınlık ve hız çarpanı Windy benzeri bir panelden (`ParticleSettingsPanel.tsx`) anlık olarak değiştirilebilir.
* **Performans Modu (FPS Throttle):** Cihaz donanımını yormamak amacıyla performans modu açıldığında parçacık sayısı 1/3 oranına indirilir, render döngüsü 30 FPS'e sabitlenir (`minFrameInterval = 33ms`) ve trail parametreleri optimize edilir.

### 5. WebGL Hata Kurtarma ve GPU Context Loss Yönetimi (`components/globe/GlobeCanvas.tsx`, `components/map/MapCanvas.tsx`)
WebGL bağlamının (context) kaybolması durumunda arayüzün kilitlenmesi veya siyah ekranda kalması engellenmiştir:
* **Bağlam İzleyici:** `webglcontextlost` ve `webglcontextrestored` olayları yakalanır.
* **State Machine:** Sistem `active` -> `lost` -> `recovering` -> `active` döngüsünde çalışır.
* **Yeniden Yükleme:** Exponential backoff süresiyle (300ms, 600ms, 1200ms) Deck.gl/MapLibre motorları arka planda otomatik olarak yeniden ayağa kaldırılır. Sekme arka plana alındığında delta-time güncellemeleri durdurularak GPU kaynakları korunur.

### 6. Ağ Direnci ve Çevrimdışı Çalışma (Service Worker & FetchWithRetry)
* **fetchWithRetry:** API çağrıları rate limitlere ve anlık kesintilere karşı korunur. Host başına en fazla 4 eşzamanlı istek sınırlandırılır, exponential backoff ile yeniden denemeler yapılır ve `safeNum/safeStr` doğrulayıcılarıyla JSON parse hataları veya NaN değerler temizlenir.
* **Service Worker (sw.js):** Harita/uydu karoları (tiles) için *Stale-While-Revalidate* stratejisi uygulanarak cached karolar anında ekrana basılır ve arkada güncellenir. API istekleri için ise *Network-First* stratejisi ve 2 dakikalık önbellek süresi (offline durumunda 10 dakikaya uzayan fallback) kullanılır.

---

## 🛣️ Yapay Zekâ (AI) Ajanları İçin Yol Haritası (Gelecek Geliştirme Adımları)

Projeye yeni özellikler eklemek isteyen AI ajanlarının aşağıdaki adımları sırasıyla izlemesi önerilir:

### Faz 5: Meteorolojik Uyarılar ve Gelişmiş CBS Katmanları
* **Hedef:** Seçili koordinatlarda aktif kasırga, ekstrem sıcaklık veya yoğun yağış uyarıları varsa kullanıcıya anlık bildirim gösterilmesi.
* **Dosyalar:**
  * `lib/api.ts` içerisine Open-Meteo Weather Alerts API'sinden veri çeken `fetchWeatherAlerts` fonksiyonu eklenmeli.
  * `components/panels/LocationDetailPanel.tsx` içerisinde bu uyarıları gösteren yanıp sönen bir acil durum HUD uyarısı tasarlanmalı.
  * `types/index.ts` dosyasına ilgili veri tipleri girilmeli.

### Faz 6: Çoklu Uydu Takibi ve Özel Yörünge Çizimleri
* **Hedef:** Sadece ISS değil, Hubble Uzay Teleskobu (HST), Starlink takımları veya Tiangong Uzay İstasyonu gibi diğer uyduların da seçilebilmesi ve yörüngelerinin SGP4 ile çözümlenmesi.
* **Dosyalar:**
  * `hooks/useISS.ts` adı `useSatellites.ts` olarak genelleştirilmeli ve seçili uydu kimliğine (NORAD ID) göre CelesTrak'tan ilgili TLE verisi çekilmeli.
  * `components/panels/ISSPanel.tsx` uydular arası geçiş yapmayı sağlayan bir açılır kutu (select box) barındıracak şekilde güncellenmeli.
  * `components/globe/GlobeCanvas.tsx` ve `components/map/MapCanvas.tsx` içinde birden fazla uydunun anlık konumları ve rotaları farklı renklerde Deck.gl katmanları olarak render edilmeli.

### Faz 7: Progressive Web App (PWA) ve Gelişmiş Çevrimdışı Mod
* **Hedef:** Uygulamanın bir mobil uygulama gibi kurulabilmesi ve önceden kaydedilen favori konumların harita karolarının tamamen çevrimdışı görüntülenebilmesi.
* **Dosyalar:**
  * `public/manifest.json` ve uygun logolar (`public/icons/`) oluşturulmalı.
  * `public/sw.js` dosyasına statik uygulama iskeletini (app shell) ve temel yazı tiplerini önceden önbelleğe alacak (pre-cache) yaşam döngüsü eklenmeli.
  * `components/panels/BookmarksPanel.tsx` içerisindeki favori konumların çevresindeki 3 level harita tile'larını önceden indirip cache'e yazacak bir "Çevrimdışı İndir" düğmesi yerleştirilmeli.
