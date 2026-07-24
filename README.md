<p align="center">
  <img src="https://img.shields.io/badge/%F0%9F%8C%8D_Earth_Tracker-00e5ff?style=for-the-badge&labelColor=000011" alt="Earth Tracker"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/WebGL2-Deck.gl_9-199900?style=flat-square" />
  <img src="https://img.shields.io/badge/MapLibre-5-1a73e8?style=flat-square" />
  <img src="https://img.shields.io/badge/API_Key-Gerekmez!-00e676?style=flat-square" />
</p>

# 🌍 Earth Tracker: Entegre 2D/3D Coğrafi Bilgi Sistemi (CBS) Portal

**Earth Tracker**, uzay boşluğundaki uydulardan kapınızın önündeki sokağa kadar, yeryüzünün anlık nabzını tutmanızı sağlayan WebGL2 destekli interaktif bir dünya simülasyonu ve coğrafi analiz aracıdır.

**Hiçbir API anahtarı (API Key) veya üyelik gerektirmeden**, doğrudan tarayıcınızın grafik işlemcisini (GPU) kullanarak çalışan modern bir CBS visualizer'dır.

---

## ✨ Neler Yapabilirsiniz? (Temel Özellikler)

### 🛰️ 1. ISS Takibi, Canlı Yayın ve Yörünge Tahmini
* **Anlık Telemetri:** Uluslararası Uzay İstasyonu'nun (ISS) anlık enlem, boylam, hız (km/h) ve yükseklik (km) verilerini saniyelik güncellemelerle takip edin.
* **NASA Canlı Yayını:** ISS kameralarından doğrudan dünyaya aktarılan canlı HD video yayınını panel içerisinden izleyin.
* **Görünürlük Hesaplayıcı (Pass Predictor):** SGP4 yörünge mekaniği çözücüsü sayesinde, seçtiğiniz herhangi bir konum üzerinde önümüzdeki 24 saat içinde gerçekleşecek ufkunuza açık (Elevation > 10°) geçişlerin saatlerini, zirve açılarını ve yönlerini önceden hesaplayın.
* **Astronomik Zamanlar:** Seçtiğiniz koordinatın veya ISS'in güncel boylamına göre anlık güneş açısını temsil eden **Yerel Ortalama Güneş Saatini (LMST)** izleyin.

### 🗻 2. Topografik Arazi Kesit Analizi
* Harita üzerinde tıkladığınız herhangi bir noktanın çevresindeki arazi yapısını inceleyin.
* Merkez noktanın 10 km batısından 10 km doğusuna uzanan hat boyunca 15 farklı ölçüm noktasıyla oluşturulan **Topografik Yükseklik Profili SVG Grafiği** sayesinde dağlık ve engebeli yapıları kesit analizi olarak inceleyin.

### 📊 3. Tarihsel İklim Anomalileri
* Seçtiğiniz konumun güncel hava sıcaklığı değerini görmekle kalmayın, bu değerin son 3 yılın ilgili ayına ait geçmiş arşiv verilerinin ortalamasından ne kadar saptığını (sıcaklık anomalisi) hesaplayın.
* Kesik çizgilerle çizilen tarihsel iklim normu ile güncel ölçümü karşılaştıran SVG grafik arayüzü sayesinde küresel ısınma sapmalarını anlık takip edin.

### 🌪️ 4. Windy Tarzı Dinamik Parçacık Akışları
* Rüzgar akıntılarını ve yağış hareketlerini harita üzerinde akan binlerce GPU parçacığı ile simüle edin.
* Akış çizgilerinin yoğunluğunu, kalınlığını, hızını ve kuyruk uzunluğunu HUD kontrol panelinden dilediğiniz gibi özelleştirin.
* Mobil ve düşük donanımlı cihazlar için tek tıkla kare hızını sabitleyip parçacık yükünü hafifleten **Performans Modunu** aktif edin.

### 🌓 5. Gece/Gündüz Sınırı ve Alacakaranlık Bandları
* Dünya üzerindeki fiziksel gece/gündüz sınırını (Terminator) yumuşak geçişli alacakaranlık bandlarıyla (Civil, Nautical, Astronomical twilight) izleyin.
* Gece olan bölgelerde NASA'nın *Black Marble* uydu haritası üzerinden şehirlerin gece ışıklarını açıp kapatın.

### 🌊 6. Entegre Hava ve Deniz Durumu Katmanları
* Sıcaklık, bulut yoğunluğu ve yağış katmanlarını (NASA GIBS ve RainViewer) harita üzerine serin.
* Denizcilik (Marine) modülünü açarak okyanus dalga yüksekliklerini ve su sıcaklığı (SST) skalasını haritada dinamik veri noktalarıyla gözlemleyin.
* **Katman Sıralama Arayüzü:** Aktif ettiğiniz meteorolojik katmanların render sırasını (Z-index) sürükle-bırak/yukarı-aşağı kontrolleriyle anlık olarak değiştirerek Z-fighting yırtılmalarını engelleyin.

### 📌 7. Çevrimdışı Çalışma ve Favori Yer İmleri
* Sık takip ettiğiniz konumları favori yıldız butonuyla kaydedin. Kayıtlı yer imlerinize tıklayarak haritanın o konuma otomatik uçmasını sağlayın.
* **Service Worker (sw.js v3) Gücü:** Harita uydu karoları ve API yanıtları akıllı stratejilerle cache'lenir; internet bağlantınız kopsa veya zayıflasa dahi daha önce gezindiğiniz haritalar ve veriler görüntülenmeye devam eder.

---

## 🎧 Siber-Akustik Ses Geri Bildirimleri

Uygulama, etkileşim hissini artırmak amacıyla Web Audio API tabanlı siber-akustik sentez sesler barındırır:
* 🗺️ Haritada arama başarılı olduğunda veya yer imlerine uçuş başladığında onay sinyali (`playBeep('search')`).
* 🛰️ ISS, seçtiğiniz konuma **1000 km veya daha yakın** bir mesafeye girdiğinde 12 saniyede bir çalan radar arama telemetrisi beep tonları (`playBeep('radar')`).

---

## 🚀 Hızlı Başlangıç

### Gereksinimler
* [Node.js](https://nodejs.org/) (v18+)

### Kurulum adımları
1. Proje dizininde terminali açın:
   ```bash
   npm install
   ```
2. Geliştirici sunucusunu başlatın:
   ```bash
   npm run dev
   ```
3. Tarayıcınızda şu adresi açın: **[http://localhost:3000](http://localhost:3000)**

### Canlı Dağıtım (Production Build & Vercel)
Uygulamayı derlemek veya canlıya almak için:
```bash
# Yerel derleme testi
cmd /c npm run build

# Vercel ile anında dağıtım
npx vercel --prod
```

---

## 🛠️ Teknik Altyapı
* **Framework:** Next.js 16.1 (App Router) & React 19
* **Dinamik Render:** Deck.gl 9 (MapboxOverlay, TripsLayer, ScatterplotLayer)
* **2D/3D Harita Altlığı:** MapLibre GL 5 (küre/mercator projeksiyon)
* **Hesaplama Motoru:** SunCalc (astronomik hesaplamalar)
* **Veri API'leri:** Open-Meteo (Hava, Deniz, Arazi, Arşiv, Geocoding), wheretheiss.at, NASA GIBS, RainViewer

---

## 📜 Lisans

Bu proje **MIT** lisansı altında lisanslanmıştır. Serbestçe dağıtılabilir, değiştirilebilir ve ticari/bireysel projelerde kullanılabilir.
