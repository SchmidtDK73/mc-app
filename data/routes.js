// Rutebeskrivelser. Vejgeometri ligger i data/geometry.json (beregnet med OSRM på OpenStreetMap-data).
// Fakta er tjekket mod offentlige kilder (Naturstyrelsen, FDM, VisitDenmark m.fl.) – se "kilder" pr. rute.
// Vejtype: "kyst" = kystvej, "bakket" = bakket/snoet, "landevej" = åben landevej.
window.ROUTES = [
  /* ---------- Hjemmeture: rundture fra Hobro, Randers og Aars ---------- */
  {
    id: "mariager-fjord",
    navn: "Mariager Fjord rundt",
    region: "Nordjylland",
    hjem: "Hobro",
    vejtype: ["kyst", "bakket"],
    start: "Hobro", slut: "Hobro (rundtur)",
    beskrivelse:
      "Rundt om Mariager Fjord fra Hobro: ad sydsiden til klosterbyen Mariager og Hadsund, over Hadsundbroen og tilbage langs nordsiden via Vebbestrup og Valsgård. " +
      "Bakker og fjordudsigt hele vejen. Bemærk at Hadsundbroen er en klapbro, der om sommeren åbner for skibe hver halve time i dagtimerne – regn med lidt ventetid.",
    stop: [
      { navn: "Fyrkat Vikingeborg", tekst: "Ringborg fra vikingetiden ca. 3 km vest for Hobro – på UNESCOs verdensarvsliste. Kort afstikker fra start." },
      { navn: "Mariager", tekst: "Gammel klosterby med brostensgader, Mariager Kirke og Kloster samt Saltcenteret." },
      { navn: "Hohøj", tekst: "Stor gravhøj fra bronzealderen med udsigt over fjorden – lille afstikker mellem Mariager og Hadsund." },
      { navn: "Hadsundbroen", tekst: "251,7 m lang klapbro over fjorden. Café og havn i Hadsund." },
      { navn: "Hobro havn og Østerskov", tekst: "Afslut ved havnen i bunden af fjorden." }
    ],
    kilder: [
      { navn: "VisitDenmark: Mariagerfjord-ruten (rute 32)", url: "https://www.visitdenmark.com/denmark/plan-your-trip/route-32-the-mariagerfjord-route-gdk1113420" },
      { navn: "Danmarks Naturfredningsforening: Mariager Fjord-ruten (PDF)", url: "https://mariagerfjord.dn.dk/departments-media/7072/mariager_fjordruten_a4_apr11_-81mb.pdf" },
      { navn: "Opdag Danmark: Mariagerfjord", url: "https://www.opdagdanmark.dk/mariagerfjord/" }
    ]
  },
  {
    id: "randers-fjord",
    navn: "Randers Fjord rundt",
    region: "Midtjylland",
    hjem: "Randers",
    vejtype: ["kyst", "landevej"],
    start: "Randers", slut: "Randers (rundtur)",
    beskrivelse:
      "Fra Randers ud langs sydsiden af Randers Fjord via Assentoft til Udbyhøj ved Kattegat, over fjordens munding med den lille kabelfærge og hjem langs nordsiden via Havndal, Øster Tørslev og Gjerlev. " +
      "Flade, åbne landeveje med fjord- og engudsigt. Færgen tager op til 12 biler og sejler efter behov uden for højsæsonen – tjek sejlplanen før du kører (Randers Fjords Færgefart, tlf. 20 78 51 32).",
    stop: [
      { navn: "Randers", tekst: "Start ved Gudenåen og havnen." },
      { navn: "Udbyhøj Syd", tekst: "Kabelfærgen over Randers Fjord. Kort overfart." },
      { navn: "Udbyhøj (nordsiden)", tekst: "Lystbådehavn og lille fiskerleje ved fjordens udløb i Kattegat." },
      { navn: "Havndal", tekst: "Landsby på nordsiden – herfra over landet tilbage mod Randers." }
    ],
    kilder: [
      { navn: "VisitDenmark: Udbyhøj-kabelfærgen", url: "https://www.visitdenmark.com/denmark/plan-your-trip/udbyhoj-cable-ferry-across-randers-fjord-gdk605011" },
      { navn: "Randers Kommune: Færgefart", url: "https://www.randers.dk/om-os/organisering/udvikling-miljoe-og-teknik/plan-by-og-natur/randers-faergefart-og-flyveplads/" },
      { navn: "VisitDenmark: Udbyhøj Marina", url: "https://www.visitdenmark.com/denmark/plan-your-trip/marina-udbyhoj-gdk605095" }
    ]
  },
  {
    id: "vesthimmerland",
    navn: "Vesthimmerland & Limfjorden",
    region: "Nordjylland",
    hjem: "Aars",
    vejtype: ["kyst", "landevej", "bakket"],
    start: "Aars", slut: "Aars (rundtur)",
    beskrivelse:
      "Fra Aars mod vest over Farsø til Hvalpsund ved Limfjorden, videre forbi Gedsted og Aalestrup og hjem til Aars. " +
      "Rolige landeveje gennem Himmerlands bakkede landbrugsland og en havn med udsigt over tre fjorde. Gode muligheder for afstikkere til Louns-halvøen og Hessel.",
    stop: [
      { navn: "Farsø", tekst: "Barndomsby for forfatterne Johannes V. Jensen og Thit Jensen – deres barndomshjem kan besøges." },
      { navn: "Hvalpsund", tekst: "Færgeby ved Limfjorden med havn og udsigt til Limfjorden, Skive Fjord og Hjarbæk Fjord." },
      { navn: "Louns-halvøen (afstikker)", tekst: "Kuperet natur med skov, hede og kyst; Louns Kirke med rødder i middelalderen." },
      { navn: "Herregården Hessel", tekst: "En af Danmarks bedst bevarede stråtækte herregårde – i dag museum." },
      { navn: "Aars", tekst: "Gundestrupkarret blev fundet i Rævemosen nær Aars." }
    ],
    kilder: [
      { navn: "VisitHimmerland: Hvalpsund", url: "https://www.visithimmerland.eu/towns-and-locations/hvalpsund" },
      { navn: "VisitDenmark: Louns-halvøen", url: "https://www.visitdenmark.com/denmark/plan-your-trip/louns-peninsula-gdk623551" },
      { navn: "VisitDenmark: Kulturhistorisk rundtur langs Limfjorden i Himmerland", url: "https://www.visitdenmark.com/denmark/plan-your-trip/kulturhistorisk-rundtur-langs-limfjorden-i-himmerland-gdk1159056" }
    ]
  },
  {
    id: "aars-loegstoer",
    navn: "Løgstør & Aggersund",
    region: "Nordjylland",
    hjem: "Aars",
    vejtype: ["kyst", "landevej"],
    start: "Aars", slut: "Aars (rundtur)",
    beskrivelse:
      "Fra Aars mod nordvest via Ranum til muslingebyen Løgstør ved Limfjorden, over Aggersundbroen til vikingeborgen Aggersborg og tilbage via Overlade til Aars. " +
      "Rolige landeveje uden motorvej og flere steder udsigt over Limfjorden. Turen over broen og tilbage er kort, men giver et godt kig ud over fjorden.",
    stop: [
      { navn: "Ranum", tekst: "Lille by på vejen mod Løgstør. Vitskøl Kloster, et tidligere cistercienserkloster med ruiner og urtehaver, ligger i nærheden – en mulig afstikker.", pos: [56.8968, 9.2279] },
      { navn: "Løgstør og Frederik VII's Kanal", tekst: "Den 4,4 km lange kanal blev gravet med håndkraft 1856–61. Limfjordsmuseet ligger ved kanalen, og byen har en gammel hovedgade.", pos: [56.9622, 9.2631] },
      { navn: "Aggersborg", tekst: "Harald Blåtands første og største ringborg ved Aggersund – på UNESCOs verdensarvsliste.", pos: [56.9946, 9.2590] },
      { navn: "Overlade", tekst: "Landsby syd for Løgstør – herfra over Himmerland tilbage mod Aars.", pos: [56.8584, 9.2641] }
    ],
    kilder: [
      { navn: "VisitDenmark: Kulturhistorisk rundtur langs Limfjorden i Himmerland", url: "https://www.visitdenmark.com/denmark/plan-your-trip/kulturhistorisk-rundtur-langs-limfjorden-i-himmerland-gdk1159056" },
      { navn: "VisitDenmark: Muslingebyen Løgstør", url: "https://www.visitdenmark.com/denmark/plan-your-trip/the-city-of-mussels-the-history-of-logstor-gdk1122010" },
      { navn: "VisitHimmerland: Verdensarv (Aggersborg)", url: "https://www.visithimmerland.eu/excursions/worldheritage" }
    ]
  },
  {
    id: "aars-rold-skov",
    navn: "Rold Skov & Rebild fra Aars",
    region: "Nordjylland",
    hjem: "Aars",
    vejtype: ["bakket", "landevej"],
    start: "Aars", slut: "Aars (rundtur)",
    beskrivelse:
      "Fra Aars mod øst til Rebild Bakker, gennem Skørping og ned forbi Madum Sø i Rold Skov, videre via Arden og Rold og hjem over Nørager. " +
      "Skovveje og bakker gennem en af Danmarks største skove. Ca. 7 km af turen ligger på E45 mellem Rold og Nørager-egnen.",
    stop: [
      { navn: "Rebild Bakker", tekst: "Lyngklædte bakker i Rold Skov, fredet i 1940 og 1963. Mange vandrestier og udsigtspunkter.", pos: [56.8313, 9.8495] },
      { navn: "Skørping", tekst: "Stationsby midt i Rold Skov – god til en pause.", pos: [56.8347, 9.8880] },
      { navn: "Madum Sø og Store Blåkilde", tekst: "Skovsø i Rold Skov. Kildevældet Store Blåkilde ligger syd for søen og har sin blå farve fra vandet selv.", pos: [56.7894, 9.9504] },
      { navn: "Rold", tekst: "Landsby i den vestlige del af skoven – herfra mod vest tilbage til Aars.", pos: [56.7731, 9.8146] }
    ],
    kilder: [
      { navn: "Naturstyrelsen: Folder om Rold Skov (PDF)", url: "https://naturstyrelsen.dk/media/pchn20ur/folder-rold-skov.pdf" },
      { navn: "Rebildporten: Store Blåkilde", url: "https://www.rebildporten.com/guest/planlaeg-din-tur/store-blakilde-gdk679498" },
      { navn: "Lex.dk: Rold Skov", url: "https://lex.dk/Rold_Skov" }
    ]
  },
  {
    id: "hobro-hald-soe",
    navn: "Hald Sø & Dollerup Bakker",
    region: "Midtjylland",
    hjem: "Hobro",
    vejtype: ["bakket", "landevej"],
    start: "Hobro", slut: "Hobro (rundtur)",
    beskrivelse:
      "Fra Hobro mod vest over Møldrup til Viborg og ud til Hald Sø, hvor vejen snor sig gennem Dollerup Bakker forbi Niels Bugges Kro. Hjem via Rødkærsbro og Bjerringbro. " +
      "Ingen motorvej. Bakkerne omkring Hald Sø giver sving og stigninger på den sidste del mod Dollerup.",
    stop: [
      { navn: "Viborg", tekst: "Domkirkeby ved Viborgsøerne – god til en pause.", pos: [56.4507, 9.4094] },
      { navn: "Hald Ege og Hald Hovedgård", tekst: "Hald Sø er en af Danmarks reneste søer. Herregården Hald ligger ved søen midt i området De fem Halder.", pos: [56.4109, 9.3526] },
      { navn: "Niels Bugges Kro", tekst: "Kro i Dollerup Bakker, som har været fredet siden 1947. Borgbanken Gammel Hald ligger tæt ved.", pos: [56.3887, 9.3377] },
      { navn: "Bjerringbro", tekst: "By ved Gudenåen – herfra mod nord tilbage til Hobro.", pos: [56.3751, 9.6580] }
    ],
    kilder: [
      { navn: "Naturstyrelsen: Hald Sø – Dollerup (PDF)", url: "https://naturstyrelsen.dk/media/hach5phi/7_hald-soe-dollerup_web_220620.pdf" },
      { navn: "Naturstyrelsen: Hald Sø – Hald Hovedgård (PDF)", url: "https://naturstyrelsen.dk/media/ltgg4zmn/133_hald-soe-hald-hovedgaard_web_220620.pdf" },
      { navn: "VisitDenmark: De fem Halder ved Viborg", url: "https://www.visitdenmark.com/denmark/plan-your-trip/de-fem-halder-the-five-halds-near-viborg-gdk806465" }
    ]
  },
  {
    id: "hobro-als-odde",
    navn: "Als Odde & Kattegat",
    region: "Nordjylland",
    hjem: "Hobro",
    vejtype: ["kyst", "landevej"],
    start: "Hobro", slut: "Hobro (rundtur)",
    beskrivelse:
      "Fra Hobro langs Mariager Fjord til Hadsund og videre ud til Als Odde, hvor fjorden møder Kattegat. Op langs kysten til havnen i Øster Hurup og hjem over Terndrup. " +
      "Åbne landeveje, kystudsigt og ingen motorvej.",
    stop: [
      { navn: "Hadsund", tekst: "Fjordby med klapbro, havn og caféer.", pos: [56.7168, 10.1147] },
      { navn: "Als Odde", tekst: "Himmerlands sydøstligste spids, hvor Mariager Fjord løber ud i Kattegat. Lille havn for både og fiskerbåde.", pos: [56.7251, 10.3065] },
      { navn: "Øster Hurup", tekst: "Havneby ved Kattegat med en af Danmarks bedste børnevenlige strande.", pos: [56.8040, 10.2727] },
      { navn: "Terndrup", tekst: "Landsby på vejen tilbage gennem Himmerland mod Hobro.", pos: [56.8154, 10.0584] }
    ],
    kilder: [
      { navn: "VisitHimmerland: Mariagerfjord og Øster Hurup", url: "https://www.visithimmerland.eu/mariagerfjord" },
      { navn: "VisitDenmark: Als, Als Odde og Helberskov", url: "https://www.visitdenmark.nl/daenemark/explore/als-als-odde-helberskov-gdk1104502" },
      { navn: "VisitHimmerland: Øster Hurup", url: "https://www.visithimmerland.eu/oster-hurup/attractions" }
    ]
  },
  {
    id: "randers-fussingoe",
    navn: "Fussingø & Tjele Langsø",
    region: "Midtjylland",
    hjem: "Randers",
    vejtype: ["landevej", "bakket"],
    start: "Randers", slut: "Randers (rundtur)",
    beskrivelse:
      "Fra Randers mod vest til Fussingø Slot og Naturnationalpark Fussingø, videre til Tjele Langsø og ned til Bjerringbro ved Gudenåen. Hjem langs Gudenådalen via Langå. " +
      "Rolige veje gennem skov, sø og ådal – ingen motorvej.",
    stop: [
      { navn: "Fussingø Slot", tekst: "Renæssanceslot fra 1540 ved Fussing Sø, i dag statsejet. Danmarks første naturnationalpark med kvæg og kronhjorte ligger rundt om.", pos: [56.4619, 9.8433] },
      { navn: "Tjele Langsø", tekst: "Sø ved Tjele vest for Randers – flot at køre forbi.", pos: [56.5249, 9.5861] },
      { navn: "Bjerringbro", tekst: "By ved Gudenåen – god til frokost.", pos: [56.3751, 9.6580] },
      { navn: "Langå", tekst: "Stationsby i Gudenådalen på vejen tilbage til Randers.", pos: [56.3907, 9.8951] }
    ],
    kilder: [
      { navn: "VisitDenmark: Naturnationalpark Fussingø", url: "https://www.visitdenmark.com/denmark/plan-your-trip/nature-national-park-fussingo-gdk622724" },
      { navn: "VisitDenmark: Fussingø Slot", url: "https://www.visitdenmark.com/denmark/plan-your-trip/fussingo-castle-gdk622723" },
      { navn: "VisitDenmark: Cykelrute Fussingø og Læsten Bakker", url: "https://www.visitdenmark.com/denmark/plan-your-trip/cycling-route-fussingo-and-laesten-bakker-gdk1117833" }
    ]
  },
  {
    id: "randers-mols",
    navn: "Mols Bjerge & Kalø",
    region: "Midtjylland",
    hjem: "Randers",
    vejtype: ["bakket", "kyst"],
    start: "Randers", slut: "Randers (rundtur)",
    beskrivelse:
      "Fra Randers mod sydøst til Rønde og Kalø Vig, ind i Nationalpark Mols Bjerge via den gamle mølleby Femmøller og Knebel, og hjem over Ryomgård og Auning. " +
      "Bakket nationalparklandskab med udsigt over vigene. Ingen motorvej.",
    stop: [
      { navn: "Kalø Slotsruin", tekst: "Ca. 700 år gammel borgruin på en tange ude i Kalø Vig. Parkér ved Kalø og gå ud ad dæmningen.", pos: [56.2935, 10.4800] },
      { navn: "Femmøller", tekst: "Mølleby, der oprindeligt havde fem vandmøller – fire mølledamme er bevaret.", pos: [56.2406, 10.5749] },
      { navn: "Knebel og Agri Bavnehøj", tekst: "Fra Knebel er der en kort afstikker via Agri til Agri Bavnehøj – det højeste punkt i Mols Bjerge, 137 m over havet.", pos: [56.2142, 10.4874] },
      { navn: "Ryomgård", tekst: "Stationsby på vejen nordpå tilbage mod Randers.", pos: [56.3812, 10.5010] }
    ],
    kilder: [
      { navn: "Nationalpark Mols Bjerge: Mols Bjerge", url: "https://eng.nationalparkmolsbjerge.dk/experience-the-national-park/mols-bjerge" },
      { navn: "Nationalpark Mols Bjerge: Rutebeskrivelse Kalø-etapen (PDF)", url: "https://nationalparkmolsbjerge.dk/media/cnff3tqj/rutebeskrivelse-kaloeetapen.pdf" },
      { navn: "Opdag Danmark: Kalø Slotsruin", url: "https://www.opdagdanmark.dk/en/oplevelser/kaloe-slotsruin/" }
    ]
  },
  /* ---------- Øvrige ruter i Danmark ---------- */
  {
    id: "margueritruten-soehoejlandet",
    navn: "Margueritruten – Søhøjlandet",
    region: "Midtjylland",
    vejtype: ["bakket", "landevej"],
    start: "Silkeborg", slut: "Skanderborg",
    beskrivelse:
      "Et udsnit af Margueritruten, Danmarks nationale turistrute (indviet 1991, ca. 4.200 km i alt, vedligeholdt af Naturstyrelsen). " +
      "Strækningen går gennem Søhøjlandet med søer, bøgeskov og bakker forbi Himmelbjerget og Ry. Følg de brune skilte med margueritblomsten. " +
      "Smalle, snoede veje – pas på cyklister i weekenden.",
    stop: [
      { navn: "Silkeborg havn", tekst: "Start ved Gudenåen og Silkeborg Langsø." },
      { navn: "Himmelbjerget", tekst: "Udsigt over Julsø og tårnet. Parkering ved toppen." },
      { navn: "Ry", tekst: "Café og tankstation; Gudenåen og Knudsø tæt på." },
      { navn: "Skanderborg", tekst: "Afslut ved Skanderborg Sø." }
    ],
    kilder: [
      { navn: "FDM: Margueritruten er blevet længere", url: "https://fdm.dk/nyheder/trafik/2016-07-margueritruten-er-blevet-laengere" },
      { navn: "Wikivoyage: Marguerite Route", url: "https://en.wikivoyage.org/wiki/Marguerite_Route" }
    ]
  },
  {
    id: "jyske-aas",
    navn: "Den Jyske Ås",
    region: "Nordjylland",
    vejtype: ["bakket"],
    start: "Sæby", slut: "Sæby (rundtur)",
    beskrivelse:
      "Rundtur fra Sæby op over Den Jyske Ås – Vendsyssels højdedrag med skov, hede og vidt udsyn over Kattegat. " +
      "Ruten følger offentlige veje via Voersaa og Dronninglund til Østervrå. Bemærk: de afmærkede Jyske Ås-ruter er cykel- og gangstier – kør kun på vejene.",
    stop: [
      { navn: "Sæby havn", tekst: "Hyggelig købstad og havn – godt startsted." },
      { navn: "Voersaa", tekst: "Lille havn ved Kattegat." },
      { navn: "Dronninglund Slot", tekst: "Startpunkt for Jyske Ås-stierne; slotspark og café." },
      { navn: "Østervrå", tekst: "Endepunkt for Jyske Ås-stien; herfra tilbage mod Sæby." }
    ],
    kilder: [
      { navn: "VisitDenmark: Jyske Ås", url: "https://www.visitdenmark.com/denmark/plan-your-trip/hiking-jyske-as-252-km-gdk600581" },
      { navn: "Frederikshavn Kommune: Stier og ruter (PDF)", url: "https://natur.frederikshavn.dk/media/nftgy4k5/vandrestier_og_cykelruter_folder_2024.pdf" }
    ]
  },
  {
    id: "vejle-aadal",
    navn: "Vejle Ådal & Jelling",
    region: "Syddanmark",
    vejtype: ["bakket", "landevej"],
    start: "Vejle", slut: "Vejle (rundtur)",
    beskrivelse:
      "Stejle skrænter, ådal og kongehistorie. Rundturen går fra Vejle ud gennem ådalen til Ravning, ned over Egtved og tilbage via Jelling. " +
      "Nogle af Jyllands bedste bakker og sving – vejene er smalle, så hold farten nede i ådalen.",
    stop: [
      { navn: "Ravningbroen / Ravning Station", tekst: "Rekonstrueret del af Harald Blåtands ca. 750 m lange egebro fra vikingetiden; udstilling på Ravning Station." },
      { navn: "Egtvedpigens grav", tekst: "Gravhøj fra bronzealderen ved Egtved." },
      { navn: "Jellingmonumenterne", tekst: "UNESCO-verdensarv: runesten, høje og kirke. Oplevelsescenteret Kongernes Jelling." },
      { navn: "Vejle", tekst: "Fjorden og Bølgen ved havnen." }
    ],
    kilder: [
      { navn: "VisitVejle: Middelalderruten (regionalrute 35)", url: "https://www.visitvejle.com/vejle/plan-your-holidays/medieval-route-regional-bicycle-route-no-35-gdk992100" },
      { navn: "VisitDenmark: Ritter-Ruten (Vejle Ådal)", url: "https://visitdenmark.se/danmark/planera-resan/ritter-ruten-gdk1113008" }
    ]
  },
  {
    id: "rold-skov",
    navn: "Rold Skov & Rebild Bakker",
    region: "Nordjylland",
    vejtype: ["bakket"],
    start: "Støvring", slut: "Støvring (rundtur)",
    beskrivelse:
      "Kort, flot tur gennem Danmarks største sammenhængende skov (over 8.000 ha) og forbi Rebild Bakker. " +
      "Snoede skovveje med skygge, perfekt en varm sommerdag. Pas på vildt i skumringen.",
    stop: [
      { navn: "Rebild Bakker", tekst: "Lyngbakker med udsigt; her fejres den amerikanske uafhængighedsdag hvert år 4. juli." },
      { navn: "Store Blåkilde", tekst: "Krystalklar, blå kildesø (ca. 12 m bred). Ca. 1 km gåtur fra parkering." },
      { navn: "Lille Blåkilde", tekst: "Et af Danmarks mest vandrige kildevæld – vandet kan drikkes." },
      { navn: "Skørping", tekst: "Café og tankstation ved skovkanten." }
    ],
    kilder: [
      { navn: "Naturstyrelsen: Rold Skov", url: "https://eng.naturstyrelsen.dk/experience-nature/explore-denmark-s-nature-with-our-guides/rold-skov/history" },
      { navn: "Rebildporten: Rold Skov", url: "https://www.rebildporten.com/rold-forest" },
      { navn: "VisitDenmark: Store Blåkilde", url: "https://visitdenmark.se/danmark/planera-resan/store-blakilde-gdk1127272" }
    ]
  },
  {
    id: "stevns-klint",
    navn: "Stevns Klint",
    region: "Sjælland",
    vejtype: ["kyst", "landevej"],
    start: "Køge", slut: "Køge (rundtur)",
    beskrivelse:
      "Fra Køge langs kysten til Rødvig og op til Højerup ved Stevns Klint – UNESCO-verdensarv siden 2014 pga. fiskeleret, der viser dinosaurernes uddøen. " +
      "Åbne landeveje over Stevns' flade landbrugsland og afstikkere ud til klinten.",
    stop: [
      { navn: "Rødvig havn", tekst: "Fiskerleje med røgeri og is." },
      { navn: "Stevns Fort", tekst: "Museum fra Den Kolde Krig i klinten." },
      { navn: "Højerup Gamle Kirke", tekst: "Kirke fra 1200-tallet på kanten af klinten; koret styrtede i havet i 1928. Parkering mod betaling. 110 trin ned til stranden." },
      { navn: "Store Heddinge", tekst: "Byens ottekantede kirke – tilbage mod Køge." }
    ],
    kilder: [
      { navn: "Sydsjælland & Møn: Stevns Klint", url: "https://www.southzealand-mon.com/stevns-klint" },
      { navn: "Sydsjælland & Møn: Højerup Gamle Kirke", url: "https://www.southzealand-mon.com/hoejerup-old-church-gdk1058636" },
      { navn: "Lex.dk: Stevns Klint", url: "https://lex.dk/Stevns_Klint" }
    ]
  },
  {
    id: "moen",
    navn: "Møn & Møns Klint",
    region: "Sjælland",
    vejtype: ["bakket", "kyst"],
    start: "Kalvehave", slut: "Stege",
    beskrivelse:
      "Over Dronning Alexandrines Bro til Stege og videre ud over Østmøn til Møns Klint – kridtklinter op til 128 m over havet. " +
      "Høje Møn byder på bakker og sving gennem bøgeskov; retur via Klintholm Havn.",
    stop: [
      { navn: "Dronning Alexandrines Bro", tekst: "Den gamle bro (Mønbroen) fra 1943 mellem Sjælland og Møn." },
      { navn: "Stege", tekst: "Middelalderby med Mølleporten." },
      { navn: "GeoCenter Møns Klint", tekst: "Oplevelsescenter og trapper ned til stranden ved klinten." },
      { navn: "Klintholm Havn", tekst: "Fiskerihavn med restauranter." }
    ],
    kilder: [
      { navn: "Lex.dk: Møns Klint", url: "https://lex.dk/M%C3%B8ns_Klint" },
      { navn: "Sydsjælland & Møn", url: "https://www.southzealand-mon.com/" }
    ]
  },
  {
    id: "nordsjaellands-kyst",
    navn: "Nordsjællands kyst",
    region: "Hovedstaden",
    vejtype: ["kyst"],
    start: "Klampenborg", slut: "Tisvildeleje",
    beskrivelse:
      "Klassikeren: Strandvejen langs Øresund fra Klampenborg til Helsingør, og derfra videre langs nordkysten via Hornbæk og Gilleleje til Tisvildeleje. " +
      "Smuk men tæt trafik på sommerdage – kør tidligt om morgenen. Parkering ved strandene er sparsom.",
    stop: [
      { navn: "Bellevue Strand", tekst: "Start ved Klampenborg." },
      { navn: "Kronborg, Helsingør", tekst: "UNESCO-slot ved Øresund." },
      { navn: "Hornbæk havn", tekst: "Café og is ved havnen." },
      { navn: "Gilleleje havn", tekst: "Fiskehus og røgeri – Sjællands nordligste by." },
      { navn: "Tisvildeleje", tekst: "Strand og Tisvilde Hegn." }
    ],
    kilder: [
      { navn: "VisitNordsjælland: Nordkystruten (rute 47)", url: "https://www.visitnorthzealand.com/north-coast-path-cycling-route-47-along-north-zealand-coast-gdk680396" },
      { navn: "FDM: Nordkystvejen (rute 251)", url: "https://fdm.dk/nyheder/nyt-om-trafik-og-biler/2024-06-efter-40-aar-finere-vej-til-sjaellands-top" }
    ]
  },
  {
    id: "djursland",
    navn: "Djursland & Mols Bjerge",
    region: "Midtjylland",
    vejtype: ["bakket", "kyst", "landevej"],
    start: "Rønde", slut: "Rønde (rundtur)",
    beskrivelse:
      "Rundtur gennem Nationalpark Mols Bjerge med istidsbakker op til 137 m (Agri Bavnehøj), videre til Ebeltoft, op langs østkysten til Grenaa og hjem via nordkysten ved Fjellerup. " +
      "Varieret tur med både bakker, kyst og åbne landeveje.",
    stop: [
      { navn: "Kalø Slotsruin", tekst: "Middelalderborg på en halvø i Kalø Vig – kort gåtur fra parkering." },
      { navn: "Agri Bavnehøj / Trehøje", tekst: "Mols Bjerges højeste punkter med udsigt." },
      { navn: "Ebeltoft", tekst: "Brostensgader og Fregatten Jylland." },
      { navn: "Grenaa havn", tekst: "Kattegatcentret og fiskerestauranter." },
      { navn: "Fjellerup Strand", tekst: "Kendt for vaffelbageriet ved stranden." }
    ],
    kilder: [
      { navn: "Naturstyrelsen: Nationalpark Mols Bjerge", url: "https://naturstyrelsen.dk/media/fhkdrj5w/npmolsbjerge_de_a4.pdf" },
      { navn: "VisitAarhus: Djurslandskort 2024 (PDF)", url: "https://www.visitaarhus.dk/sites/visitaarhus.com/files/2024-05/Djurslandskort-2024_VisitAarhus_Web.pdf" }
    ]
  }
];
