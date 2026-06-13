---
trigger: always_on
---

# 🤖 Yapay Zekâ (AI) Ajanları İçin Çalışma Talimatları ve Kurallar (AGENT.md)

Bu belge, **Earth Tracker** projesinde geliştirme yapacak, hata ayıklayacak veya soru yanıtlayacak tüm yapay zekâ (AI) ajanları için **uyması zorunlu çekirdek kuralları** ve çalışma rehberini belirler.

---

## 🚨 ÇALIŞMAYA BAŞLAMADAN ÖNCE (ZORUNLU ADIM)

Herhangi bir kod yazmadan, dosyayı düzenlemeden veya kullanıcı sorusuna cevap vermeden önce **HER ZAMAN** aşağıdaki dosyaları en baştan okumanız gerekir:
1. [README.md](file:///c:/Users/HP/DEV/ISS/README.md) (Tüketici odaklı özellikleri ve uygulama kapsamını anlamak için).
2. [ARCHITECTURE.md](file:///c:/Users/HP/DEV/ISS/ARCHITECTURE.md) (Dosya düzenini, yörünge mekaniği/topografi gibi alt sistemleri ve katman mimarisini anlamak için).
3. [package.json](file:///c:/Users/HP/DEV/ISS/package.json) (Next.js, React, Deck.gl ve MapLibre kütüphanelerinin mevcut versiyon uyumluluklarını kontrol etmek için).

---

## 🛠️ ÇEKİRDEK GELİŞTİRME KURALLARI VE SINIRLAMALAR

### 1. Dil ve Terim Bütünlüğü (Language & Wording)
* **Kural:** Arayüz metinleri, kullanıcı bildirimleri (toast), hata mesajları ve bileşen içi yorumlar **Türkçe** olmalıdır (Kullanıcı aksini istemediği sürece).
* Bileşenlerin prop tanımları ve fonksiyon isimleri İngilizce yazılmalıdır (örn. `onBookmarkChange`, `fetchClimatology`).

### 2. Arayüz ve Tasarım Bütünlüğü (Aesthetics)
* **Kural:** Uygulamaya yeni bir harici UI kütüphanesi (Chakra, Material UI, Shadcn vb.) **eklemeyin**. Mevcut CSS mimarisini ve Tailwind sınıflarını kullanın.
* Glassmorphism temasını koruyun: Tüm paneller `.glass` veya `.glass-elevated` sınıflarına sahip olmalı, uydu haritaları üzerinde kontrastı korumak için `.hud-value` ve `.hud-label` metin gölgeleri (`text-shadow`) barındırmalıdır.

### 3. WebGL, GPU ve Katman Yönetimi (Z-Fighting)
* **Kural:** 3D veya 2D harita katmanları eklerken veya düzenlerken Z-fighting (piksel titremesi/yırtılması) olmasını engellemek için poligonlara mutlaka `polygonOffset` uygulayın. Şeffaf veri veya marker katmanlarına `depthWriteEnabled: false` parametresini geçin.
* WebGL context kaybını yöneten state machine yapısını bozmayın. Sekme arka plana alındığında animasyon hesaplama döngülerini askıya alın (`lastTickRef` sıfırlama mantığını koruyun).

### 4. TypeScript Strictness ve Hata Yönetimi
* **Kural:** Projede TypeScript uyarıları veya derleme hataları **kabul edilemez**. Değişken tiplerinde `any` kullanmaktan kaçının.
* Yeni veri tiplerini her zaman [types/index.ts](file:///c:/Users/HP/DEV/ISS/types/index.ts) içine ekleyin ve oradan import edin.

### 5. API Direnci (Resiliency) ve Validasyon
* **Kural:** Dış API'lere (Open-Meteo, CelesTrak vb.) yapılacak tüm bağlantılarda doğrudan `fetch` kullanmayın; istek kuyruklama ve exponential backoff barındıran `fetchWithRetry()` fonksiyonunu kullanın.
* API yanıtlarındaki JSON alanlarını doğrulamadan state'e yazmayın veya render etmeyin. NaN ve bozuk verileri engellemek için mutlaka `safeNum(val, fallback)` veya `safeStr(val, fallback)` doğrulayıcılarını kullanın.

### 6. Siber-Akustik Ses Kontrolleri (Sound Signals)
* **Kural:** Telemetri ve etkileşim seslerini (`playBeep`) koruyun.
* ISS mesafe kontrolleri gibi sürekli çalışan döngülerde ses tetiklenecekse, ses kirliliğini engellemek amacıyla mutlaka zaman damgası (timestamp) kontrolü ile en az 12 saniyelik bir throttle/debounce filtresi uygulayın.

---

## 📝 DEĞİŞİKLİKLERİ PROPOZE ETME VE VERİFİKASYON PROSEDÜRÜ

1. Kod üzerinde yaptığınız değişikliklerden sonra projeyi mutlaka derleyin:
   ```bash
   cmd /c npm run build
   ```
2. Derlemede hiçbir TypeScript uyarısı, lint hatası veya Next.js sayfa oluşturma (prerender) hatası kalmadığından emin olun.
3. Tamamlanan her faz veya kritik hata düzeltmesinden sonra [fix.md](file:///c:/Users/HP/DEV/ISS/fix.md) dosyasını güncelleyin ve neyi nasıl çözdüğünüzü bu dosyaya işleyin.
