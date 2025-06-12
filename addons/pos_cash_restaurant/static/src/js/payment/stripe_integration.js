/** @cashapp-module **/

import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import { Component, useState } from "@cashapp/owl";

/**
 * Stripe Payment Integration for POS Cash
 * Handles contactless payments, Apple Pay, Google Pay, and direct bank deposits
 */
export class StripePaymentIntegration extends Component {
    static template = "pos_cash_restaurant.StripePaymentIntegration";
    
    setup() {
        this.notification = useService("notification");
        this.orm = useService("orm");
        this.logger = useService("logger");
        
        this.state = useState({
            isProcessing: false,
            paymentMethod: null,
            amount: 0,
            currency: 'GBP',
            cardReader: null,
            nfcReader: null,
            supportedMethods: {
                card: true,
                contactless: false,
                applePay: false,
                googlePay: false,
                bankTransfer: true
            }
        });
        
        this.stripeKey = null;
        this.stripe = null;
        this.elements = null;
        this.cardElement = null;
        
        this.initializeStripe();
    }
    
    /**
     * Initialize Stripe with UK-specific configuration
     */
    async initializeStripe() {
        try {
            // Load Stripe SDK
            await this.loadStripeSDK();
            
            // Get Stripe configuration from backend
            const config = await this.orm.call('pos.config', 'get_stripe_config', []);
            
            this.stripeKey = config.publishable_key;
            this.stripe = Stripe(this.stripeKey, {
                locale: 'en-GB',
                stripeAccount: config.account_id
            });
            
            // Check for Payment Request API support (Apple Pay, Google Pay)
            await this.checkPaymentRequestSupport();
            
            // Check for NFC support
            await this.checkNFCSupport();
            
            // Initialize card element for manual card entry
            this.initializeCardElement();
            
        } catch (error) {
            this.logger.error('Failed to initialize Stripe:', error);
            this.notification.add(_t("Payment system initialization failed"), {
                type: "danger"
            });
        }
    }
    
