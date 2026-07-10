// AUTO-GENERATED from frontend/src/data/countries.ts — DO NOT hand-edit.
// Country dial codes + phone normalization, used by bulk-import to attach the
// right country code to WhatsApp / phone numbers when the sheet omits it.

const COUNTRY_DIAL: Record<string, string> = {"af":"+93","afghanistan":"+93","al":"+355","albania":"+355","dz":"+213","algeria":"+213","ad":"+376","andorra":"+376","ao":"+244","angola":"+244","ag":"+1268","antigua and barbuda":"+1268","ar":"+54","argentina":"+54","am":"+374","armenia":"+374","au":"+61","australia":"+61","at":"+43","austria":"+43","az":"+994","azerbaijan":"+994","bs":"+1242","bahamas":"+1242","bh":"+973","bahrain":"+973","bd":"+880","bangladesh":"+880","bb":"+1246","barbados":"+1246","by":"+375","belarus":"+375","be":"+32","belgium":"+32","bz":"+501","belize":"+501","bj":"+229","benin":"+229","bt":"+975","bhutan":"+975","bo":"+591","bolivia":"+591","ba":"+387","bosnia and herzegovina":"+387","bw":"+267","botswana":"+267","br":"+55","brazil":"+55","bn":"+673","brunei":"+673","bg":"+359","bulgaria":"+359","bf":"+226","burkina faso":"+226","bi":"+257","burundi":"+257","kh":"+855","cambodia":"+855","cm":"+237","cameroon":"+237","ca":"+1","canada":"+1","cv":"+238","cape verde":"+238","cf":"+236","central african republic":"+236","td":"+235","chad":"+235","cl":"+56","chile":"+56","cn":"+86","china":"+86","co":"+57","colombia":"+57","km":"+269","comoros":"+269","cg":"+242","congo":"+242","cr":"+506","costa rica":"+506","hr":"+385","croatia":"+385","cu":"+53","cuba":"+53","cy":"+357","cyprus":"+357","cz":"+420","czechia":"+420","cd":"+243","dr congo":"+243","dk":"+45","denmark":"+45","dj":"+253","djibouti":"+253","dm":"+1767","dominica":"+1767","do":"+1809","dominican republic":"+1809","ec":"+593","ecuador":"+593","eg":"+20","egypt":"+20","sv":"+503","el salvador":"+503","gq":"+240","equatorial guinea":"+240","er":"+291","eritrea":"+291","ee":"+372","estonia":"+372","sz":"+268","eswatini":"+268","et":"+251","ethiopia":"+251","fj":"+679","fiji":"+679","fi":"+358","finland":"+358","fr":"+33","france":"+33","ga":"+241","gabon":"+241","gm":"+220","gambia":"+220","ge":"+995","georgia":"+995","de":"+49","germany":"+49","gh":"+233","ghana":"+233","gr":"+30","greece":"+30","gd":"+1473","grenada":"+1473","gt":"+502","guatemala":"+502","gn":"+224","guinea":"+224","gw":"+245","guinea-bissau":"+245","gy":"+592","guyana":"+592","ht":"+509","haiti":"+509","hn":"+504","honduras":"+504","hk":"+852","hong kong":"+852","hu":"+36","hungary":"+36","is":"+354","iceland":"+354","in":"+91","india":"+91","id":"+62","indonesia":"+62","ir":"+98","iran":"+98","iq":"+964","iraq":"+964","ie":"+353","ireland":"+353","il":"+972","israel":"+972","it":"+39","italy":"+39","ci":"+225","ivory coast":"+225","jm":"+1876","jamaica":"+1876","jp":"+81","japan":"+81","jo":"+962","jordan":"+962","kz":"+7","kazakhstan":"+7","ke":"+254","kenya":"+254","ki":"+686","kiribati":"+686","xk":"+383","kosovo":"+383","kw":"+965","kuwait":"+965","kg":"+996","kyrgyzstan":"+996","la":"+856","laos":"+856","lv":"+371","latvia":"+371","lb":"+961","lebanon":"+961","ls":"+266","lesotho":"+266","lr":"+231","liberia":"+231","ly":"+218","libya":"+218","li":"+423","liechtenstein":"+423","lt":"+370","lithuania":"+370","lu":"+352","luxembourg":"+352","mo":"+853","macau":"+853","mg":"+261","madagascar":"+261","mw":"+265","malawi":"+265","my":"+60","malaysia":"+60","mv":"+960","maldives":"+960","ml":"+223","mali":"+223","mt":"+356","malta":"+356","mh":"+692","marshall islands":"+692","mr":"+222","mauritania":"+222","mu":"+230","mauritius":"+230","mx":"+52","mexico":"+52","fm":"+691","micronesia":"+691","md":"+373","moldova":"+373","mc":"+377","monaco":"+377","mn":"+976","mongolia":"+976","me":"+382","montenegro":"+382","ma":"+212","morocco":"+212","mz":"+258","mozambique":"+258","mm":"+95","myanmar":"+95","na":"+264","namibia":"+264","nr":"+674","nauru":"+674","np":"+977","nepal":"+977","nl":"+31","netherlands":"+31","nz":"+64","new zealand":"+64","ni":"+505","nicaragua":"+505","ne":"+227","niger":"+227","ng":"+234","nigeria":"+234","kp":"+850","north korea":"+850","mk":"+389","north macedonia":"+389","no":"+47","norway":"+47","om":"+968","oman":"+968","pk":"+92","pakistan":"+92","pw":"+680","palau":"+680","ps":"+970","palestine":"+970","pa":"+507","panama":"+507","pg":"+675","papua new guinea":"+675","py":"+595","paraguay":"+595","pe":"+51","peru":"+51","ph":"+63","philippines":"+63","pl":"+48","poland":"+48","pt":"+351","portugal":"+351","qa":"+974","qatar":"+974","ro":"+40","romania":"+40","ru":"+7","russia":"+7","rw":"+250","rwanda":"+250","kn":"+1869","saint kitts and nevis":"+1869","lc":"+1758","saint lucia":"+1758","vc":"+1784","saint vincent and the grenadines":"+1784","ws":"+685","samoa":"+685","sm":"+378","san marino":"+378","st":"+239","sao tome and principe":"+239","sa":"+966","saudi arabia":"+966","sn":"+221","senegal":"+221","rs":"+381","serbia":"+381","sc":"+248","seychelles":"+248","sl":"+232","sierra leone":"+232","sg":"+65","singapore":"+65","sk":"+421","slovakia":"+421","si":"+386","slovenia":"+386","sb":"+677","solomon islands":"+677","so":"+252","somalia":"+252","za":"+27","south africa":"+27","kr":"+82","south korea":"+82","ss":"+211","south sudan":"+211","es":"+34","spain":"+34","lk":"+94","sri lanka":"+94","sd":"+249","sudan":"+249","sr":"+597","suriname":"+597","se":"+46","sweden":"+46","ch":"+41","switzerland":"+41","sy":"+963","syria":"+963","tw":"+886","taiwan":"+886","tj":"+992","tajikistan":"+992","tz":"+255","tanzania":"+255","th":"+66","thailand":"+66","tl":"+670","timor-leste":"+670","tg":"+228","togo":"+228","to":"+676","tonga":"+676","tt":"+1868","trinidad and tobago":"+1868","tn":"+216","tunisia":"+216","tr":"+90","turkey":"+90","tm":"+993","turkmenistan":"+993","tv":"+688","tuvalu":"+688","ug":"+256","uganda":"+256","ua":"+380","ukraine":"+380","ae":"+971","united arab emirates":"+971","gb":"+44","united kingdom":"+44","us":"+1","united states":"+1","uy":"+598","uruguay":"+598","uz":"+998","uzbekistan":"+998","vu":"+678","vanuatu":"+678","va":"+379","vatican city":"+379","ve":"+58","venezuela":"+58","vn":"+84","vietnam":"+84","ye":"+967","yemen":"+967","zm":"+260","zambia":"+260","zw":"+263","zimbabwe":"+263","uk":"+44","uae":"+971","usa":"+1","u.s.a.":"+1","u.k.":"+44","viet nam":"+84"};
const COUNTRY_ISO: Record<string, string> = {"af":"AF","afghanistan":"AF","al":"AL","albania":"AL","dz":"DZ","algeria":"DZ","ad":"AD","andorra":"AD","ao":"AO","angola":"AO","ag":"AG","antigua and barbuda":"AG","ar":"AR","argentina":"AR","am":"AM","armenia":"AM","au":"AU","australia":"AU","at":"AT","austria":"AT","az":"AZ","azerbaijan":"AZ","bs":"BS","bahamas":"BS","bh":"BH","bahrain":"BH","bd":"BD","bangladesh":"BD","bb":"BB","barbados":"BB","by":"BY","belarus":"BY","be":"BE","belgium":"BE","bz":"BZ","belize":"BZ","bj":"BJ","benin":"BJ","bt":"BT","bhutan":"BT","bo":"BO","bolivia":"BO","ba":"BA","bosnia and herzegovina":"BA","bw":"BW","botswana":"BW","br":"BR","brazil":"BR","bn":"BN","brunei":"BN","bg":"BG","bulgaria":"BG","bf":"BF","burkina faso":"BF","bi":"BI","burundi":"BI","kh":"KH","cambodia":"KH","cm":"CM","cameroon":"CM","ca":"CA","canada":"CA","cv":"CV","cape verde":"CV","cf":"CF","central african republic":"CF","td":"TD","chad":"TD","cl":"CL","chile":"CL","cn":"CN","china":"CN","co":"CO","colombia":"CO","km":"KM","comoros":"KM","cg":"CG","congo":"CG","cr":"CR","costa rica":"CR","hr":"HR","croatia":"HR","cu":"CU","cuba":"CU","cy":"CY","cyprus":"CY","cz":"CZ","czechia":"CZ","cd":"CD","dr congo":"CD","dk":"DK","denmark":"DK","dj":"DJ","djibouti":"DJ","dm":"DM","dominica":"DM","do":"DO","dominican republic":"DO","ec":"EC","ecuador":"EC","eg":"EG","egypt":"EG","sv":"SV","el salvador":"SV","gq":"GQ","equatorial guinea":"GQ","er":"ER","eritrea":"ER","ee":"EE","estonia":"EE","sz":"SZ","eswatini":"SZ","et":"ET","ethiopia":"ET","fj":"FJ","fiji":"FJ","fi":"FI","finland":"FI","fr":"FR","france":"FR","ga":"GA","gabon":"GA","gm":"GM","gambia":"GM","ge":"GE","georgia":"GE","de":"DE","germany":"DE","gh":"GH","ghana":"GH","gr":"GR","greece":"GR","gd":"GD","grenada":"GD","gt":"GT","guatemala":"GT","gn":"GN","guinea":"GN","gw":"GW","guinea-bissau":"GW","gy":"GY","guyana":"GY","ht":"HT","haiti":"HT","hn":"HN","honduras":"HN","hk":"HK","hong kong":"HK","hu":"HU","hungary":"HU","is":"IS","iceland":"IS","in":"IN","india":"IN","id":"ID","indonesia":"ID","ir":"IR","iran":"IR","iq":"IQ","iraq":"IQ","ie":"IE","ireland":"IE","il":"IL","israel":"IL","it":"IT","italy":"IT","ci":"CI","ivory coast":"CI","jm":"JM","jamaica":"JM","jp":"JP","japan":"JP","jo":"JO","jordan":"JO","kz":"KZ","kazakhstan":"KZ","ke":"KE","kenya":"KE","ki":"KI","kiribati":"KI","xk":"XK","kosovo":"XK","kw":"KW","kuwait":"KW","kg":"KG","kyrgyzstan":"KG","la":"LA","laos":"LA","lv":"LV","latvia":"LV","lb":"LB","lebanon":"LB","ls":"LS","lesotho":"LS","lr":"LR","liberia":"LR","ly":"LY","libya":"LY","li":"LI","liechtenstein":"LI","lt":"LT","lithuania":"LT","lu":"LU","luxembourg":"LU","mo":"MO","macau":"MO","mg":"MG","madagascar":"MG","mw":"MW","malawi":"MW","my":"MY","malaysia":"MY","mv":"MV","maldives":"MV","ml":"ML","mali":"ML","mt":"MT","malta":"MT","mh":"MH","marshall islands":"MH","mr":"MR","mauritania":"MR","mu":"MU","mauritius":"MU","mx":"MX","mexico":"MX","fm":"FM","micronesia":"FM","md":"MD","moldova":"MD","mc":"MC","monaco":"MC","mn":"MN","mongolia":"MN","me":"ME","montenegro":"ME","ma":"MA","morocco":"MA","mz":"MZ","mozambique":"MZ","mm":"MM","myanmar":"MM","na":"NA","namibia":"NA","nr":"NR","nauru":"NR","np":"NP","nepal":"NP","nl":"NL","netherlands":"NL","nz":"NZ","new zealand":"NZ","ni":"NI","nicaragua":"NI","ne":"NE","niger":"NE","ng":"NG","nigeria":"NG","kp":"KP","north korea":"KP","mk":"MK","north macedonia":"MK","no":"NO","norway":"NO","om":"OM","oman":"OM","pk":"PK","pakistan":"PK","pw":"PW","palau":"PW","ps":"PS","palestine":"PS","pa":"PA","panama":"PA","pg":"PG","papua new guinea":"PG","py":"PY","paraguay":"PY","pe":"PE","peru":"PE","ph":"PH","philippines":"PH","pl":"PL","poland":"PL","pt":"PT","portugal":"PT","qa":"QA","qatar":"QA","ro":"RO","romania":"RO","ru":"RU","russia":"RU","rw":"RW","rwanda":"RW","kn":"KN","saint kitts and nevis":"KN","lc":"LC","saint lucia":"LC","vc":"VC","saint vincent and the grenadines":"VC","ws":"WS","samoa":"WS","sm":"SM","san marino":"SM","st":"ST","sao tome and principe":"ST","sa":"SA","saudi arabia":"SA","sn":"SN","senegal":"SN","rs":"RS","serbia":"RS","sc":"SC","seychelles":"SC","sl":"SL","sierra leone":"SL","sg":"SG","singapore":"SG","sk":"SK","slovakia":"SK","si":"SI","slovenia":"SI","sb":"SB","solomon islands":"SB","so":"SO","somalia":"SO","za":"ZA","south africa":"ZA","kr":"KR","south korea":"KR","ss":"SS","south sudan":"SS","es":"ES","spain":"ES","lk":"LK","sri lanka":"LK","sd":"SD","sudan":"SD","sr":"SR","suriname":"SR","se":"SE","sweden":"SE","ch":"CH","switzerland":"CH","sy":"SY","syria":"SY","tw":"TW","taiwan":"TW","tj":"TJ","tajikistan":"TJ","tz":"TZ","tanzania":"TZ","th":"TH","thailand":"TH","tl":"TL","timor-leste":"TL","tg":"TG","togo":"TG","to":"TO","tonga":"TO","tt":"TT","trinidad and tobago":"TT","tn":"TN","tunisia":"TN","tr":"TR","turkey":"TR","tm":"TM","turkmenistan":"TM","tv":"TV","tuvalu":"TV","ug":"UG","uganda":"UG","ua":"UA","ukraine":"UA","ae":"AE","united arab emirates":"AE","gb":"GB","united kingdom":"GB","us":"US","united states":"US","uy":"UY","uruguay":"UY","uz":"UZ","uzbekistan":"UZ","vu":"VU","vanuatu":"VU","va":"VA","vatican city":"VA","ve":"VE","venezuela":"VE","vn":"VN","vietnam":"VN","ye":"YE","yemen":"YE","zm":"ZM","zambia":"ZM","zw":"ZW","zimbabwe":"ZW","uk":"GB","uae":"AE","usa":"US","u.s.a.":"US","u.k.":"GB","viet nam":"VN"};
export const PHONE_NATIONAL_LENGTH: Record<string, [number, number]> = {
  IN: [10, 10],
  SG: [8, 8],
  US: [10, 10],
  CA: [10, 10],
  GB: [10, 10],
  AE: [9, 9],
  AU: [9, 9],
  MY: [9, 10],
  ID: [9, 12],
  PH: [10, 10],
  CN: [11, 11],
  HK: [8, 8],
  NZ: [8, 10],
  SA: [9, 9],
  QA: [8, 8],
  PK: [10, 10],
  BD: [10, 10],
  LK: [9, 9],
  TH: [9, 9],
  VN: [9, 10],
  JP: [10, 10],
  KR: [9, 10],
  DE: [10, 11],
  FR: [9, 9],
  IT: [9, 10],
  ES: [9, 9],
  NL: [9, 9],
  ZA: [9, 9],
  NG: [10, 10],
  KE: [9, 9],
  BR: [10, 11],
  MX: [10, 10],
  EG: [10, 10],
  TR: [10, 10],
};

