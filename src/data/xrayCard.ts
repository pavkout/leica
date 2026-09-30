// The airport card (#49): "please hand-inspect my film", to show at a
// security checkpoint, in the checkpoint's language with English beside it.
// Written with AI help and not all checked by native speakers (the page says
// so). Whether a hand check is allowed is up to the security staff.

export interface CardPhrase {
  /** BCP 47 tag, for lang= and direction. */
  tag: string;
  /** The language's name in itself. */
  native: string;
  english: string;
  text: string;
  rtl?: boolean;
}

export const XRAY_CARD: CardPhrase[] = [
  { tag: "en", native: "English", english: "English", text: "Please hand-inspect my film. It is photographic film, and X-ray machines can damage it. Thank you." },
  { tag: "ar", native: "العربية", english: "Arabic", rtl: true, text: "من فضلك افحص أفلامي يدويًا. إنها أفلام تصوير، وقد تتلفها أجهزة الأشعة السينية. شكرًا لك." },
  { tag: "zh-Hans", native: "简体中文", english: "Chinese (Simplified)", text: "请手工检查我的胶卷。这是摄影胶卷，X光机可能会损坏它。谢谢。" },
  { tag: "zh-Hant", native: "繁體中文", english: "Chinese (Traditional)", text: "請以人工檢查我的底片。這是攝影底片，X光機可能會損壞它。謝謝。" },
  { tag: "cs", native: "Čeština", english: "Czech", text: "Prosím, zkontrolujte můj film ručně. Je to fotografický film a rentgenová zařízení ho mohou poškodit. Děkuji." },
  { tag: "nl", native: "Nederlands", english: "Dutch", text: "Wilt u mijn film alstublieft met de hand controleren? Het is fotografische film en röntgenapparaten kunnen die beschadigen. Dank u wel." },
  { tag: "fr", native: "Français", english: "French", text: "Merci de contrôler mes films à la main. Ce sont des films photographiques, et les appareils à rayons X peuvent les endommager. Merci." },
  { tag: "de", native: "Deutsch", english: "German", text: "Bitte kontrollieren Sie meinen Film von Hand. Es ist fotografischer Film, und Röntgengeräte können ihn beschädigen. Vielen Dank." },
  { tag: "el", native: "Ελληνικά", english: "Greek", text: "Παρακαλώ ελέγξτε το φιλμ μου με το χέρι. Είναι φωτογραφικό φιλμ και τα μηχανήματα ακτίνων Χ μπορεί να το καταστρέψουν. Ευχαριστώ." },
  { tag: "he", native: "עברית", english: "Hebrew", rtl: true, text: "אנא בדקו את הפילם שלי ידנית. זהו פילם צילום, ומכונות רנטגן עלולות לפגוע בו. תודה." },
  { tag: "hi", native: "हिन्दी", english: "Hindi", text: "कृपया मेरी फ़िल्म की हाथ से जाँच करें। यह फ़ोटोग्राफ़िक फ़िल्म है, और एक्स-रे मशीनें इसे नुकसान पहुँचा सकती हैं। धन्यवाद।" },
  { tag: "id", native: "Bahasa Indonesia", english: "Indonesian", text: "Mohon periksa film saya secara manual. Ini film fotografi dan mesin sinar-X dapat merusaknya. Terima kasih." },
  { tag: "it", native: "Italiano", english: "Italian", text: "Per favore, controllate le mie pellicole a mano. Sono pellicole fotografiche e i raggi X possono danneggiarle. Grazie." },
  { tag: "ja", native: "日本語", english: "Japanese", text: "フィルムを手検査していただけますか。写真用フィルムのため、X線検査装置で損傷するおそれがあります。よろしくお願いします。" },
  { tag: "ko", native: "한국어", english: "Korean", text: "필름을 수작업으로 검사해 주시겠어요? 사진용 필름이라 엑스레이 검사기에 손상될 수 있습니다. 감사합니다." },
  { tag: "pl", native: "Polski", english: "Polish", text: "Proszę o ręczną kontrolę mojego filmu. To film fotograficzny, a urządzenia rentgenowskie mogą go uszkodzić. Dziękuję." },
  { tag: "pt", native: "Português", english: "Portuguese", text: "Por favor, inspecione os meus filmes manualmente. São filmes fotográficos e as máquinas de raios X podem danificá-los. Obrigado." },
  { tag: "ru", native: "Русский", english: "Russian", text: "Пожалуйста, проверьте мою плёнку вручную. Это фотоплёнка, рентгеновские аппараты могут её испортить. Спасибо." },
  { tag: "es", native: "Español", english: "Spanish", text: "Por favor, revise mis películas a mano. Son películas fotográficas y las máquinas de rayos X pueden dañarlas. Gracias." },
  { tag: "sv", native: "Svenska", english: "Swedish", text: "Snälla, kontrollera min film för hand. Det är fotografisk film och röntgenmaskiner kan skada den. Tack." },
  { tag: "th", native: "ไทย", english: "Thai", text: "กรุณาตรวจฟิล์มของฉันด้วยมือ นี่คือฟิล์มถ่ายภาพ และเครื่องเอกซเรย์อาจทำให้ฟิล์มเสียหายได้ ขอบคุณ" },
  { tag: "tr", native: "Türkçe", english: "Turkish", text: "Lütfen filmlerimi elle kontrol edin. Bunlar fotoğraf filmi ve röntgen cihazları onlara zarar verebilir. Teşekkürler." },
  { tag: "vi", native: "Tiếng Việt", english: "Vietnamese", text: "Vui lòng kiểm tra phim của tôi bằng tay. Đây là phim chụp ảnh và máy soi tia X có thể làm hỏng phim. Cảm ơn." },
];

export const ENGLISH_CARD = XRAY_CARD[0];

/** The card for the reader's language, else English. */
export function cardFor(tag: string): CardPhrase {
  const primary = tag.toLowerCase().split("-")[0];
  if (primary === "zh") return XRAY_CARD.find((c) => c.tag === (/-(tw|hk|mo|hant)\b/i.test(tag) ? "zh-Hant" : "zh-Hans"))!;
  return XRAY_CARD.find((c) => c.tag.toLowerCase() === primary) ?? ENGLISH_CARD;
}