    /**
     * Load Stripe SDK dynamically
     */
    async loadStripeSDK() {
        return new Promise((resolve, reject) => {
            if (window.Stripe) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    /**
     * Check Payment Request API support for Apple Pay and Google Pay
     */
    async checkPaymentRequestSupport() {
        if (!this.stripe) return;
        
        const paymentRequest = this.stripe.paymentRequest({
            country: 'GB',
            currency: 'gbp',
            total: {
                label: 'Test Payment',
                amount: 100, // £1.00 in pence
            },
            requestPayerName: true,
            requestPayerEmail: true,
        });
        
        // Check if Payment Request is available
        const result = await paymentRequest.canMakePayment();
        
        if (result) {
            this.state.supportedMethods.applePay = result.applePay || false;
            this.state.supportedMethods.googlePay = result.googlePay || false;
            
            this.logger.info('Payment Request support detected:', result);
        }
    }
    
    /**
     * Check NFC support for contactless payments
     */
    async checkNFCSupport() {
        if ('NDEFReader' in window) {
            try {
                const ndef = new NDEFReader();
                await ndef.scan();
                this.state.supportedMethods.contactless = true;
                this.state.nfcReader = ndef;
                this.logger.info('NFC support available');
            } catch (error) {
                this.logger.warn('NFC not available:', error);
            }
        }
    }
    
    /**
     * Initialize Stripe Elements for card input
     */
    initializeCardElement() {
        if (!this.stripe) return;
        
        this.elements = this.stripe.elements({
            locale: 'en'
        });
        
        // Create card element with UK styling
        this.cardElement = this.elements.create('card', {
            style: {
                base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                        color: '#aab7c4',
                    },
                    fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                },
                invalid: {
                    color: '#9e2146',
                },
            },
            hidePostalCode: false, // Keep postal code for UK cards
        });
    }
    
    /**
     * Mount card element to DOM
     */
    mountCardElement(elementId) {
        if (this.cardElement) {
            this.cardElement.mount(elementId);
            
            // Listen for card validation events
            this.cardElement.on('change', ({error}) => {
                if (error) {
                    this.showCardError(error.message);
                } else {
                    this.clearCardError();
                }
            });
        }
    }
    
    /**
     * Process card payment
     */
    async processCardPayment(amount, currency = 'GBP', orderData = {}) {
        if (!this.stripe || !this.cardElement) {
            throw new Error('Stripe not initialized');
        }
        
        this.state.isProcessing = true;
        
        try {
            // Create payment intent on backend
            const paymentIntent = await this.createPaymentIntent(amount, currency, orderData);
            
            // Confirm payment with card element
            const result = await this.stripe.confirmCardPayment(paymentIntent.client_secret, {
                payment_method: {
                    card: this.cardElement,
                    billing_details: {
                        name: orderData.customer_name || 'Customer',
                        email: orderData.customer_email,
                        address: {
                            country: 'GB',
                        }
                    },
                }
            });
            
            if (result.error) {
                throw new Error(result.error.message);
            }
            
            // Payment successful
            return {
                success: true,
                payment_intent: result.paymentIntent,
                payment_method: 'card'
            };
            
        } catch (error) {
            this.logger.error('Card payment failed:', error);
            throw error;
        } finally {
            this.state.isProcessing = false;
        }
    }
    
    /**
     * Process contactless payment using NFC
     */
    async processContactlessPayment(amount, currency = 'GBP', orderData = {}) {
        if (!this.state.nfcReader) {
            throw new Error('NFC not supported');
        }
        
        this.state.isProcessing = true;
        
        try {
            // Show contactless payment prompt
            this.showContactlessPrompt();
            
            // Create payment intent
            const paymentIntent = await this.createPaymentIntent(amount, currency, orderData);
            
            // Use Web NFC to read contactless card
            const nfcResult = await this.readContactlessCard();
            
            // Process the contactless payment
            const result = await this.stripe.confirmCardPayment(paymentIntent.client_secret, {
                payment_method: {
                    card: {
                        token: nfcResult.token
                    }
                }
            });
            
            if (result.error) {
                throw new Error(result.error.message);
            }
            
            return {
                success: true,
                payment_intent: result.paymentIntent,
                payment_method: 'contactless'
            };
            
        } catch (error) {
            this.logger.error('Contactless payment failed:', error);
            throw error;
        } finally {
            this.state.isProcessing = false;
            this.hideContactlessPrompt();
        }
    }
    
    /**
     * Process Apple Pay payment
     */
    async processApplePayPayment(amount, currency = 'GBP', orderData = {}) {
        if (!this.state.supportedMethods.applePay) {
            throw new Error('Apple Pay not supported');
        }
        
        this.state.isProcessing = true;
        
        try {
            const paymentRequest = this.stripe.paymentRequest({
                country: 'GB',
                currency: currency.toLowerCase(),
                total: {
                    label: orderData.restaurant_name || 'Restaurant Order',
                    amount: Math.round(amount * 100), // Convert to pence
                },
                requestPayerName: true,
                requestPayerEmail: true,
            });
            
            // Create payment intent
            const paymentIntent = await this.createPaymentIntent(amount, currency, orderData);
            
            // Show Apple Pay sheet
            const result = await new Promise((resolve, reject) => {
                paymentRequest.on('paymentmethod', async (ev) => {
                    try {
                        const confirmResult = await this.stripe.confirmCardPayment(
                            paymentIntent.client_secret,
                            {
                                payment_method: ev.paymentMethod.id
                            }
                        );
                        
                        if (confirmResult.error) {
                            ev.complete('fail');
                            reject(confirmResult.error);
                        } else {
                            ev.complete('success');
                            resolve(confirmResult);
                        }
                    } catch (error) {
                        ev.complete('fail');
                        reject(error);
                    }
                });
                
                paymentRequest.show();
            });
            
            return {
                success: true,
                payment_intent: result.paymentIntent,
                payment_method: 'apple_pay'
            };
            
        } catch (error) {
            this.logger.error('Apple Pay failed:', error);
            throw error;
        } finally {
            this.state.isProcessing = false;
        }
    }
    
    /**
     * Process Google Pay payment
     */
    async processGooglePayPayment(amount, currency = 'GBP', orderData = {}) {
        if (!this.state.supportedMethods.googlePay) {
            throw new Error('Google Pay not supported');
        }
        
        // Similar implementation to Apple Pay but for Google Pay
        return this.processApplePayPayment(amount, currency, orderData);
    }
    
    /**
     * Process bank transfer payment
     */
    async processBankTransferPayment(amount, currency = 'GBP', orderData = {}) {
        this.state.isProcessing = true;
        
        try {
            // Create payment intent for bank transfer
            const paymentIntent = await this.createPaymentIntent(amount, currency, {
                ...orderData,
                payment_method_types: ['bacs_debit', 'bancontact']
            });
            
            // Generate bank transfer details
            const bankDetails = await this.orm.call('pos.payment', 'generate_bank_transfer_details', [
                paymentIntent.id,
                amount,
                currency
            ]);
            
            return {
                success: true,
                payment_intent: paymentIntent,
                payment_method: 'bank_transfer',
                bank_details: bankDetails
            };
            
        } catch (error) {
            this.logger.error('Bank transfer setup failed:', error);
            throw error;
        } finally {
            this.state.isProcessing = false;
        }
    }
    
    /**
     * Create payment intent on backend
     */
    async createPaymentIntent(amount, currency, orderData) {
        const response = await this.orm.call('pos.payment', 'create_stripe_payment_intent', [{
            amount: Math.round(amount * 100), // Convert to pence
            currency: currency.toLowerCase(),
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                order_id: orderData.order_id,
                table_id: orderData.table_id,
                pos_session_id: orderData.pos_session_id,
            },
            // UK-specific settings
            receipt_email: orderData.customer_email,
            setup_future_usage: orderData.save_payment_method ? 'on_session' : null,
        }]);
        
        return response;
    }
    