/** Dial code (e.g. "+65") for a country name OR ISO-2 code. */
export function dialCodeFor(country?: string): string | undefined {
  if (!country) return undefined;
  return COUNTRY_DIAL[String(country).trim().toLowerCase()];
}
function isoFor(country?: string): string | undefined {
  if (!country) return undefined;
  return COUNTRY_ISO[String(country).trim().toLowerCase()];
}
function nationalMax(country?: string): number {
  const iso = isoFor(country);
  const r = iso ? PHONE_NATIONAL_LENGTH[iso] : undefined;
  return r ? r[1] : 12;
}

/**
 * Attach the country's dial code to a phone / WhatsApp number when it's missing.
 * - already has "+"      -> kept as-is
 * - "00" international    -> converted to "+"
 * - starts with the dial code digits and is longer than a national number
 *   -> assumed to already include the code, just prefixed with "+"
 * - otherwise (national number) -> leading trunk zeros stripped, dial code prepended
 * Unknown country -> returned unchanged.
 */
export function normalizePhone(raw: any, country?: string): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  s = s.replace(/[\s()\-.]/g, "");
  if (s.startsWith("+")) return s;
  if (s.startsWith("00")) return "+" + s.slice(2);
  const dial = dialCodeFor(country);
  if (!dial) return s; // unknown country — leave the number untouched
  const dialDigits = dial.replace(/\D/g, "");
  const digits = s.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith(dialDigits) && digits.length > nationalMax(country)) {
    return "+" + digits;
  }
  const national = digits.replace(/^0+/, "");
  return dial + national;
}
