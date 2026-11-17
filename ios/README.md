# MC-app til iPhone

En lille iPhone-app, der viser den udgivne MC-app (https://schmidtdk73.github.io/mc-app/) i fuld skærm.
Den bruger telefonens rigtige funktioner:

- **GPS i baggrunden:** en optaget tur fortsætter, når skærmen slukkes, eller du bruger andre apps.
- **Rigtig delingsmenu:** GPX-filer kan sendes direkte til Beeline, Garmin, Filer osv.
- **Offline:** når appen har været åben én gang med net, virker den også uden.
- **Automatiske opdateringer:** ændringer på hjemmesiden slår igennem i appen uden en ny version i App Store.

Koden er ren Swift uden eksterne biblioteker:
`App.swift`, `WebViewController.swift`, `NativeGPS.swift` og `Bro.swift` (JavaScript-broen til webappen).

## Åbn og kør (gratis)

1. Åbn `ios/MCApp.xcodeproj` i Xcode.
2. **I simulatoren:** vælg en iPhone-simulator øverst, og tryk ▶︎.
3. **På din egen iPhone** (gratis, uden Apple Developer-medlemskab):
   - Xcode › Settings › Accounts: log ind med dit Apple-id.
   - Klik på projektet › Signing & Capabilities › Team: vælg dit navn (Personal Team).
   - Sæt iPhonen i med kabel, vælg den øverst, og tryk ▶︎.
   - På iPhonen første gang: Indstillinger › Generelt › VPN og enhedsadministration › stol på udvikleren, og slå Udviklertilstand til, hvis den spørger.
   - Med et gratis Apple-id virker appen i 7 dage ad gangen. Tryk ▶︎ igen for at forny.

Projektet er lavet ud fra `project.yml`. Har du ændret den, så kør `xcodegen` i `ios`-mappen.

## Til App Store (kræver Apple Developer Program, 99 $/år)

1. Meld dig ind på developer.apple.com. Som privatperson vises dit navn som udgiver.
2. Vælg dit betalte team under Signing & Capabilities. Ret evt. bundle-id'et `io.github.schmidtdk73.mcapp`.
3. Opret appen i App Store Connect med:
   - **Privatlivspolitik:** https://schmidtdk73.github.io/mc-app/privatliv.html
   - **Support-adresse:** fx https://github.com/SchmidtDK73/mc-app
   - **App Privacy:** "Placering – bruges i appen, ikke knyttet til dig, ikke til sporing".
   - **Kategori:** Navigation eller Rejser. **Aldersgrænse:** 4+.
   - **EU (DSA):** "ikke erhvervsdrivende", hvis appen er gratis og uden indtægt.
   - **Skærmbilleder:** fra den største iPhone-simulator (Xcode › simulator › ⌘S).
4. I Xcode: Product › Archive › Distribute App › App Store Connect.
5. Test først via TestFlight, og send derefter til gennemgang.

Ikonet er tegnet af `tools/make_icons.py` (1024×1024 ligger i `MCApp/Assets.xcassets/AppIcon.appiconset`).

## Test mod den lokale udgave

Kun test-udgaven (Debug) kan vise den lokale udgave fra `http://localhost:8790/`.
Start den med argumentet `-MCAPP_URL http://localhost:8790/` under Product › Scheme › Edit Scheme › Arguments.
