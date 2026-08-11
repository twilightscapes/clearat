//
//  ViewController.swift
//  Shared (App)
//
//  Created by Todd Lambert on 8/9/26.
//
//  iOS shows a native instruction screen — it renders instantly, where the
//  old template booted a whole WKWebView to display two sentences. macOS
//  keeps the template's web-based window (it hosts the working
//  "open Safari preferences" button and loads fast on the Mac).
//

import WebKit

#if os(iOS)
import UIKit
typealias PlatformViewController = UIViewController
#elseif os(macOS)
import Cocoa
import SafariServices
typealias PlatformViewController = NSViewController
#endif

let extensionBundleIdentifier = "app.clearat.ClearAT.Extension"

class ViewController: PlatformViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

#if os(iOS)

    // The window IS the Clear AT web app. The native instruction screen
    // renders instantly and doubles as the loading state; the live app
    // fades in over it when ready, and it stays as the offline fallback.
    private let webAppURL = URL(string: "https://clearat.app/app/")!
    private var spinner: UIActivityIndicatorView!
    private var retryButton: UIButton!

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        buildInstructionScreen()
        loadWebApp()
    }

    private func buildInstructionScreen() {
        let icon = UIImageView(image: UIImage(named: "LargeIcon"))
        icon.contentMode = .scaleAspectFit
        icon.layer.cornerRadius = 28
        icon.clipsToBounds = true
        icon.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            icon.widthAnchor.constraint(equalToConstant: 128),
            icon.heightAnchor.constraint(equalToConstant: 128),
        ])

        let title = UILabel()
        title.text = "Clear AT"
        title.font = .preferredFont(forTextStyle: .title2)
        title.adjustsFontForContentSizeCategory = true

        func paragraph(_ text: String, secondary: Bool = true) -> UILabel {
            let label = UILabel()
            label.text = text
            label.font = .preferredFont(forTextStyle: secondary ? .callout : .body)
            label.textColor = secondary ? .secondaryLabel : .label
            label.adjustsFontForContentSizeCategory = true
            label.numberOfLines = 0
            label.textAlignment = .center
            return label
        }

        spinner = UIActivityIndicatorView(style: .medium)
        spinner.hidesWhenStopped = true

        retryButton = UIButton(type: .system)
        var config = UIButton.Configuration.filled()
        config.title = "Try Again"
        config.cornerStyle = .capsule
        retryButton.configuration = config
        retryButton.addAction(UIAction { [weak self] _ in self?.loadWebApp() }, for: .touchUpInside)
        retryButton.isHidden = true

        let stack = UIStackView(arrangedSubviews: [
            icon,
            title,
            paragraph("Turn on Clear AT’s Safari extension in Settings → Apps → Safari → Extensions.", secondary: false),
            paragraph("Once it’s on, also allow it for All Websites so it can poll your accounts and feeds."),
            spinner,
            retryButton,
        ])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 16
        stack.setCustomSpacing(24, after: icon)
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 32),
            stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -32),
        ])
    }

    private func loadWebApp() {
        if webView == nil {
            let config = WKWebViewConfiguration()
            config.allowsInlineMediaPlayback = true
            webView = WKWebView(frame: view.bounds, configuration: config)
            webView.navigationDelegate = self
            webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            webView.alpha = 0
            view.addSubview(webView)
        }
        retryButton.isHidden = true
        spinner.startAnimating()
        webView.load(URLRequest(url: webAppURL))
    }

    private func webAppFailed() {
        spinner.stopAnimating()
        retryButton.isHidden = false
    }

#elseif os(macOS)

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self
        self.webView.configuration.userContentController.add(self, name: "controller")
        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

#endif

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
#if os(iOS)
        spinner.stopAnimating()
        UIView.animate(withDuration: 0.25) { webView.alpha = 1 }
#elseif os(macOS)
        webView.evaluateJavaScript("show('mac')")

        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { (state, error) in
            guard let state = state, error == nil else {
                // Insert code to inform the user that something went wrong.
                return
            }

            DispatchQueue.main.async {
                if #available(macOS 13, *) {
                    webView.evaluateJavaScript("show('mac', \(state.isEnabled), true)")
                } else {
                    webView.evaluateJavaScript("show('mac', \(state.isEnabled), false)")
                }
            }
        }
#endif
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
#if os(iOS)
        webAppFailed()
#endif
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
#if os(iOS)
        webAppFailed()
#endif
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
#if os(macOS)
        if (message.body as! String != "open-preferences") {
            return
        }

        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
            guard error == nil else {
                // Insert code to inform the user that something went wrong.
                return
            }

            DispatchQueue.main.async {
                NSApp.terminate(self)
            }
        }
#endif
    }

}
