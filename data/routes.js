// Rutebeskrivelser. Vejgeometri ligger i data/geometry.json (beregnet med OSRM på OpenStreetMap-data).
// Fakta er tjekket mod offentlige kilder (Naturstyrelsen, FDM, VisitDenmark m.fl.) – se "kilder" pr. rute.
// Vejtype: "kyst" = kystvej, "bakket" = bakket/snoet, "landevej" = åben landevej.
window.ROUTES = [
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
