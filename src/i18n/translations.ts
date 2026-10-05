// Internationalized dictionaries for Muslim-majority languages

import { SupportedLocale } from './config';

export interface Translations {
  brand: {
    title: string;
    subtitle: string;
  };
  search: {
    placeholder: string;
    clear: string;
  };
  controls: {
    time: string;
    map: string;
    satellite: string;
    followAdhan: string;
    convention: string;
    zenMode: string;
    fullscreen: string;
    places: string;
    layers: string;
    legendLines: string;
    legendRings: string;
    legendArcs: string;
    hint: string;
    shortcuts: string;
    search: string;
    share: string;
    linkCopied: string;
    shareMessage: string;
    pause: string;
    clearSearch: string;
    language: string;
    credits: string;
  };
  credits: {
    title: string;
    acknowledgments: string;
    contributorName: string;
    contributorHandle: string;
    contributorArabicName: string;
    contributorRole: string;
    projectBy: string;
    waqfDescription: string;
    licenseTitle: string;
    stackTitle: string;
    stack3d: string;
    stackAstronomy: string;
    stackEdge: string;
    close: string;
  };
  prayers: {
    fajr: string;
    sunrise: string;
    dhuhr: string;
    asr: string;
    maghrib: string;
    isha: string;
    terminator: string;
  };
  inspector: {
    localTime: string;
    qiblaBearing: string;
    fromNorth: string;
    next: string;
    close: string;
    atKaaba: string;
  };
  timeline: {
    title: string;
    subtitle: string;
    coverage: string;
    longestGap: string;
    peakFront: string;
    unbroken: string;
    cities: string;
    coverageTip: string;
    gapTip: string;
    peakTip: string;
  };
}

