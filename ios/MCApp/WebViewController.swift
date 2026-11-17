import UIKit
import WebKit

/// Viser webappen i fuld skærm og forbinder den med telefonens GPS og delingsmenu.
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private var web: WKWebView!
    private let gps = NativeGPS()
    private var visterOffline = false

    override func loadView() {
        let cfg = WKWebViewConfiguration()
        // Kun appens eget domæne kører i appen. Det giver service worker (offline) og lov til at bruge Bro.js.
        cfg.limitsNavigationsToAppBoundDomains = !TESTSERVER
        cfg.websiteDataStore = .default()
        let uc = WKUserContentController()
        uc.addUserScript(WKUserScript(source: Bro.js, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        uc.add(self, name: "mcapp")
        cfg.userContentController = uc

        web = WKWebView(frame: .zero, configuration: cfg)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.isOpaque = false
        web.backgroundColor = UIColor(named: "Baggrund")
        web.scrollView.backgroundColor = UIColor(named: "Baggrund")
        web.scrollView.contentInsetAdjustmentBehavior = .never   // webappen styrer selv kanterne (safe-area)
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }
        #endif
        view = web
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        gps.send = { [weak self] js in self?.web.evaluateJavaScript(js, completionHandler: nil) }
        hent()
        NotificationCenter.default.addObserver(self, selector: #selector(blevAktiv),
                                               name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    private func hent() {
        visterOffline = false
        web.load(URLRequest(url: APP_URL))
    }

    @objc private func blevAktiv() {
        gps.toemBuffer()
        if visterOffline { hent() }
    }

    // MARK: Beskeder fra webappen

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let d = message.body as? [String: Any], let t = d["t"] as? String else { return }
        switch t {
        case "watch": gps.watch(id: (d["id"] as? NSNumber)?.intValue ?? 0, baggrund: d["baggrund"] as? Bool ?? false)
        case "clear": gps.clear(id: (d["id"] as? NSNumber)?.intValue ?? 0)
        case "del": del(navn: d["navn"] as? String ?? "fil.txt", tekst: d["tekst"] as? String ?? "")
        case "igen": hent()
        default: break
        }
    }

    /// Gemmer en fil (fx GPX) og åbner telefonens delingsmenu, hvor Beeline, Garmin, Filer osv. står.
    private func del(navn: String, tekst: String) {
        let rent = navn.replacingOccurrences(of: "/", with: "-")
        let mappe = FileManager.default.temporaryDirectory.appendingPathComponent("del", isDirectory: true)
        try? FileManager.default.createDirectory(at: mappe, withIntermediateDirectories: true)
        let fil = mappe.appendingPathComponent(rent.isEmpty ? "fil.txt" : rent)
        do { try tekst.write(to: fil, atomically: true, encoding: .utf8) } catch { return }
        let ark = UIActivityViewController(activityItems: [fil], applicationActivities: nil)
        ark.popoverPresentationController?.sourceView = view
        ark.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 80, width: 1, height: 1)
        present(ark, animated: true)
    }

    // MARK: Navigation: links til andre sider åbnes i Safari, Kort osv.

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { return decisionHandler(.allow) }
        let intern = url.host == APP_URL.host || ["about", "blob", "data"].contains(url.scheme ?? "")
        if intern || navigationAction.targetFrame?.isMainFrame == false {
            decisionHandler(.allow)
        } else {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { UIApplication.shared.open(url) }   // target="_blank"
        return nil
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        gps.sidenGenstartet()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let e = error as NSError
        if e.domain == NSURLErrorDomain && e.code == NSURLErrorCancelled { return }
        if !visterOffline {
            visterOffline = true
            web.loadHTMLString(Bro.offlineHTML, baseURL: APP_URL)
        }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        // iOS har lukket websiden for at spare hukommelse: start den igen på samme side (optagelsen fortsætter)
        if webView.url != nil && !visterOffline { webView.reload() } else { hent() }
    }

    // MARK: alert / confirm / prompt fra webappen

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Annuller", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        a.addTextField { $0.text = defaultText }
        a.addAction(UIAlertAction(title: "Annuller", style: .cancel) { _ in completionHandler(nil) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(a.textFields?.first?.text) })
        present(a, animated: true)
    }
}