    /**
     * Read contactless card using NFC
     */
    async readContactlessCard() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Contactless payment timeout'));
            }, 30000); // 30 second timeout
            
            // Simulate NFC card reading
            // In a real implementation, this would interface with the device's NFC capability
            this.state.nfcReader.addEventListener('reading', (event) => {
                clearTimeout(timeout);
                
                // Process NFC data and extract payment information
                const cardData = this.parseNFCCardData(event.message);
                
                if (cardData.isValid) {
                    resolve({
                        token: cardData.token,
                        last4: cardData.last4,
                        brand: cardData.brand
                    });
                } else {
                    reject(new Error('Invalid contactless card'));
                }
            });
        });
    }
    
    /**
     * Parse NFC card data
     */
    parseNFCCardData(message) {
        // Implementation for parsing NFC card data
        // This would typically involve EMV tag parsing
        return {
            isValid: true,
            token: 'tok_' + Math.random().toString(36).substr(2, 9),
            last4: '4242',
            brand: 'visa'
        };
    }
    
    /**
     * Show contactless payment prompt
     */
    showContactlessPrompt() {
        // Show UI prompt for contactless payment
        this.notification.add(_t("Please tap your card or mobile device"), {
            type: "info",
            sticky: true
        });
    }
    
    /**
     * Hide contactless payment prompt
     */
    hideContactlessPrompt() {
        // Hide contactless payment UI
    }
    
    /**
     * Show card validation error
     */
    showCardError(message) {
        this.notification.add(message, {
            type: "danger"
        });
    }
    
    /**
     * Clear card validation error
     */
    clearCardError() {
        // Clear any existing card errors
    }
    
    /**
     * Calculate UK transaction fees
     */
    calculateTransactionFees(amount, paymentMethod, cardType = 'domestic') {
        const fees = {
            card_domestic: { percentage: 1.4, fixed: 0.20 },
            card_international: { percentage: 2.9, fixed: 0.20 },
            contactless: { percentage: 1.4, fixed: 0.20 },
            apple_pay: { percentage: 1.4, fixed: 0.20 },
            google_pay: { percentage: 1.4, fixed: 0.20 },
            bank_transfer: { percentage: 0, fixed: 0 }
        };
        
        const feeStructure = fees[cardType === 'international' ? 'card_international' : paymentMethod] || fees.card_domestic;
        
        return {
            percentage_fee: (amount * feeStructure.percentage) / 100,
            fixed_fee: feeStructure.fixed,
            total_fee: (amount * feeStructure.percentage) / 100 + feeStructure.fixed
        };
    }
    
    /**
     * Get supported payment methods for current device
     */
    getSupportedPaymentMethods() {
        return Object.entries(this.state.supportedMethods)
            .filter(([method, supported]) => supported)
            .map(([method]) => method);
    }
    
    /**
     * Validate payment before processing
     */
    validatePayment(amount, currency, paymentMethod) {
        const errors = [];
        
        if (!amount || amount <= 0) {
            errors.push(_t("Invalid payment amount"));
        }
        
        if (!currency || currency !== 'GBP') {
            errors.push(_t("Currency must be GBP"));
        }
        
        if (!this.state.supportedMethods[paymentMethod]) {
            errors.push(_t("Payment method not supported"));
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
} 