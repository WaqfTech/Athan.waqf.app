// Settlement dataset loader and data types

export interface Settlement {
  name: string;
  nameAr: string;
  latitude: number;
  longitude: number;
  countryCode: string;
  population: number;
  timezone: string;
}

// Compact JSON format: [nameEn, nameAr, lat, lng, cc, pop, tz]
type CompactSettlementRow = [string, string, number, number, string, number, string];

let cachedSettlements: Settlement[] | null = null;

interface PalestineOverride {
  nameEn: string;
  nameAr: string;
}

const PALESTINE_OVERRIDES: Record<string, PalestineOverride> = {
  // Core historic cities
  Jerusalem: { nameEn: 'Al-Quds', nameAr: 'القدس' },
  'West Jerusalem': { nameEn: 'Al-Quds (West)', nameAr: 'القدس الغربية' },
  'East Jerusalem': { nameEn: 'Al-Quds (East)', nameAr: 'القدس الشرقية' },
  'Tel Aviv': { nameEn: 'Yafa (Tel Aviv)', nameAr: 'يافا (تل الربيع)' },
  Jaffa: { nameEn: 'Yafa', nameAr: 'يافا' },
  Haifa: { nameEn: 'Haifa', nameAr: 'حيفا' },
  Acre: { nameEn: 'Akka', nameAr: 'عكّا' },
  Nazareth: { nameEn: 'An-Nasirah', nameAr: 'الناصرة' },
  Beersheba: { nameEn: "Bi'r as-Sabi'", nameAr: 'بئر السبع' },
  Ashdod: { nameEn: 'Isdud', nameAr: 'إسدود' },
  Ashkelon: { nameEn: 'Asqalan', nameAr: 'عسقلان' },
  'Petaẖ Tiqva': { nameEn: 'Mulabbis', nameAr: 'ملبّس' },
  'Petah Tiqva': { nameEn: 'Mulabbis', nameAr: 'ملبّس' },
  'Petah Tikva': { nameEn: 'Mulabbis', nameAr: 'ملبّس' },
  'Rishon LeTsiyyon': { nameEn: 'Ayun Qara', nameAr: 'عيون قارة' },
  Netanya: { nameEn: 'Umm Khalid', nameAr: 'أم خالد' },
  'Bnei Brak': { nameEn: 'Ibn Ibraq', nameAr: 'ابن إبراق' },
  'H̱olon': { nameEn: 'Yazur', nameAr: 'يازور' },
  Holon: { nameEn: 'Yazur', nameAr: 'يازور' },
  'Ramat Gan': { nameEn: 'Jarisha', nameAr: 'جريشة' },
  'Reẖovot': { nameEn: 'Zarnuqa', nameAr: 'زرنوقة' },
  Rehovot: { nameEn: 'Zarnuqa', nameAr: 'زرنوقة' },
  'Bat Yam': { nameEn: 'Yafa al-Janubiyya', nameAr: 'يافا الجنوبية' },
  'Bet Shemesh': { nameEn: 'Bayt Shams', nameAr: 'بيت شمس' },
  'Kfar Saba': { nameEn: 'Kafr Saba', nameAr: 'كفر سابا' },
  Herzliya: { nameEn: 'Al-Haram Sayyidna Ali', nameAr: 'الحرم سيدنا علي' },
  Hadera: { nameEn: 'Al-Khudayra', nameAr: 'الخضيرة' },
  'Modi‘in Makkabbim Re‘ut': { nameEn: 'Al-Midya', nameAr: 'المدية' },
  'Modiin Makkabbim Reut': { nameEn: 'Al-Midya', nameAr: 'المدية' },
  'Modiin Ilit': { nameEn: "Ni'lin", nameAr: 'نعلين' },
  Lod: { nameEn: 'Al-Lidd', nameAr: 'اللد' },
  Ramla: { nameEn: 'Ar-Ramlah', nameAr: 'الرملة' },
  "Ra'anana": { nameEn: 'Tabsur', nameAr: 'تبصر' },
  Raanana: { nameEn: 'Tabsur', nameAr: 'تبصر' },
  'Rosh Ha‘Ayin': { nameEn: 'Ras al-Ayn', nameAr: 'رأس العين' },
  'Rosh HaAyin': { nameEn: 'Ras al-Ayn', nameAr: 'رأس العين' },
  'Hod HaSharon': { nameEn: 'Biyar Adas', nameAr: 'بيار عدس' },
  'Hod Hasharon': { nameEn: 'Biyar Adas', nameAr: 'بيار عدس' },
  'Kiryat Gat': { nameEn: 'Iraq al-Manshiyya', nameAr: 'عراق المنشية' },
  Givatayim: { nameEn: 'Salama', nameAr: 'سلمة' },
  'Qiryat Ata': { nameEn: 'Kafr Etta', nameAr: 'كفر عتا' },
  Nahariyya: { nameEn: 'Al-Zeeb', nameAr: 'الزيب' },
  Nahariya: { nameEn: 'Al-Zeeb', nameAr: 'الزيب' },
  'Umm el Faḥm': { nameEn: 'Umm al-Fahm', nameAr: 'أم الفحم' },
  'Umm al-Fahm': { nameEn: 'Umm al-Fahm', nameAr: 'أم الفحم' },
  Eilat: { nameEn: 'Umm ar-Rashrash', nameAr: 'أم الرشراش' },
  'Ness Ziona': { nameEn: 'Wadi Hunayn', nameAr: 'وادي حنين' },
  'El‘ad': { nameEn: "Al-Muzayri'a", nameAr: 'المزيرعة' },
  Elad: { nameEn: "Al-Muzayri'a", nameAr: 'المزيرعة' },
  'Yavné': { nameEn: 'Yibna', nameAr: 'يبنى' },
  Yavne: { nameEn: 'Yibna', nameAr: 'يبنى' },
  'Ramat HaSharon': { nameEn: 'Ijlil', nameAr: 'إجليل' },
  'Ramat Hasharon': { nameEn: 'Ijlil', nameAr: 'إجليل' },
  'Karmi’el': { nameEn: 'Majd al-Krum', nameAr: 'مجد الكروم' },
  Karmiel: { nameEn: 'Majd al-Krum', nameAr: 'مجد الكروم' },
  Afula: { nameEn: 'Al-Affula', nameAr: 'العفولة' },
  'Pardés H̱anna Karkur': { nameEn: 'Karkur', nameAr: 'كركور' },
  'Pardes Hanna Karkur': { nameEn: 'Karkur', nameAr: 'كركور' },
  Tiberias: { nameEn: 'Tabariyya', nameAr: 'طبريا' },
  'Eṭ Ṭaiyiba': { nameEn: 'At-Tayyiba', nameAr: 'الطيّبة' },
  'Et Taiyiba': { nameEn: 'At-Tayyiba', nameAr: 'الطيّبة' },
  'Qiryat Bialik': { nameEn: 'Yajur', nameAr: 'ياجور' },
  Netivot: { nameEn: 'Azzam', nameAr: 'عزام' },
  'Naẕerat ‘Illit': { nameEn: 'Jabal as-Sikh', nameAr: 'جبل السيخ' },
  'Nazerat Illit': { nameEn: 'Jabal as-Sikh', nameAr: 'جبل السيخ' },
  'Qiryat Motsqin': { nameEn: 'Al-Ghawarneh', nameAr: 'الغوارنة' },
  'Qiryat Motzkin': { nameEn: 'Al-Ghawarneh', nameAr: 'الغوارنة' },
  'Shefar‘am': { nameEn: "Shafa 'Amr", nameAr: 'شفا عمرو' },
  Shefaram: { nameEn: "Shafa 'Amr", nameAr: 'شفا عمرو' },

  // Secondary settlements
  'Kiryat Ono': { nameEn: 'Kafr Ana', nameAr: 'كفر عانة' },
  'Qiryat Yam': { nameEn: 'Balad ash-Sheikh', nameAr: 'بلد الشيخ' },
  'Or Yehuda': { nameEn: 'Saqiya', nameAr: 'ساقية' },
  Dimona: { nameEn: 'Dimona', nameAr: 'ديمونة' },
  Safed: { nameEn: 'Safad', nameAr: 'صفد' },
  Ofaqim: { nameEn: 'Ofakim', nameAr: 'أوفاكيم' },
  Ofakim: { nameEn: 'Ofakim', nameAr: 'أوفاكيم' },
  'Sakhnīn': { nameEn: 'Sakhnin', nameAr: 'سخنين' },
  Sakhnin: { nameEn: 'Sakhnin', nameAr: 'سخنين' },
  Gedera: { nameEn: 'Qatra', nameAr: 'قطرة' },
  'Bāqa el Gharbīya': { nameEn: 'Baqa al-Gharbiyya', nameAr: 'باقة الغربية' },
  'Baqa al-Gharbiya': { nameEn: 'Baqa al-Gharbiyya', nameAr: 'باقة الغربية' },
  'Yehud-Monosson': { nameEn: 'Al-Yahudiyya', nameAr: 'اليهودية' },
  Yehud: { nameEn: 'Al-Yahudiyya', nameAr: 'اليهودية' },
  "Giv'at Shmuel": { nameEn: 'Ibn Ibraq', nameAr: 'ابن إبراق' },
  'Givat Shmuel': { nameEn: 'Ibn Ibraq', nameAr: 'ابن إبراق' },
  Arad: { nameEn: 'Arad', nameAr: 'عراد' },
  'Tirat Karmel': { nameEn: 'Al-Tira', nameAr: 'طيرة الكرمل' },
  'Be’er Ya‘aqov': { nameEn: 'Qubab', nameAr: 'القباب' },
  'Beer Yaakov': { nameEn: 'Qubab', nameAr: 'القباب' },
  Sderot: { nameEn: 'Najd', nameAr: 'نجد' },
  'Eṭ Ṭīra': { nameEn: 'Al-Tira', nameAr: 'الطيرة' },
  'Et Tira': { nameEn: 'Al-Tira', nameAr: 'الطيرة' },
  Tamra: { nameEn: 'Tamra', nameAr: 'طمرة' },
  'Migdal Ha‘Emeq': { nameEn: 'Al-Mujaydil', nameAr: 'المجيدل' },
  'Migdal HaEmek': { nameEn: 'Al-Mujaydil', nameAr: 'المجيدل' },
  'Qiryat Mal’akhi': { nameEn: 'Qastina', nameAr: 'قسطينة' },
  'Kiryat Malakhi': { nameEn: 'Qastina', nameAr: 'قسطينة' },
  'Ganei Tikva': { nameEn: 'Al-Abbasiyya', nameAr: 'العباسية' },
  'Qiryat HaYovel': { nameEn: 'Bayt Mazmil', nameAr: 'بيت مزميل' },
  'Daliyat al Karmel': { nameEn: 'Daliyat al-Karmel', nameAr: 'دالية الكرمل' },
  '‘Ara-‘Ar‘ara': { nameEn: "Ara and Ar'ara", nameAr: 'عرعرة' },
  'Kfar Yona': { nameEn: 'Bayt Lid', nameAr: 'بيت ليد' },
  Nesher: { nameEn: 'Balad ash-Sheikh', nameAr: 'بلد الشيخ' },
  'Mevasseret Tsiyyon': { nameEn: 'Qalunya', nameAr: 'قالونيا' },
  'Gan Yavne': { nameEn: 'Barqa', nameAr: 'برقة' },
  'Kafr Qāsim': { nameEn: 'Kafr Qasim', nameAr: 'كفر قاسم' },
  'Kafr Qasim': { nameEn: 'Kafr Qasim', nameAr: 'كفر قاسم' },
  'Yoqne‘am ‘Illit': { nameEn: 'Qira', nameAr: 'قيرة' },
  'Zikhron Ya‘aqov': { nameEn: 'Zammarin', nameAr: 'زمرين' },
  'Maghār': { nameEn: 'Al-Maghar', nameAr: 'المغار' },
  Maghar: { nameEn: 'Al-Maghar', nameAr: 'المغار' },
  'Kafr Kannā': { nameEn: 'Kafr Kanna', nameAr: 'كفر كَنّا' },
  'Kafr Kanna': { nameEn: 'Kafr Kanna', nameAr: 'كفر كَنّا' },
  'Qiryat Shmona': { nameEn: 'Al-Khalisa', nameAr: 'الخالصة' },
  'Kadima Zoran': { nameEn: 'Qaqun', nameAr: 'قاقون' },
  'maalot Tarshīhā': { nameEn: 'Tarshiha', nameAr: 'ترشيحا' },
  'H̱ura': { nameEn: 'Hura', nameAr: 'حورة' },
  'Judeida Makr': { nameEn: 'Al-Judayda and Al-Makr', nameAr: 'الجديدة والمكر' },
  Kuseifa: { nameEn: 'Kusayfa', nameAr: 'كسيفة' },
  Shoham: { nameEn: 'Dayr Tarif', nameAr: 'دير طريف' },
  Ariel: { nameEn: 'Salfit', nameAr: 'سلفيت' },
  'Tel Sheva‘': { nameEn: "Tall as-Sabi'", nameAr: 'تل السبع' },
  'Kafr Mandā': { nameEn: 'Kafr Manda', nameAr: 'كفر مندا' },
  Rahat: { nameEn: 'Rahat', nameAr: 'رهط' },
  'Kafr Qari‘': { nameEn: "Kafr Qari'", nameAr: 'كفر قرع' },
  'Or Akiva': { nameEn: 'Qaysariyya', nameAr: 'قيسارية' },
  'Yāfā': { nameEn: 'Yafa an-Nasirah', nameAr: 'يافا الناصرة' },
  'Qiryat Tiv‘on': { nameEn: "Tab'un", nameAr: 'طبعون' },
  '‘Ar‘ara BaNegev': { nameEn: "Ar'arat an-Naqab", nameAr: 'عرعرة النقب' },
  'Yirkā': { nameEn: 'Yirka', nameAr: 'يركا' },
  Qalansuwa: { nameEn: 'Qalansuwa', nameAr: 'قلنسوة' },

  // Hebrew transliterations as aliases
  'بتاح تكفا': { nameEn: 'Mulabbis', nameAr: 'ملبّس' },
  نتانيا: { nameEn: 'Umm Khalid', nameAr: 'أم خالد' },
  أشدود: { nameEn: 'Isdud', nameAr: 'إسدود' },
  حولون: { nameEn: 'Yazur', nameAr: 'يازور' },
  'رمات غان': { nameEn: 'Jarisha', nameAr: 'جريشة' },
  'بات يام': { nameEn: 'Yafa al-Janubiyya', nameAr: 'يافا الجنوبية' },
  'بيت شيمش': { nameEn: 'Bayt Shams', nameAr: 'بيت شمس' },
  'كفار سابا': { nameEn: 'Kafr Saba', nameAr: 'كفر سابا' },
  'هود هشارون': { nameEn: 'Biyar Adas', nameAr: 'بيار عدس' },
  'قسطينة أ': { nameEn: 'Iraq al-Manshiyya', nameAr: 'عراق المنشية' },
  جفعاتايم: { nameEn: 'Salama', nameAr: 'سلمة' },
  نهاريا: { nameEn: 'Al-Zeeb', nameAr: 'الزيب' },
  آيلة: { nameEn: 'Umm ar-Rashrash', nameAr: 'أم الرشراش' },
  'رامات هاشارون': { nameEn: 'Ijlil', nameAr: 'إجليل' },
  نتيفوت: { nameEn: 'Azzam', nameAr: 'عزام' },
};

export function parseSettlements(data: CompactSettlementRow[]): Settlement[] {
  return data.map((row) => {
    let name = row[0];
    let nameAr = row[1];
    let countryCode = row[4];

    if (countryCode === 'IL' || countryCode === 'PS') {
      const override = PALESTINE_OVERRIDES[name] || (nameAr ? PALESTINE_OVERRIDES[nameAr] : undefined);
      if (override) {
        name = override.nameEn;
        nameAr = override.nameAr;
        countryCode = 'PS';
      } else if (countryCode === 'IL') {
        countryCode = 'PS';
      }
    }

    return {
      name,
      nameAr,
      latitude: row[2],
      longitude: row[3],
      countryCode,
      population: row[5],
      timezone: row[6],
    };
  });
}

export async function loadSettlements(url = './data/cities-core.json'): Promise<Settlement[]> {
  if (cachedSettlements) {
    return cachedSettlements;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load settlement data from ${url}: ${response.status}`);
  }

  const raw = (await response.json()) as CompactSettlementRow[];
  cachedSettlements = parseSettlements(raw);
  return cachedSettlements;
}
