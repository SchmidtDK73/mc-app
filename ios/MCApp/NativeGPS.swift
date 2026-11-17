import CoreLocation
import UIKit

/// Rigtig GPS til webappen. Webappens navigator.geolocation erstattes (se Bro.swift) med denne.
/// En optagelse (watch med baggrund = true) fortsætter, når skærmen slukkes eller appen lægges væk:
/// punkterne gemmes her og afleveres samlet, når appen åbnes igen.
final class NativeGPS: NSObject, CLLocationManagerDelegate {
    /// Kører JavaScript i webappen.
    var send: ((String) -> Void)?

    private let lm = CLLocationManager()
    private var watches: [Int: Bool] = [:]   // id → baggrund
    private var buffer: [CLLocation] = []
    /// Siden er genindlæst midt i en optagelse: bliv ved med at samle punkter, til den nye side starter igen.
    private var venterPaaOptag = false
    private let maksBuffer = 50_000

    override init() {
        super.init()
        lm.delegate = self
        lm.desiredAccuracy = kCLLocationAccuracyBest
        lm.distanceFilter = 10
        lm.activityType = .automotiveNavigation
        lm.pausesLocationUpdatesAutomatically = false
    }

    private var harTilladelse: Bool {
        lm.authorizationStatus == .authorizedWhenInUse || lm.authorizationStatus == .authorizedAlways
    }
    private var optager: Bool { watches.values.contains(true) }

    func watch(id: Int, baggrund: Bool) {
        watches[id] = baggrund
        if baggrund { venterPaaOptag = false }
        switch lm.authorizationStatus {
        case .notDetermined:
            lm.requestWhenInUseAuthorization()   // fortsætter i locationManagerDidChangeAuthorization
        case .denied, .restricted:
            afvisAlle()
        default:
            opdater()
            if let l = lm.location, l.horizontalAccuracy >= 0, -l.timestamp.timeIntervalSinceNow < 15 {
                lever([l], til: [id])           // kendt position med det samme
            }
        }
        if baggrund { toemBuffer() }
    }

    func clear(id: Int) {
        watches[id] = nil
        opdater()
    }

    /// Kaldes, når en ny side er indlæst: de gamle watch-id'er findes ikke længere.
    func sidenGenstartet() {
        if optager { venterPaaOptag = true }
        watches.removeAll()
        opdater()
    }

    private func opdater() {
        if venterPaaOptag && harTilladelse {
            lm.allowsBackgroundLocationUpdates = true
            lm.showsBackgroundLocationIndicator = true
            lm.startUpdatingLocation()
            return
        }
        if watches.isEmpty || !harTilladelse {
            lm.stopUpdatingLocation()
            lm.allowsBackgroundLocationUpdates = false
            return
        }
        lm.allowsBackgroundLocationUpdates = optager
        lm.showsBackgroundLocationIndicator = optager
        lm.startUpdatingLocation()
    }

    private func afvisAlle() {
        venterPaaOptag = false
        let ids = Array(watches.keys)
        watches.removeAll()
        opdater()
        for id in ids { send?("window.__mcFejl && window.__mcFejl(\(id),1)") }
    }

    /// Afleverer punkter, der er samlet op, mens appen var i baggrunden.
    func toemBuffer() {
        guard !buffer.isEmpty, UIApplication.shared.applicationState == .active else { return }
        let ids = watches.filter { $0.value }.map { $0.key }
        guard !ids.isEmpty else { return }       // gem til optagelsen er i gang igen (fx efter genindlæsning)
        let b = buffer
        buffer.removeAll()
        // i bidder, så webappen ikke får én kæmpe kommando
        stride(from: 0, to: b.count, by: 2000).forEach { lever(Array(b[$0..<min($0 + 2000, b.count)]), til: ids) }
    }

    private func lever(_ locs: [CLLocation], til ids: [Int]) {
        let gyldige = locs.filter { $0.horizontalAccuracy >= 0 }
        guard !gyldige.isEmpty, !ids.isEmpty else { return }
        let liste = gyldige.map { l -> String in
            let fart = l.speed >= 0 ? "\(l.speed)" : "null"
            let kurs = l.course >= 0 ? "\(l.course)" : "null"
            return "{coords:{latitude:\(l.coordinate.latitude),longitude:\(l.coordinate.longitude),accuracy:\(l.horizontalAccuracy),"
                + "altitude:\(l.altitude),altitudeAccuracy:\(l.verticalAccuracy),speed:\(fart),heading:\(kurs)},"
                + "timestamp:\(Int64(l.timestamp.timeIntervalSince1970 * 1000))}"
        }.joined(separator: ",")
        send?("window.__mcPos && window.__mcPos([\(ids.map(String.init).joined(separator: ","))],[\(liste)])")
    }

    // MARK: CLLocationManagerDelegate

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .denied, .restricted: afvisAlle()
        case .authorizedWhenInUse, .authorizedAlways: opdater()
        default: break
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        if venterPaaOptag {
            buffer.append(contentsOf: locations)
        } else if UIApplication.shared.applicationState == .active {
            toemBuffer()
            lever(locations, til: Array(watches.keys))
        } else if optager {
            buffer.append(contentsOf: locations)
            if buffer.count > maksBuffer { buffer.removeFirst(buffer.count - maksBuffer) }
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if (error as? CLError)?.code == .denied { afvisAlle() }
        // andre fejl (fx midlertidigt ingen position) går over af sig selv
    }
}
