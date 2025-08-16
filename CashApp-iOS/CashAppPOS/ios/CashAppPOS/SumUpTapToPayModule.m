#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SumUpTapToPayModule, NSObject)

// SDK Setup
RCT_EXTERN_METHOD(setupSDK:(NSString *)apiKey
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Authentication
RCT_EXTERN_METHOD(presentLogin:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(loginWithToken:(NSString *)token
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(logout:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Tap to Pay on iPhone
RCT_EXTERN_METHOD(checkTapToPayAvailability:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(presentTapToPayActivation:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Payment Processing
RCT_EXTERN_METHOD(checkout:(NSNumber *)amount
                  title:(NSString *)title
                  currencyCode:(NSString *)currencyCode
                  foreignTransactionID:(NSString *)foreignTransactionID
                  useTapToPay:(BOOL)useTapToPay
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(presentCheckoutPreferences:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Merchant Info
RCT_EXTERN_METHOD(getCurrentMerchant:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isLoggedIn:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isSDKInitialized:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

@end