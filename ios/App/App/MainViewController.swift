import UIKit
import Capacitor

class MainViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        // Habilita o gesto de "swipe to go back" do iOS
        self.webView?.allowsBackForwardNavigationGestures = true
    }
}
