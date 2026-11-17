/// JavaScript, der lægges ind i webappen, før den starter.
/// - window.mcNative: fortæller webappen, at den kører i iPhone-appen, og giver en rigtig delingsmenu.
/// - navigator.geolocation: erstattes med appens egen GPS (NativeGPS.swift).
///   watchPosition(..., { baggrund: true }) bliver ved, også med skærmen slukket.
enum Bro {
    static let js = #"""
    (() => {
      if (window.mcNative) return;
      const post = (m) => window.webkit.messageHandlers.mcapp.postMessage(m);
      const cb = new Map();
      let n = 0;
      const mc = window.mcNative = {
        platform: "ios",
        iBatch: false,
        del: (navn, tekst) => post({ t: "del", navn: String(navn), tekst: String(tekst) }),
        igen: () => post({ t: "igen" })
      };
      window.__mcPos = (ids, liste) => {
        mc.iBatch = liste.length > 1;
        try {
          for (const p of liste) for (const id of ids) {
            const c = cb.get(id);
            if (c) { try { c.ok(p); } catch (e) { console.error(e); } }
          }
        } finally {
          if (mc.iBatch) { mc.iBatch = false; window.dispatchEvent(new Event("mcgps-batch")); }
        }
      };
      window.__mcFejl = (id, code) => {
        const c = cb.get(id); cb.delete(id);
        if (c && c.fejl) c.fejl({ code, message: "Placering er ikke tilladt", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
      };
      const geo = {
        watchPosition(ok, fejl, opt) {
          const id = ++n;
          cb.set(id, { ok, fejl });
          post({ t: "watch", id, baggrund: !!(opt && opt.baggrund) });
          return id;
        },
        clearWatch(id) { if (cb.delete(id)) post({ t: "clear", id }); },
        getCurrentPosition(ok, fejl, opt) {
          const id = geo.watchPosition((p) => { geo.clearWatch(id); ok(p); },
                                       (e) => { geo.clearWatch(id); if (fejl) fejl(e); }, opt);
        }
      };
      try { Object.defineProperty(Navigator.prototype, "geolocation", { get: () => geo, configurable: true }); } catch (e) { /* tom */ }
    })();
    """#

    /// Vises, hvis appen åbnes første gang uden net (ellers kommer webappen fra service workerens lager).
    static let offlineHTML = #"""
    <!doctype html><html lang="da"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <style>
      :root { color-scheme: light dark; }
      body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
             font: 17px -apple-system, system-ui, sans-serif; background: #f2f2f7; color: #1c1c1e; text-align: center; }
      @media (prefers-color-scheme: dark) { body { background: #000; color: #f2f2f7; } }
      main { padding: 24px; max-width: 320px; }
      h1 { font-size: 22px; margin: 0 0 8px; }
      p { opacity: .7; line-height: 1.4; }
      button { margin-top: 16px; border: 0; border-radius: 14px; padding: 14px 28px; font: 600 17px -apple-system, system-ui;
               background: #f26322; color: #fff; }
    </style></head><body><main>
      <h1>Ingen forbindelse</h1>
      <p>MC-app skal på nettet én gang for at hente ruter og kort. Bagefter virker den også uden net.</p>
      <button onclick="window.mcNative ? mcNative.igen() : location.reload()">Prøv igen</button>
    </main></body></html>
    """#
}
