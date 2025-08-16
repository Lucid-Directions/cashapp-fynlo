import UIKit
import Foundation
import SumUpSDK

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  private var sumUpInitialized = false

  func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    // Comprehensive fix for SocketRocket priority inversion warnings
    configureThreadQoSToPreventPriorityInversion()
    
    // Suppress category conflicts at runtime
    suppressCategoryConflicts()
    
    // Initialize SumUp SDK early for tap to pay readiness
    initializeSumUpSDKEarly()
    
    let jsCodeLocation: URL

    #if DEBUG
      // Use Metro bundler in development for hot reloading
      // Fallback to bundled JS if Metro server is not running
      if let metroURL = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index", fallbackExtension: nil) {
        jsCodeLocation = metroURL
        print("🔧 Using Metro bundler for development")
      } else if let bundledURL = Bundle.main.url(forResource: "main", withExtension: "jsbundle") {
        jsCodeLocation = bundledURL
        print("⚠️ Metro server not running, using bundled JavaScript in DEBUG mode")
      } else {
        fatalError("❌ Neither Metro server nor bundled JavaScript file available")
      }
    #else
      // Use bundled JS in release builds
      guard let bundledURL = Bundle.main.url(forResource: "main", withExtension: "jsbundle") else {
        fatalError("❌ Bundled JavaScript file not found in release build")
      }
      jsCodeLocation = bundledURL
      print("📦 Using bundled JavaScript for release")
    #endif

    print("JS Code Location: \(jsCodeLocation)")

    let rootView = RCTRootView(
      bundleURL: jsCodeLocation,
      moduleName: "CashAppPOS",
      initialProperties: nil,
      launchOptions: launchOptions
    )

    if rootView.loadingView == nil {
      print("RCTRootView created successfully")
    } else {
      print("RCTRootView is still loading")
    }

    rootView.backgroundColor = UIColor.white

    self.window = UIWindow(frame: UIScreen.main.bounds)
    let rootViewController = UIViewController()
    rootViewController.view = rootView
    
    guard let window = self.window else {
      fatalError("Window could not be initialized")
    }
    
    window.rootViewController = rootViewController
    window.makeKeyAndVisible()

    print("App window initialized and made visible")

    return true
  }

  // MARK: - Linking API

  func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
    return RCTLinkingManager.application(app, open: url, options: options)
  }

  // MARK: - Universal Links

  func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
    return RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
  }
  
  // MARK: - SocketRocket Priority Inversion Fixes
  
  private func configureThreadQoSToPreventPriorityInversion() {
    // Set main thread QoS
    DispatchQueue.main.async {
      Thread.current.qualityOfService = .userInteractive
    }
    
    // Configure all dispatch queues to prevent priority inversion
    let qosClasses: [DispatchQoS.QoSClass] = [.userInteractive, .userInitiated, .default, .utility]
    for qosClass in qosClasses {
      DispatchQueue.global(qos: qosClass).async {
        Thread.current.qualityOfService = .userInteractive
      }
    }
    
    // Pre-warm SocketRocket network thread with correct QoS
    DispatchQueue.global(qos: .userInitiated).async {
      Thread.current.name = "com.facebook.SocketRocket.NetworkThread"
      Thread.current.qualityOfService = .userInitiated
      
      // Force SocketRocket thread creation with proper QoS
      if let socketRocketClass = NSClassFromString("SRRunLoopThread") as? NSObject.Type {
        let sharedThreadSelector = NSSelectorFromString("sharedThread")
        if socketRocketClass.responds(to: sharedThreadSelector) {
          _ = socketRocketClass.perform(sharedThreadSelector)
        }
      }
    }
  }
  
  private func suppressCategoryConflicts() {
    // Suppress duplicate method warnings for React Native categories
    // This prevents the UIStatusBarAnimation category conflict
    // The warning is cosmetic and doesn't affect functionality
    
    // Set environment variable to suppress category warnings
    setenv("OBJC_DISABLE_DUPLICATE_CATEGORY_WARNING", "YES", 1)
  }
  
  // MARK: - SumUp SDK Initialization
  
  private func initializeSumUpSDKEarly() {
    // Initialize SumUp SDK early in app lifecycle to ensure tap to pay is ready
    // This prevents "Payment session not ready" errors
    print("[TAP_TO_PAY] Starting early SDK initialization in AppDelegate")
    
    // Get API key from Info.plist or environment
    if let apiKey = getSumUpAPIKey() {
      DispatchQueue.main.async { [weak self] in
        SMPSumUpSDK.setup(withAPIKey: apiKey)
        self?.sumUpInitialized = true
        print("[TAP_TO_PAY] ✅ SumUp SDK initialized early with API key")
        
        // Pre-check tap to pay availability to warm up the system
        self?.preCheckTapToPayAvailability()
      }
    } else {
      print("[TAP_TO_PAY] ⚠️ No SumUp API key found at app launch - will initialize later")
    }
  }
  
  private func getSumUpAPIKey() -> String? {
    // Try to get API key from multiple sources
    // 1. Info.plist (for production)
    if let apiKey = Bundle.main.object(forInfoDictionaryKey: "SUMUP_API_KEY") as? String,
       !apiKey.isEmpty {
      print("[TAP_TO_PAY] Using API key from Info.plist")
      return apiKey
    }
    
    // 2. User defaults (if saved from backend config)
    if let apiKey = UserDefaults.standard.string(forKey: "sumup_api_key"),
       !apiKey.isEmpty {
      print("[TAP_TO_PAY] Using API key from UserDefaults")
      return apiKey
    }
    
    // 3. Environment variable (for development)
    if let apiKey = ProcessInfo.processInfo.environment["SUMUP_API_KEY"],
       !apiKey.isEmpty {
      print("[TAP_TO_PAY] Using API key from environment")
      return apiKey
    }
    
    return nil
  }
  
  private func preCheckTapToPayAvailability() {
    // Pre-check tap to pay to warm up the system
    // This helps prevent initialization delays during first payment
    SMPSumUpSDK.checkTapToPayAvailability { isAvailable, isActivated, error in
      if let error = error {
        print("[TAP_TO_PAY] Pre-check error: \(error.localizedDescription)")
      } else {
        print("[TAP_TO_PAY] Pre-check complete - Available: \(isAvailable), Activated: \(isActivated)")
      }
    }
  }
  
  // Public method for JS to check if SDK was initialized early
  @objc
  static func isSumUpInitialized() -> Bool {
    if let appDelegate = UIApplication.shared.delegate as? AppDelegate {
      return appDelegate.sumUpInitialized
    }
    return false
  }
}
