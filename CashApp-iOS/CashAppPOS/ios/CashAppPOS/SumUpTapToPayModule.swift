import Foundation
import React
import SumUpSDK

@objc(SumUpTapToPayModule)
class SumUpTapToPayModule: NSObject, RCTBridgeModule {
    
    static func moduleName() -> String! {
        return "SumUpTapToPayModule"
    }
    
    @objc
    static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    // MARK: - SDK Setup
    
    @objc
    func setupSDK(_ apiKey: String,
                  resolver: @escaping RCTPromiseResolveBlock,
                  rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            SMPSumUpSDK.setup(withAPIKey: apiKey)
            // Save API key to UserDefaults for early initialization
            UserDefaults.standard.set(apiKey, forKey: "sumup_api_key")
            resolver(["success": true])
        }
    }
    
    // MARK: - Authentication
    
    @objc
    func presentLogin(_ resolver: @escaping RCTPromiseResolveBlock,
                      rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let rootViewController = self.getRootViewController() else {
                rejecter("ERROR", "Could not find root view controller", nil)
                return
            }
            
            SMPSumUpSDK.presentLogin(from: rootViewController, animated: true) { success, error in
                if let error = error {
                    rejecter("LOGIN_ERROR", error.localizedDescription, error)
                } else {
                    resolver(["success": success])
                }
            }
        }
    }
    
    @objc
    func loginWithToken(_ token: String,
                        resolver: @escaping RCTPromiseResolveBlock,
                        rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            SMPSumUpSDK.login(withToken: token) { success, error in
                if let error = error {
                    rejecter("TOKEN_LOGIN_ERROR", error.localizedDescription, error)
                } else {
                    resolver(["success": success])
                }
            }
        }
    }
    
    @objc
    func logout(_ resolver: @escaping RCTPromiseResolveBlock,
                rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            SMPSumUpSDK.logout { success, error in
                if let error = error {
                    rejecter("LOGOUT_ERROR", error.localizedDescription, error)
                } else {
                    resolver(["success": success])
                }
            }
        }
    }
    
    // MARK: - Tap to Pay on iPhone
    
    @objc
    func checkTapToPayAvailability(_ resolver: @escaping RCTPromiseResolveBlock,
                                   rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            SMPSumUpSDK.checkTapToPayAvailability { isAvailable, isActivated, error in
                if let error = error {
                    rejecter("TAP_TO_PAY_CHECK_ERROR", error.localizedDescription, error)
                } else {
                    resolver([
                        "isAvailable": isAvailable,
                        "isActivated": isActivated
                    ])
                }
            }
        }
    }
    
    @objc
    func presentTapToPayActivation(_ resolver: @escaping RCTPromiseResolveBlock,
                                   rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let rootViewController = self.getRootViewController() else {
                rejecter("ERROR", "Could not find root view controller", nil)
                return
            }
            
            SMPSumUpSDK.presentTapToPayActivation(from: rootViewController, animated: true) { success, error in
                if let error = error {
                    rejecter("TAP_TO_PAY_ACTIVATION_ERROR", error.localizedDescription, error)
                } else {
                    resolver(["success": success])
                }
            }
        }
    }
    
    // MARK: - Payment Processing
    
    @objc
    func checkout(_ amount: NSNumber,
                  title: String,
                  currencyCode: String,
                  foreignTransactionID: String?,
                  useTapToPay: Bool,
                  resolver: @escaping RCTPromiseResolveBlock,
                  rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let rootViewController = self.getRootViewController() else {
                rejecter("ERROR", "Could not find root view controller", nil)
                return
            }
            
            let total = NSDecimalNumber(decimal: amount.decimalValue)
            
            let request: SMPCheckoutRequest
            if useTapToPay {
                request = SMPCheckoutRequest(total: total,
                                           title: title,
                                           currencyCode: currencyCode,
                                           paymentMethod: .tapToPay)
            } else {
                request = SMPCheckoutRequest(total: total,
                                           title: title,
                                           currencyCode: currencyCode)
            }
            
            if let foreignTransactionID = foreignTransactionID {
                request.foreignTransactionID = foreignTransactionID
            }
            
            SMPSumUpSDK.checkout(with: request, from: rootViewController) { result, error in
                if let error = error {
                    let errorInfo = [
                        "code": error.code,
                        "message": error.localizedDescription,
                        "domain": error.domain
                    ] as [String : Any]
                    rejecter("CHECKOUT_ERROR", error.localizedDescription, NSError(domain: error.domain, code: error.code, userInfo: errorInfo))
                } else if let result = result {
                    let resultInfo = [
                        "success": result.success,
                        "transactionCode": result.transactionCode ?? "",
                        "additionalInfo": result.additionalInfo ?? [:]
                    ] as [String : Any]
                    resolver(resultInfo)
                } else {
                    rejecter("CHECKOUT_ERROR", "Unknown checkout error", nil)
                }
            }
        }
    }
    
    @objc
    func presentCheckoutPreferences(_ resolver: @escaping RCTPromiseResolveBlock,
                                    rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let rootViewController = self.getRootViewController() else {
                rejecter("ERROR", "Could not find root view controller", nil)
                return
            }
            
            SMPSumUpSDK.presentCheckoutPreferences(from: rootViewController, animated: true) { success, error in
                if let error = error {
                    rejecter("PREFERENCES_ERROR", error.localizedDescription, error)
                } else {
                    resolver(["success": success])
                }
            }
        }
    }
    
    // MARK: - Merchant Info
    
    @objc
    func getCurrentMerchant(_ resolver: @escaping RCTPromiseResolveBlock,
                            rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            if let merchant = SMPSumUpSDK.currentMerchant {
                let merchantInfo = [
                    "currencyCode": merchant.currencyCode ?? "",
                    "merchantCode": merchant.merchantCode ?? "",
                    "companyName": merchant.companyName ?? ""
                ]
                resolver(merchantInfo)
            } else {
                rejecter("NO_MERCHANT", "No merchant logged in", nil)
            }
        }
    }
    
    @objc
    func isLoggedIn(_ resolver: @escaping RCTPromiseResolveBlock,
                    rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            resolver(["isLoggedIn": SMPSumUpSDK.isLoggedIn])
        }
    }
    
    // MARK: - Helper Methods
    
    private func getRootViewController() -> UIViewController? {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = windowScene.windows.first else {
            return nil
        }
        return window.rootViewController
    }
}