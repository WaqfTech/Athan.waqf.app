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
    language: string;
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
      language: 'Language',
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
      coverage: 'Coverage',
      longestGap: 'Longest Gap',
      peakFront: 'Peak Front',
      unbroken: '0s (Unbroken)',
      cities: 'cities',
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
      language: 'اللغة',
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
      language: 'Dil',
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
      language: 'Bahasa',
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
      language: 'Bahasa',
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
      language: 'زبان',
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
      language: 'زبان',
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
      language: 'ভাষা',
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
      language: 'Langue',
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
      language: 'Язык',
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
    },
  },
};

/**
 * Returns translated string dictionary for the given locale with English fallback.
 */
export function getTranslations(locale: SupportedLocale): Translations {
  return DICTIONARIES[locale] || DICTIONARIES.en;
}
