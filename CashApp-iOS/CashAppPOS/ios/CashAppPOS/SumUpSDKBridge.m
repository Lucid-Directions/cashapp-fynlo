//
//  SumUpSDKBridge.m
//  CashAppPOS
//
//  Created by Claude Code on 2025-01-26.
//

#import "SumUpSDKBridge.h"
#import <SumUpSDK/SumUpSDK.h>
#import <React/RCTUtils.h>

@implementation SumUpSDKBridge {
    bool hasListeners;
}

RCT_EXPORT_MODULE();

// To support sending events to JavaScript
- (NSArray<NSString *> *)supportedEvents {
    return @[@"SumUpPaymentCompleted", @"SumUpLoginCompleted", @"SumUpError"];
}

// Will be called when this module's first listener is added.
- (void)startObserving {
    hasListeners = YES;
}

// Will be called when this module's last listener is removed, or on dealloc.
- (void)stopObserving {
    hasListeners = NO;
}

#pragma mark - Setup and Login

RCT_EXPORT_METHOD(setupWithAPIKey:(NSString *)apiKey
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(dispatch_get_main_queue(), ^{
        BOOL success = [SMPSumUpSDK setupWithAPIKey:apiKey];
        if (success) {
            resolve(@{@"success": @YES});
        } else {
            reject(@"SETUP_FAILED", @"Failed to setup SumUp SDK", nil);
        }
    });
}

RCT_EXPORT_METHOD(presentLogin:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(dispatch_get_main_queue(), ^{
        UIViewController *rootViewController = RCTKeyWindow().rootViewController;
        if (!rootViewController) {
            reject(@"NO_ROOT_CONTROLLER", @"No root view controller found", nil);
            return;
        }
        
        [SMPSumUpSDK presentLoginFromViewController:rootViewController
                                           animated:YES
                                    completionBlock:^(BOOL success, NSError * _Nullable error) {
            if (error) {
                reject(@"LOGIN_ERROR", error.localizedDescription, error);
            } else if (success) {
                resolve(@{@"success": @YES, @"isLoggedIn": @([SMPSumUpSDK isLoggedIn])});
            } else {
                // User cancelled
                resolve(@{@"success": @NO, @"cancelled": @YES});
            }
        }];
    });
}

RCT_EXPORT_METHOD(loginWithToken:(NSString *)token
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [SMPSumUpSDK loginWithToken:token completion:^(BOOL success, NSError * _Nullable error) {
        if (error) {
            reject(@"LOGIN_TOKEN_ERROR", error.localizedDescription, error);
        } else {
            resolve(@{@"success": @success, @"isLoggedIn": @([SMPSumUpSDK isLoggedIn])});
        }
    }];
}

RCT_EXPORT_METHOD(logout:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [SMPSumUpSDK logoutWithCompletionBlock:^(BOOL success, NSError * _Nullable error) {
        if (error) {
            reject(@"LOGOUT_ERROR", error.localizedDescription, error);
        } else {
            resolve(@{@"success": @success});
        }
    }];
}

#pragma mark - Payment Processing

RCT_EXPORT_METHOD(checkout:(NSDictionary *)paymentData
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(dispatch_get_main_queue(), ^{
        UIViewController *rootViewController = RCTKeyWindow().rootViewController;
        if (!rootViewController) {
            reject(@"NO_ROOT_CONTROLLER", @"No root view controller found", nil);
            return;
        }
        
        if (![SMPSumUpSDK isLoggedIn]) {
            reject(@"NOT_LOGGED_IN", @"Merchant not logged in", nil);
            return;
        }
        
        // Extract payment data
        NSNumber *total = paymentData[@"total"];
        NSString *currencyCode = paymentData[@"currencyCode"] ?: @"GBP";
        NSString *title = paymentData[@"title"];
        NSString *foreignTransactionId = paymentData[@"foreignTransactionId"];
        
        if (!total) {
            reject(@"INVALID_AMOUNT", @"Payment amount is required", nil);
            return;
        }
        
        // Create checkout request
        SMPCheckoutRequest *request = [SMPCheckoutRequest requestWithTotal:[NSDecimalNumber decimalNumberWithDecimal:total.decimalValue]
                                                                      title:title
                                                               currencyCode:currencyCode
                                                                paymentOptions:SMPPaymentOptionAny];
        
        if (foreignTransactionId) {
            request.foreignTransactionID = foreignTransactionId;
        }
        
        // Prepare for checkout (wakes up card reader if connected)
        [SMPSumUpSDK prepareForCheckout];
        
        [SMPSumUpSDK checkoutWithRequest:request
                      fromViewController:rootViewController
                              completion:^(SMPCheckoutResult * _Nullable result, NSError * _Nullable error) {
            if (error) {
                reject(@"CHECKOUT_ERROR", error.localizedDescription, error);
            } else if (result) {
                NSDictionary *resultDict = @{
                    @"success": @(result.success),
                    @"transactionCode": result.transactionCode ?: @"",
                    @"additionalInfo": result.additionalInfo ?: @{}
                };
                resolve(resultDict);
            } else {
                reject(@"CHECKOUT_ERROR", @"Unknown checkout error", nil);
            }
        }];
    });
}

RCT_EXPORT_METHOD(presentCheckoutPreferences:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(dispatch_get_main_queue(), ^{
        UIViewController *rootViewController = RCTKeyWindow().rootViewController;
        if (!rootViewController) {
            reject(@"NO_ROOT_CONTROLLER", @"No root view controller found", nil);
            return;
        }
        
        [SMPSumUpSDK presentCheckoutPreferencesFromViewController:rootViewController
                                                         animated:YES
                                                       completion:^(BOOL success, NSError * _Nullable error) {
            if (error) {
                reject(@"PREFERENCES_ERROR", error.localizedDescription, error);
            } else {
                resolve(@{@"success": @success});
            }
        }];
    });
}

#pragma mark - Status and Information

RCT_EXPORT_METHOD(isLoggedIn:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    resolve(@([SMPSumUpSDK isLoggedIn]));
}

RCT_EXPORT_METHOD(getCurrentMerchant:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    SMPMerchant *merchant = [SMPSumUpSDK currentMerchant];
    if (merchant) {
        NSDictionary *merchantInfo = @{
            @"merchantCode": merchant.merchantCode ?: @"",
            @"currency": merchant.currencyCode ?: @""
        };
        resolve(merchantInfo);
    } else {
        resolve([NSNull null]);
    }
}

RCT_EXPORT_METHOD(checkoutInProgress:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    resolve(@([SMPSumUpSDK checkoutInProgress]));
}

RCT_EXPORT_METHOD(isTipOnCardReaderAvailable:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    resolve(@([SMPSumUpSDK isTipOnCardReaderAvailable]));
}

RCT_EXPORT_METHOD(getSDKVersion:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    resolve(@{
        @"version": [SMPSumUpSDK bundleVersionShortString],
        @"build": [SMPSumUpSDK bundleVersion]
    });
}

RCT_EXPORT_METHOD(testSDKIntegration:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    BOOL integrationOk = [SMPSumUpSDK testSDKIntegration];
    resolve(@(integrationOk));
}

@end