export const DICTIONARIES: Record<SupportedLocale, Translations> = {
  en: {
    brand: {
      title: 'ADHAN EARTH',
      subtitle: 'Planetary Observatory',
    },
    search: {
      placeholder: 'Search city (e.g. Amman, Makkah, Tokyo)...',
      clear: 'Clear search input',
    },
    controls: {
      time: 'Time',
      map: 'Map',
      satellite: 'Satellite',
      followAdhan: 'Follow Adhān',
      convention: 'Prayer calculation convention',
      zenMode: 'Toggle clean planetary view',
      fullscreen: 'Full screen',
      places: 'Places',
      layers: 'Layers',
      legendLines: 'Lines: where each prayer time is starting right now.',
      legendRings: 'Rings and beams: cities where the adhan is being called now.',
      legendArcs: 'Arcs: the direction from a city to Makkah.',
      hint: 'Drag to rotate · Scroll to zoom · H hides controls · F full screen',
      shortcuts: 'Keyboard shortcuts',
      search: 'Search',
      share: 'Share view',
      linkCopied: 'Link copied',
      shareMessage: 'Watch prayer times and the adhan move across the Earth in real-time on a live 3D planetary globe 🌍🕌',
      pause: 'Pause',
      clearSearch: 'Clear search',
      language: 'Language',
      credits: 'Credits & Stack',
    },
    credits: {
      title: 'Credits & About',
      acknowledgments: 'Special Thanks & Contributors',
      contributorName: 'Muddaththir ‘Ismāʻīl bin Dāniyāl al-Amrīkī',
      contributorHandle: '@theIslampill',
      contributorArabicName: 'مدثر إسماعيل بن دانيال',
      contributorRole: 'For the technical discussions, ideations, and bug reporting.',
      projectBy: 'A Project by WaqfTech.org',
      waqfDescription: 'An independent open-source digital waqf building technology for the Muslim world.',
      licenseTitle: 'Waqf Digital Public License (Waqf-DPL 1.0)',
      stackTitle: 'Technology Stack',
      stack3d: '3D Engine: Three.js with custom GLSL shaders for solar day/night terminator, atmospheric scattering, and GPU-instanced minarets.',
      stackAstronomy: 'Astronomy & Fiqh: Pure TypeScript NOAA and Meeus algorithms calculating solar position, prayer contours, and Qibla bearings.',
      stackEdge: 'Edge Compute: Cloudflare Workers with zero ambient telemetry, edge geolocation, and global asset caching.',
      close: 'Close credits',
    },
    prayers: {
      fajr: 'Fajr',
      sunrise: 'Sunrise',
      dhuhr: 'Dhuhr',
      asr: 'ʿAsr',
      maghrib: 'Maghrib',
      isha: 'ʿIsha',
      terminator: 'Terminator',
    },
    inspector: {
      localTime: 'Local Time',
      qiblaBearing: 'Qibla Bearing',
      fromNorth: 'from N',
      next: 'Next',
      close: 'Close inspector',
      atKaaba: 'At the Kaaba',
    },
    timeline: {
      title: 'Continuous Planetary Adhān',
      subtitle: '24-Hour Solar Traversal',
      coverage: 'Adhan somewhere',
      longestGap: 'Longest silence',
      peakFront: 'Busiest moment',
      unbroken: 'None',
      cities: 'cities',
      coverageTip: 'Share of the day when the adhan is being called somewhere on Earth.',
      gapTip: 'Longest stretch of the day with no adhan anywhere on Earth.',
      peakTip: 'Most cities calling the adhan at the same time.',
    },
  },

  ar: {
    brand: {
      title: 'أذان الأرض',
      subtitle: 'المرصد الفلكي العالمي',
    },
    search: {
      placeholder: 'ابحث عن مدينة (مثل: عمّان، مكة، طوكيو)...',
      clear: 'مسح البحث',
    },
    controls: {
      time: 'الوقت',
      map: 'الخريطة',
      satellite: 'القمر الصناعي',
      followAdhan: 'تتبع الأذان',
      convention: 'طريقة حساب المواقيت',
      zenMode: 'عرض الكوكب النقي',
      fullscreen: 'ملء الشاشة',
      places: 'أماكن',
      layers: 'الطبقات',
      legendLines: 'الخطوط: أين يدخل وقت كل صلاة الآن.',
      legendRings: 'الحلقات والأعمدة: مدن يُرفع فيها الأذان الآن.',
      legendArcs: 'الأقواس: اتجاه المدينة نحو مكة.',
      hint: 'اسحب للتدوير · مرّر للتقريب · H لإخفاء الأدوات · F لملء الشاشة',
      shortcuts: 'اختصارات لوحة المفاتيح',
      search: 'بحث',
      share: 'مشاركة العرض',
      linkCopied: 'تم نسخ الرابط',
      shareMessage: 'شاهد حركة مواقيت الصلاة ونداء الأذان حول كوكب الأرض في بث حي ومباشر عبر مرصد ثلاثي الأبعاد 🌍🕌',
      pause: 'إيقاف مؤقت',
      clearSearch: 'مسح البحث',
      language: 'اللغة',
      credits: 'شكر وتقدير والتقنيات',
    },
    credits: {
      title: 'شكر وتقدير وعن المشروع',
      acknowledgments: 'شكر وتقدير خاص',
      contributorName: 'Muddaththir ‘Ismāʻīl bin Dāniyāl al-Amrīkī',
      contributorHandle: '@theIslampill',
      contributorArabicName: 'مدثر إسماعيل بن دانيال',
      contributorRole: 'للمناقشات التقنية، وتوليد الأفكار، والإبلاغ عن الملاحظات والخلل البرمجي.',
      projectBy: 'مشروع مقدم من وقف تك (WaqfTech.org)',
      waqfDescription: 'مبادرة تقنية وقفية مفتوحة المصدر لخدمة الأمة وبناء بنية تحتية رقمية حرة.',
      licenseTitle: 'رخصة الوقف الرقمية العامة (Waqf-DPL 1.0)',
      stackTitle: 'الحزمة التقنية',
      stack3d: 'المحرك ثلاثي الأبعاد: مكتبة Three.js مع مظللات GLSL مخصصة لخط الشفق ليل/نهار وتشتت الغلاف الجوي وأعمدة المآذن.',
      stackAstronomy: 'الفلك والمواقيت: خوارزميات NOAA وميوس بحسابات TypeScript نقية لمواقع الشمس ومسارات الأذان واتجاه القبلة.',
      stackEdge: 'الحوسبة الطرفية: منصة Cloudflare Workers دون أي تتبع، مع تحديد الموقع الجغرافي وتوزيع الملفات عالمياً.',
      close: 'إغلاق',
    },
    prayers: {
      fajr: 'الفجر',
      sunrise: 'الشروق',
      dhuhr: 'الظهر',
      asr: 'العصر',
      maghrib: 'المغرب',
      isha: 'العشاء',
      terminator: 'خط الشفق',
    },
    inspector: {
      localTime: 'الوقت المحلي',
      qiblaBearing: 'اتجاه القبلة',
      fromNorth: 'من الشمال',
      next: 'الصلاة القادمة',
      close: 'إغلاق التفاصيل',
      atKaaba: 'عند الكعبة',
    },
    timeline: {
      title: 'استمرارية الأذان على مدار الساعة',
      subtitle: 'دورة الشمس على مدار 24 ساعة',
      coverage: 'التغطية',
      longestGap: 'أطول انقطاع',
      peakFront: 'ذروة المدن المتزامنة',
      unbroken: '0 ثانية (مستمر دون انقطاع)',
      cities: 'مدينة',
      coverageTip: 'نسبة اليوم التي يُرفع فيها الأذان في مكان ما على الأرض.',
      gapTip: 'أطول فترة في اليوم لا يُرفع فيها أذان في أي مكان.',
      peakTip: 'أكبر عدد من المدن يرفع الأذان في اللحظة نفسها.',
    },
  },

  tr: {
    brand: {
      title: 'EZAN DÜNYASI',
      subtitle: 'Gezegen Gözlemevi',
    },
    search: {
      placeholder: 'Şehir ara (örn. İstanbul, Mekke, Tokyo)...',
      clear: 'Aramayı temizle',
    },
    controls: {
      time: 'Zaman',
      map: 'Harita',
      satellite: 'Uydu',
      followAdhan: 'Ezanı Takip Et',
      convention: 'Vakit hesaplama yöntemi',
      zenMode: 'Sade küre görünümü',
      fullscreen: 'Tam ekran',
      places: 'Yerler',
      layers: 'Katmanlar',
      legendLines: 'Çizgiler: her vaktin şu anda girdiği yer.',
      legendRings: 'Halkalar ve sütunlar: ezanın şu anda okunduğu şehirler.',
      legendArcs: 'Yaylar: şehirden Mekke’ye yön.',
      hint: 'Döndürmek için sürükleyin · Yakınlaştırmak için kaydırın · H: arayüzü gizle · F: tam ekran',
      shortcuts: 'Klavye kısayolları',
      search: 'Ara',
      share: 'Görünümü paylaş',
      linkCopied: 'Bağlantı kopyalandı',
      shareMessage: 'Ezanın ve namaz vakitlerinin Dünya genelindeki hareketini canlı 3D küre üzerinde anlık izleyin 🌍🕌',
      pause: 'Duraklat',
      clearSearch: 'Aramayı temizle',
      language: 'Dil',
      credits: 'Katkıda Bulunanlar ve Teknoloji',
    },
    credits: {
      title: 'Katkıda Bulunanlar ve Hakkında',
      acknowledgments: 'Özel Teşekkür',
      contributorName: 'Muddaththir ‘Ismāʻīl bin Dāniyāl al-Amrīkī',
      contributorHandle: '@theIslampill',
      contributorArabicName: 'مدثر إسماعيل بن دانيال',
      contributorRole: 'Teknik tartışmalar, fikir geliştirme ve hata bildirimleri için.',
      projectBy: 'WaqfTech.org Projesi',
      waqfDescription: 'İslam dünyası için dijital kamu altyapısı geliştiren açık kaynaklı vakıf girişimi.',
      licenseTitle: 'Vakıf Dijital Kamu Lisansı (Waqf-DPL 1.0)',
      stackTitle: 'Teknoloji Mimarisi',
      stack3d: '3D Motoru: Özel GLSL gölgelendiricileriyle Three.js, gündüz/gece aydınlanma çizgisi ve minare görselleştirmesi.',
      stackAstronomy: 'Astronomi ve Vakitler: NOAA ve Meeus algoritmalarıyla saf TypeScript güneş konumu ve namaz hatları hesabı.',
      stackEdge: 'Uç Bilişim: Sıfır telemetri ve küresel önbellekleme ile Cloudflare Workers.',
      close: 'Kapat',
    },
    prayers: {
      fajr: 'İmsak',
      sunrise: 'Güneş',
      dhuhr: 'Öğle',
      asr: 'İkindi',
      maghrib: 'Akşam',
      isha: 'Yatsı',
      terminator: 'Aydınlanma Çemberi',
    },
    inspector: {
      localTime: 'Yerel Saat',
      qiblaBearing: 'Kıble Açısı',
      fromNorth: 'Kuzeyden',
      next: 'Sıradaki Vakit',
      close: 'Bilgi panelini kapat',
      atKaaba: 'Kâbe’de',
    },
    timeline: {
      title: 'Dünya Çapında Kesintisiz Ezan',
      subtitle: '24 Saatlik Güneş Döngüsü',
      coverage: 'Kapsama',
      longestGap: 'En Uzun Boşluk',
      peakFront: 'Eşzamanlı Zirve',
      unbroken: '0 sn (Kesintisiz)',
      cities: 'şehir',
      coverageTip: 'Günün, dünyanın bir yerinde ezan okunan oranı.',
      gapTip: 'Günün, dünyanın hiçbir yerinde ezan okunmayan en uzun süresi.',
      peakTip: 'Aynı anda ezan okunan en çok şehir sayısı.',
    },
  },

  id: {
    brand: {
      title: 'ADZAN BUMI',
      subtitle: 'Observatorium Planet',
    },
    search: {
      placeholder: 'Cari kota (mis. Jakarta, Makkah, Tokyo)...',
      clear: 'Hapus pencarian',
    },
    controls: {
      time: 'Waktu',
      map: 'Peta',
      satellite: 'Satelit',
      followAdhan: 'Ikuti Adzan',
      convention: 'Metode hisab waktu shalat',
      zenMode: 'Tampilan bumi murni',
      fullscreen: 'Layar penuh',
      places: 'Tempat',
      layers: 'Lapisan',
      legendLines: 'Garis: tempat waktu salat tiba sekarang.',
      legendRings: 'Cincin dan pilar: kota yang sedang mengumandangkan azan.',
      legendArcs: 'Busur: arah dari kota ke Makkah.',
      hint: 'Seret untuk memutar · Gulir untuk zoom · H sembunyikan kontrol · F layar penuh',
      shortcuts: 'Pintasan keyboard',
      search: 'Cari',
      share: 'Bagikan tampilan',
      linkCopied: 'Tautan disalin',
      shareMessage: 'Saksikan pergerakan waktu salat dan kumandang azan di seluruh dunia secara langsung di globe 3D 🌍🕌',
      pause: 'Jeda',
      clearSearch: 'Hapus pencarian',
      language: 'Bahasa',
      credits: 'Kredit & Teknologi',
    },
    credits: {
      title: 'Kredit & Tentang',
      acknowledgments: 'Penghargaan Khusus',
      contributorName: 'Muddaththir ‘Ismāʻīl bin Dāniyāl al-Amrīkī',
      contributorHandle: '@theIslampill',
      contributorArabicName: 'مدثر إسماعيل بن دانيال',
      contributorRole: 'Untuk diskusi teknis, pengembangan ide, dan pelaporan bug.',
      projectBy: 'Proyek oleh WaqfTech.org',
      waqfDescription: 'Wakaf teknologi sumber terbuka yang didedikasikan untuk infrastruktur digital publik umat.',
      licenseTitle: 'Lisensi Publik Digital Waqf (Waqf-DPL 1.0)',
      stackTitle: 'Teknologi yang Digunakan',
      stack3d: 'Mesin 3D: Three.js dengan shader GLSL kustom untuk garis siang/malam dan pancaran menara masjid.',
      stackAstronomy: 'Astronomi & Fiqih: Algoritma NOAA dan Meeus dalam TypeScript murni untuk hisab waktu salat dan kiblat.',
      stackEdge: 'Komputasi Tepi: Cloudflare Workers tanpa telemetri dengan latensi rendah di seluruh dunia.',
      close: 'Tutup',
    },
    prayers: {
      fajr: 'Subuh',
      sunrise: 'Terbit',
      dhuhr: 'Dzuhur',
      asr: 'Ashar',
      maghrib: 'Maghrib',
      isha: 'Isya',
      terminator: 'Garis Terminator',
    },
    inspector: {
      localTime: 'Waktu Lokal',
      qiblaBearing: 'Arah Kiblat',
      fromNorth: 'dari Utara',
      next: 'Shalat Berikutnya',
      close: 'Tutup panel info',
      atKaaba: 'Di Kakbah',
    },
    timeline: {
      title: 'Kontinuitas Adzan Global',
      subtitle: 'Lintasan Matahari 24 Jam',
      coverage: 'Cakupan',
      longestGap: 'Jeda Terpanjang',
      peakFront: 'Puncak Bersamaan',
      unbroken: '0 detik (Tanpa Henti)',
      cities: 'kota',
      coverageTip: 'Bagian hari ketika azan berkumandang di suatu tempat di Bumi.',
      gapTip: 'Jeda terpanjang dalam sehari tanpa azan di mana pun di Bumi.',
      peakTip: 'Jumlah kota terbanyak yang mengumandangkan azan bersamaan.',
    },
  },

  ms: {
    brand: {
      title: 'AZAN BUMI',
      subtitle: 'Balai Cerap Planet',
    },
    search: {
      placeholder: 'Cari bandar (cth. Kuala Lumpur, Makkah, Tokyo)...',
      clear: 'Kosongkan carian',
    },
    controls: {
      time: 'Masa',
      map: 'Peta',
      satellite: 'Satelit',
      followAdhan: 'Ikuti Azan',
      convention: 'Kaedah hisab solat',
      zenMode: 'Paparan bumi penuh',
      fullscreen: 'Skrin penuh',
      places: 'Tempat',
      layers: 'Lapisan',
      legendLines: 'Garisan: tempat waktu solat bermula sekarang.',
      legendRings: 'Cincin dan tiang: bandar yang sedang melaungkan azan.',
      legendArcs: 'Lengkung: arah dari bandar ke Makkah.',
      hint: 'Seret untuk putar · Tatal untuk zum · H sembunyi kawalan · F skrin penuh',
      shortcuts: 'Pintasan papan kekunci',
      search: 'Cari',
      share: 'Kongsi paparan',
      linkCopied: 'Pautan disalin',
      shareMessage: 'Saksikan pergerakan waktu solat dan laungan azan di seluruh dunia secara langsung di glob 3D 🌍🕌',
      pause: 'Jeda',
      clearSearch: 'Kosongkan carian',
      language: 'Bahasa',
      credits: 'Kredit & Teknologi',
    },
    credits: {
      title: 'Kredit & Perihal',
      acknowledgments: 'Penghargaan Khas',
      contributorName: 'Muddaththir ‘Ismāʻīl bin Dāniyāl al-Amrīkī',
      contributorHandle: '@theIslampill',
      contributorArabicName: 'مدثر إسماعيل بن دانيال',
      contributorRole: 'Untuk perbincangan teknikal, percambahan idea, dan pelaporan pepijat.',
      projectBy: 'Projek oleh WaqfTech.org',
      waqfDescription: 'Wakaf teknologi sumber terbuka untuk infrastruktur digital awam umat Islam.',
      licenseTitle: 'Lesen Awam Digital Waqf (Waqf-DPL 1.0)',
      stackTitle: 'Timbunan Teknologi',
      stack3d: 'Enjin 3D: Three.js dengan shader GLSL khas untuk sempadan siang/malam dan tiang cahaya azan.',
      stackAstronomy: 'Astronomi & Fiqh: Algoritma NOAA dan Meeus dalam TypeScript tulen untuk waktu solat dan arah kiblat.',
      stackEdge: 'Pengkomputeran Pinggir: Cloudflare Workers tanpa telemetri dengan cache aset global.',
      close: 'Tutup',
    },
    prayers: {
      fajr: 'Subuh',
      sunrise: 'Syuruk',
      dhuhr: 'Zohor',
      asr: 'Asar',
      maghrib: 'Maghrib',
      isha: 'Isyak',
      terminator: 'Garis Bayang Matahari',
    },
    inspector: {
      localTime: 'Waktu Tempatan',
      qiblaBearing: 'Arah Kiblat',
      fromNorth: 'dari Utara',
      next: 'Solat Seterusnya',
      close: 'Tutup maklumat',
      atKaaba: 'Di Kaabah',
    },
    timeline: {
      title: 'Kesinambungan Azan Sedunia',
      subtitle: 'Peredaran Matahari 24 Jam',
      coverage: 'Liputan',
      longestGap: 'Jurang Terpanjang',
      peakFront: 'Kemuncak Serentak',
      unbroken: '0 saat (Tanpa Putus)',
      cities: 'bandar',
      coverageTip: 'Bahagian hari azan berkumandang di suatu tempat di Bumi.',
      gapTip: 'Tempoh terpanjang dalam sehari tanpa azan di mana-mana di Bumi.',
      peakTip: 'Bilangan bandar terbanyak melaungkan azan serentak.',
    },
  },

  ur: {
    brand: {
      title: 'اذانِ ارض',
      subtitle: 'عالمی فلکیاتی رصد گاہ',
    },
    search: {
      placeholder: 'شہر تلاش کریں (مثلاً: لاہور، مکہ، ٹوکیو)...',
      clear: 'تلاش صاف کریں',
    },
    controls: {
      time: 'وقت',
      map: 'نقشہ',
      satellite: 'سیٹلائٹ',
      followAdhan: 'اذان کے ہمراہ',
      convention: 'اوقاتِ نماز کا طریقہ کار',
      zenMode: 'خالص سیاروی منظر',
      fullscreen: 'مکمل اسکرین',
      places: 'مقامات',
      layers: 'تہیں',
      legendLines: 'لکیریں: اس وقت ہر نماز کا وقت کہاں شروع ہو رہا ہے۔',
      legendRings: 'حلقے اور ستون: وہ شہر جہاں اس وقت اذان ہو رہی ہے۔',
      legendArcs: 'کمانیں: شہر سے مکہ کی سمت۔',
      hint: 'گھمانے کے لیے گھسیٹیں · زوم کے لیے اسکرول کریں · H کنٹرول چھپائیں · F مکمل اسکرین',
      shortcuts: 'کی بورڈ شارٹ کٹس',
      search: 'تلاش',
      share: 'منظر شیئر کریں',
      linkCopied: 'لنک کاپی ہو گیا',
      shareMessage: 'زمین پر نماز کے اوقات اور اذان کی گونج کو لائیو 3D گلوب پر براہِ راست دیکھیں 🌍🕌',
      pause: 'روکیں',
      clearSearch: 'تلاش صاف کریں',
      language: 'زبان',
      credits: 'شکریہ اور ٹیکنالوجی',
    },
    credits: {
      title: 'شکریہ اور تعارف',
      acknowledgments: 'خصوصی شکریہ و معاونین',
      contributorName: 'Muddaththir ‘Ismāʻīl bin Dāniyāl al-Amrīkī',
      contributorHandle: '@theIslampill',
      contributorArabicName: 'مدثر إسماعيل بن دانيال',
      contributorRole: 'تکنیکی مشاورت، تجاویز اور نقائص کی نشاندہی کے لیے۔',
      projectBy: 'وقف ٹیک (WaqfTech.org) کا منصوبہ',
      waqfDescription: 'امت کے لیے اوپن سورس ڈیجیٹل انفراسٹرکچر کی فراہمی کے لیے وقف منصوبہ۔',
      licenseTitle: 'وقف ڈیجیٹل پبلک لائسنس (Waqf-DPL 1.0)',
      stackTitle: 'تکنیکی ڈھانچہ',
      stack3d: '3D انجن: تھری جے ایس (Three.js) مع کسٹم GLSL شیڈرز برائے شب و روز و مینار۔',
      stackAstronomy: 'علم الفلکیات و فقہ: نووا (NOAA) اور میئس کے خالص ٹائپ اسکرپٹ الگورتھمز برائے اوقاتِ نماز و قبلہ۔',
      stackEdge: 'ایج کمپیوٹنگ: کلاؤڈ فلیئر ورکرز (Cloudflare Workers) بغیر کسی ٹریکنگ کے اور عالمی رسائی کے ساتھ۔',
      close: 'بند کریں',
    },
    prayers: {
      fajr: 'فجر',
      sunrise: 'طلوعِ آفتاب',
      dhuhr: 'ظہر',
      asr: 'عصر',
      maghrib: 'مغرب',
      isha: 'عشاء',
      terminator: 'خطِ شفق',
    },
    inspector: {
      localTime: 'مقامی وقت',
      qiblaBearing: 'سمتِ قبلہ',
      fromNorth: 'شمال سے',
      next: 'اگلی نماز',
      close: 'بند کریں',
      atKaaba: 'کعبہ پر',
    },
    timeline: {
      title: 'دنیا بھر میں مسلسل اذان',
      subtitle: '24 گھنٹے کا شمسی دورانیہ',
      coverage: 'کوریج',
      longestGap: 'طویل ترین وقفہ',
      peakFront: 'بیک وقت اذان والے شہر',
      unbroken: '0 سیکنڈ (مسلسل)',
      cities: 'شہر',
      coverageTip: 'دن کا وہ حصہ جس میں زمین پر کہیں نہ کہیں اذان ہو رہی ہوتی ہے۔',
      gapTip: 'دن کا سب سے لمبا وقفہ جس میں زمین پر کہیں اذان نہیں ہوتی۔',
      peakTip: 'ایک ہی وقت میں اذان دینے والے شہروں کی سب سے زیادہ تعداد۔',
    },
  },

  fa: {
    brand: {
      title: 'اذان زمین',
      subtitle: 'رصدخانه جهانی سیاره‌ای',
    },
    search: {
      placeholder: 'جستجوی شهر (مانند: تهران، مکه، استانبول)...',
      clear: 'پاک کردن جستجو',
    },
    controls: {
      time: 'زمان',
      map: 'نقشه',
      satellite: 'ماهواره',
      followAdhan: 'همگام با اذان',
      convention: 'روش محاسبه اوقات شرعی',
      zenMode: 'نمای خالص کره زمین',
      fullscreen: 'تمام صفحه',
      places: 'مکان‌ها',
      layers: 'لایه‌ها',
      legendLines: 'خط‌ها: جایی که اکنون وقت هر نماز آغاز می‌شود.',
      legendRings: 'حلقه‌ها و ستون‌ها: شهرهایی که اکنون اذان می‌گویند.',
      legendArcs: 'کمان‌ها: جهت از شهر به مکه.',
      hint: 'برای چرخاندن بکشید · برای بزرگنمایی اسکرول کنید · H پنهان‌کردن کنترل‌ها · F تمام‌صفحه',
      shortcuts: 'میانبرهای صفحه‌کلید',
      search: 'جستجو',
      share: 'هم‌رسانی نما',
      linkCopied: 'پیوند کپی شد',
      shareMessage: 'حرکت اوقات شرعی و طنین اذان را بر پهنه کره زمین به صورت زنده در یک کره سه‌بعدی مشاهده کنید 🌍🕌',
      pause: 'مکث',
      clearSearch: 'پاک‌کردن جستجو',
      language: 'زبان',
      credits: 'قدردانی و فناوری',
    },
    credits: {
      title: 'قدردانی و درباره',
      acknowledgments: 'سپاس ویژه و همراهان',
      contributorName: 'Muddaththir ‘Ismāʻīl bin Dāniyāl al-Amrīkī',
      contributorHandle: '@theIslampill',
      contributorArabicName: 'مدثر إسماعيل بن دانيال',
      contributorRole: 'برای گفت‌وگوهای فنی، ایده‌پردازی و گزارش باگ‌ها.',
      projectBy: 'پروژه‌ای از WaqfTech.org',
      waqfDescription: 'وقف فناوری متن‌باز با هدف ایجاد زیرساخت‌های دیجیتال برای امت اسلامی.',
      licenseTitle: 'مجوز عمومی دیجیتال وقف (Waqf-DPL 1.0)',
      stackTitle: 'پشته فناوری',
      stack3d: 'موتور سه‌بعدی: Three.js به همراه شیدرهای اختصاصی GLSL برای خط شب/روز و گنبد و گلدسته‌ها.',
      stackAstronomy: 'نجوم و شرعیات: الگوریتم‌های خالص TypeScript بر پایه محاسبات NOAA و Meeus برای اوقات شرعی و قبله.',
      stackEdge: 'رایانش ابری لبه: Cloudflare Workers بدون ردگیری کاربر با توزیع جهانی محتوا.',
      close: 'بستن',
    },
    prayers: {
      fajr: 'اذان صبح',
      sunrise: 'طلوع آفتاب',
      dhuhr: 'اذان ظهر',
      asr: 'عصر',
      maghrib: 'اذان مغرب',
      isha: 'عشاء',
      terminator: 'خط شفق و فلق',
    },
    inspector: {
      localTime: 'زمان محلی',
      qiblaBearing: 'جهت قبله',
      fromNorth: 'از شمال',
      next: 'نماز بعدی',
      close: 'بستن پنل',
      atKaaba: 'در کعبه',
    },
    timeline: {
      title: 'تداوم سراسری اذان در جهان',
      subtitle: 'چرخش 24 ساعته خورشیدی',
      coverage: 'پوشش',
      longestGap: 'طولانی‌ترین وقفه',
      peakFront: 'اوج شهرهای همزمان',
      unbroken: '0 ثانیه (پیوسته و بدون وقفه)',
      cities: 'شهر',
      coverageTip: 'بخشی از روز که در جایی از زمین اذان گفته می‌شود.',
      gapTip: 'طولانی‌ترین بازه روز که در هیچ جای زمین اذان گفته نمی‌شود.',
      peakTip: 'بیشترین تعداد شهرهایی که هم‌زمان اذان می‌گویند.',
    },
  },

  bn: {
    brand: {
      title: 'আজান আর্থ',
      subtitle: 'গ্রহ পর্যবেক্ষণ কেন্দ্র',
    },
    search: {
      placeholder: 'শহর অনুসন্ধান করুন (যেমন: ঢাকা, মক্কা, টোকিও)...',
      clear: 'অনুসন্ধান মুছুন',
    },
    controls: {
      time: 'সময়',
      map: 'মানচিত্র',
      satellite: 'স্যাটেলাইট',
      followAdhan: 'আজান অনুসরণ করুন',
      convention: 'নামাজের সময় গণনার পদ্ধতি',
      zenMode: 'পরিচ্ছন্ন গ্রহ দৃশ্য',
      fullscreen: 'পূর্ণ পর্দা',
      places: 'স্থান',
      layers: 'স্তর',
      legendLines: 'রেখা: এখন যেখানে প্রতিটি নামাজের ওয়াক্ত শুরু হচ্ছে।',
      legendRings: 'বলয় ও স্তম্ভ: এখন যে শহরগুলোতে আজান হচ্ছে।',
      legendArcs: 'চাপ: শহর থেকে মক্কার দিক।',
      hint: 'ঘোরাতে টানুন · জুম করতে স্ক্রল করুন · H নিয়ন্ত্রণ লুকান · F পূর্ণ পর্দা',
      shortcuts: 'কীবোর্ড শর্টকাট',
      search: 'অনুসন্ধান',
      share: 'দৃশ্য শেয়ার করুন',
      linkCopied: 'লিঙ্ক কপি হয়েছে',
      shareMessage: 'একটি লাইভ ৩ডি গ্লোবে বিশ্বজুড়ে নামাজের সময় ও আজানের গতিপথ সরাসরি দেখুন 🌍🕌',
      pause: 'বিরতি',
      clearSearch: 'অনুসন্ধান মুছুন',
      language: 'ভাষা',
      credits: 'কৃতজ্ঞতা ও প্রযুক্তি',
    },
    credits: {
      title: 'কৃতজ্ঞতা স্বীকার ও বিবরণ',
      acknowledgments: 'বিশেষ কৃতজ্ঞতা',
      contributorName: 'Muddaththir ‘Ismāʻīl bin Dāniyāl al-Amrīkī',
      contributorHandle: '@theIslampill',
      contributorArabicName: 'مدثر إسماعيل بن دانيال',
      contributorRole: 'কারিগরি আলোচনা, ধারণা ও বাগ চিহ্নিতকরণের জন্য।',
      projectBy: 'WaqfTech.org এর একটি প্রকল্প',
      waqfDescription: 'উম্মাহর জন্য উন্মুক্ত ডিজিটাল পাবলিক অবকাঠামো তৈরির একটি মুক্ত ওয়াকফ উদ্যোগ।',
      licenseTitle: 'ওয়াকফ ডিজিটাল পাবলিক লাইসেন্স (Waqf-DPL 1.0)',
      stackTitle: 'প্রযুক্তি কাঠামো',
      stack3d: '৩ডি ইঞ্জিন: কাস্টম GLSL শেডার সহ Three.js, দিবারাত্রির সীমারেখা ও মিনার স্তম্ভ ভিজ্যুয়ালাইজেশন।',
      stackAstronomy: 'জ্যোতির্বিজ্ঞান ও নামাজ: নামাজের সময় ও কিবলা গণনায় খাঁটি TypeScript-এ NOAA ও Meeus অ্যালগরিদম।',
      stackEdge: 'এজ কম্পিউটিং: কোনো ট্র্যাকিং ছাড়া বিশ্বব্যাপী ক্যাশযুক্ত Cloudflare Workers।',
      close: 'বন্ধ করুন',
    },
    prayers: {
      fajr: 'ফজর',
      sunrise: 'সূর্যোদয়',
      dhuhr: 'যোহর',
      asr: 'আসর',
      maghrib: 'মাগরিব',
      isha: 'ইশা',
      terminator: 'দিবারাত্রির সীমারেখা',
    },
    inspector: {
      localTime: 'স্থানীয় সময়',
      qiblaBearing: 'কিবলার দিক',
      fromNorth: 'উত্তর থেকে',
      next: 'পরবর্তী নামাজ',
      close: 'প্যানেল বন্ধ করুন',
      atKaaba: 'কাবায়',
    },
    timeline: {
      title: 'বিশ্বব্যাপী অবিরাম আজান',
      subtitle: '24 ঘণ্টার সৌর পরিক্রমা',
      coverage: 'কভারেজ',
      longestGap: 'দীর্ঘতম ব্যবধান',
      peakFront: 'একযোগে সর্বোচ্চ শহর',
      unbroken: '0 সেকেন্ড (অবিচ্ছিন্ন)',
      cities: 'শহর',
      coverageTip: 'দিনের যে অংশে পৃথিবীর কোথাও না কোথাও আজান হয়।',
      gapTip: 'দিনের সবচেয়ে দীর্ঘ সময় যখন পৃথিবীর কোথাও আজান হয় না।',
      peakTip: 'একই সময়ে আজান দেওয়া শহরের সর্বোচ্চ সংখ্যা।',
    },
  },

  fr: {
    brand: {
      title: 'APPEL DE LA TERRE',
      subtitle: 'Observatoire Planétaire',
    },
    search: {
      placeholder: 'Rechercher une ville (ex: Alger, Casablanca, Paris)...',
      clear: 'Effacer la recherche',
    },
    controls: {
      time: 'Temps',
      map: 'Carte',
      satellite: 'Satellite',
      followAdhan: "Suivre l'Adhān",
      convention: 'Convention de calcul des prières',
      zenMode: 'Vue planétaire épurée',
      fullscreen: 'Plein écran',
      places: 'Lieux',
      layers: 'Calques',
      legendLines: 'Lignes : où l’heure de chaque prière commence en ce moment.',
      legendRings: 'Anneaux et colonnes : villes où l’adhan est appelé maintenant.',
      legendArcs: 'Arcs : direction de la ville vers La Mecque.',
      hint: 'Glissez pour tourner · Faites défiler pour zoomer · H masque les commandes · F plein écran',
      shortcuts: 'Raccourcis clavier',
      search: 'Rechercher',
      share: 'Partager la vue',
      linkCopied: 'Lien copié',
      shareMessage: "Observez en direct le déplacement des heures de prière et de l'adhan autour de la Terre sur un globe 3D 🌍🕌",
      pause: 'Pause',
      clearSearch: 'Effacer la recherche',
      language: 'Langue',
      credits: 'Crédits & Technologie',
    },
    credits: {
      title: 'Crédits & À propos',
      acknowledgments: 'Remerciements spéciaux',
      contributorName: 'Muddaththir ‘Ismāʻīl bin Dāniyāl al-Amrīkī',
      contributorHandle: '@theIslampill',
      contributorArabicName: 'مدثر إسماعيل بن دانيال',
      contributorRole: 'Pour les échanges techniques, les idées et le signalement de bugs.',
      projectBy: 'Un projet par WaqfTech.org',
      waqfDescription: 'Une initiative de dotation technologique open-source pour les infrastructures numériques publiques de la Oummah.',
      licenseTitle: 'Licence Publique Numérique Waqf (Waqf-DPL 1.0)',
      stackTitle: 'Architecture Technique',
      stack3d: 'Moteur 3D : Three.js avec shaders GLSL personnalisés pour le terminateur jour/nuit et les faisceaux de minarets.',
      stackAstronomy: 'Astronomie & Fiqh : Algorithmes NOAA et Meeus en TypeScript pur pour les heures de prière et la Qibla.',
      stackEdge: 'Edge Computing : Cloudflare Workers avec zéro télémétrie et distribution mondiale sans latence.',
      close: 'Fermer',
    },
    prayers: {
      fajr: 'Fajr',
      sunrise: 'Lever du soleil',
      dhuhr: 'Dhohr',
      asr: 'Asr',
      maghrib: 'Maghrib',
      isha: 'Isha',
      terminator: 'Ligne de terminaison',
    },
    inspector: {
      localTime: 'Heure locale',
      qiblaBearing: 'Direction de la Qibla',
      fromNorth: 'du Nord',
      next: 'Prochaine prière',
      close: "Fermer l'inspecteur",
      atKaaba: 'À la Kaaba',
    },
    timeline: {
      title: "Continuité Planétaire de l'Adhān",
      subtitle: 'Traversée Solaire de 24 Heures',
      coverage: 'Couverture',
      longestGap: 'Plus grand intervalle',
      peakFront: 'Pic de villes simultanées',
      unbroken: '0s (Ininterrompu)',
      cities: 'villes',
      coverageTip: 'Part de la journée où l’adhan retentit quelque part sur Terre.',
      gapTip: 'Plus longue période de la journée sans adhan nulle part sur Terre.',
      peakTip: 'Plus grand nombre de villes appelant l’adhan en même temps.',
    },
  },

  ru: {
    brand: {
      title: 'АЗАН ЗЕМЛИ',
      subtitle: 'Планетарная Обсерватория',
    },
    search: {
      placeholder: 'Поиск города (напр., Казань, Ташкент, Мекка)...',
      clear: 'Очистить поиск',
    },
    controls: {
      time: 'Время',
      map: 'Карта',
      satellite: 'Спутник',
      followAdhan: 'Следовать за азаном',
      convention: 'Метод расчета намаза',
      zenMode: 'Чистый вид планеты',
      fullscreen: 'Во весь экран',
      places: 'Места',
      layers: 'Слои',
      legendLines: 'Линии: где сейчас наступает время каждой молитвы.',
      legendRings: 'Кольца и столбы: города, где сейчас звучит азан.',
      legendArcs: 'Дуги: направление от города к Мекке.',
      hint: 'Тяните, чтобы вращать · Прокрутка для масштаба · H скрыть панели · F полный экран',
      shortcuts: 'Горячие клавиши',
      search: 'Поиск',
      share: 'Поделиться видом',
      linkCopied: 'Ссылка скопирована',
      shareMessage: 'Смотрите движение времен намаза и призыв к молитве по всей Земле в реальном времени на 3D-глобусе 🌍🕌',
      pause: 'Пауза',
      clearSearch: 'Очистить поиск',
      language: 'Язык',
      credits: 'Благодарности и технологии',
    },
    credits: {
      title: 'Благодарности и о проекте',
      acknowledgments: 'Особая благодарность',
      contributorName: 'Muddaththir ‘Ismāʻīl bin Dāniyāl al-Amrīkī',
      contributorHandle: '@theIslampill',
      contributorArabicName: 'مدثر إسماعيل بن دانيال',
      contributorRole: 'За технические обсуждения, идеи и сообщения об ошибках.',
      projectBy: 'Проект от WaqfTech.org',
      waqfDescription: 'Инициатива открытого вакфа цифровой общественной инфраструктуры для уммы.',
      licenseTitle: 'Цифровая общественная лицензия Вакф (Waqf-DPL 1.0)',
      stackTitle: 'Технический стек',
      stack3d: '3D-движок: Three.js с кастомными шейдерами GLSL для линии терминатора и лучей минаретов.',
      stackAstronomy: 'Астрономия и фикх: Алгоритмы NOAA и Meeus на чистом TypeScript для расчета времени молитв и киблы.',
      stackEdge: 'Периферийные вычисления: Cloudflare Workers с нулевой телеметрией и глобальным кэшированием.',
      close: 'Закрыть',
    },
    prayers: {
      fajr: 'Фаджр',
      sunrise: 'Восход',
      dhuhr: 'Зухр',
      asr: 'Аср',
      maghrib: 'Магриб',
      isha: 'Иша',
      terminator: 'Линия терминатора',
    },
    inspector: {
      localTime: 'Местное время',
      qiblaBearing: 'Направление Киблы',
      fromNorth: 'от севера',
      next: 'Следующий намаз',
      close: 'Закрыть инспектор',
      atKaaba: 'У Каабы',
    },
    timeline: {
      title: 'Непрерывный Планетарный Азан',
      subtitle: '24-часовой Солнечный Цикл',
      coverage: 'Покрытие',
      longestGap: 'Наибольший перерыв',
      peakFront: 'Пик одновременных городов',
      unbroken: '0 сек (Непрерывно)',
      cities: 'городов',
      coverageTip: 'Доля суток, когда азан звучит где-нибудь на Земле.',
      gapTip: 'Самый долгий промежуток суток без азана на всей Земле.',
      peakTip: 'Наибольшее число городов, где азан звучит одновременно.',
    },
  },
};

/**
 * Returns translated string dictionary for the given locale with English fallback.
 */
export function getTranslations(locale: SupportedLocale): Translations {
  return DICTIONARIES[locale] || DICTIONARIES.en;
}
