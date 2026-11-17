import UIKit

/// Adressen på den udgivne webapp. Appen viser altid den nyeste udgave herfra, og service workeren
/// gemmer den, så den også virker uden net.
let APP_URL: URL = {
    #if DEBUG
    // Kun test-udgaven: start med  -MCAPP_URL http://localhost:8790/  for at vise den lokale udgave
    if let s = UserDefaults.standard.string(forKey: "MCAPP_URL"), let u = URL(string: s) { return u }
    #endif
    return URL(string: "https://schmidtdk73.github.io/mc-app/")!
}()
/// Den lokale testserver ligger ikke på et "app-bound" domæne (så er der ingen service worker).
let TESTSERVER = APP_URL.host != "schmidtdk73.github.io"

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        true
    }

    func application(_ application: UIApplication,
                     configurationForConnecting session: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        UISceneConfiguration(name: "Default", sessionRole: session.role)
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let w = UIWindow(windowScene: windowScene)
        w.rootViewController = WebViewController()
        w.makeKeyAndVisible()
        window = w
    }
}
