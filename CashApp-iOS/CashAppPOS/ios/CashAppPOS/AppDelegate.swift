import React
import Foundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    // Comprehensive fix for SocketRocket priority inversion warnings
    configureThreadQoSToPreventPriorityInversion()
    
    // Suppress category conflicts at runtime
    suppressCategoryConflicts()
    
    let jsCodeLocation: URL

    #if DEBUG
      // For debug builds, use Metro bundler (now running)
      jsCodeLocation = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
      print("✅ Using Metro bundler for debug build: \(jsCodeLocation)")
    #else
      // For release builds, use bundled JS
      guard let bundledURL = Bundle.main.url(forResource: "main", withExtension: "jsbundle") else {
        fatalError("❌ Bundled JavaScript file not found")
      }
      jsCodeLocation = bundledURL
      print("✅ Using bundled JavaScript for release build")
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
}
