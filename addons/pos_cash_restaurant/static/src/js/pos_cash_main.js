/** @cashapp-module **/

import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import { Component, onMounted, onWillUnmount, useState } from "@cashapp/owl";
import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { ReceiptScreen } from "@point_of_sale/app/screens/receipt_screen/receipt_screen";
import { FloorScreen } from "@pos_restaurant/app/floor_screen/floor_screen";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { useRouter } from "@web/core/router/hooks";

/**
 * POS Cash Main Component - Mobile-First Restaurant POS System
 * Extends CashApp POS with mobile-optimized UI and UK-specific features
 */
export class PosCashMain extends Component {
    static template = "pos_cash_restaurant.PosCashMain";
    
    setup() {
        this.pos = usePos();
        this.ui = useService("ui");
        this.notification = useService("notification");
        this.orm = useService("orm");
        this.http = useService("http");
        this.router = useRouter();
        this.dialog = useService("dialog");
        this.logger = useService("logger");
        
        this.state = useState({
            isMobile: this.detectMobileDevice(),
            currentScreen: "product",
            selectedTable: null,
            currentOrder: null,
            paymentInProgress: false,
            nfcAvailable: false,
            connectionStatus: "online",
            notifications: [],
            wakeLockSupported: 'wakeLock' in navigator,
            wakeLock: null,
            serviceWorkerReady: false,
        });
        
        onMounted(() => {
            this.initializeMobileFeatures();
            this.setupEventListeners();
            this.checkNFCAvailability();
            this.startConnectionMonitoring();
        });
        
        onWillUnmount(() => {
            this.cleanupEventListeners();
            
            if (this.state.wakeLock) {
                this.state.wakeLock.release();
            }
            
            window.removeEventListener('online', this.onOnline);
            window.removeEventListener('offline', this.onOffline);
        });
    }
    
    /**
     * Detect if the device is mobile
     */
    detectMobileDevice() {
        const userAgentCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const screenSizeCheck = window.screen.width <= 768 || window.screen.height <= 768;
        const touchCheck = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        return userAgentCheck || (screenSizeCheck && touchCheck);
    }
    
    /**
     * Initialize mobile-specific features
     */
    initializeMobileFeatures() {
        // Enable wake lock to prevent screen from sleeping during use
        if ('wakeLock' in navigator) {
            this.acquireWakeLock();
        }
        
        // Setup viewport for mobile devices
        if (this.state.isMobile) {
            this.setupMobileViewport();
        }
        
        // Initialize device orientation handling
        this.handleOrientationChange();
        
        // Setup touch gestures
        this.setupTouchGestures();
        
        // Initialize offline mode capabilities
        this.initializeOfflineMode();
    }
    
    /**
     * Setup mobile viewport meta tag
     */
    setupMobileViewport() {
        let viewport = document.querySelector("meta[name=viewport]");
        if (!viewport) {
            viewport = document.createElement("meta");
            viewport.name = "viewport";
            document.head.appendChild(viewport);
        }
        viewport.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";
        
        // Add mobile-specific CSS class
        document.body.classList.add("pos-cash-mobile");
    }
    
    /**
     * Handle device orientation changes
     */
    handleOrientationChange() {
        const handleOrientation = () => {
            // Force landscape mode for better UX on phones
            if (this.state.isMobile && window.screen.orientation) {
                if (window.screen.orientation.angle === 0 || window.screen.orientation.angle === 180) {
                    this.notification.add(_t("For the best experience, please rotate your device to landscape mode."), {
                        type: "info",
                        sticky: false,
                    });
                }
            }
        };
        
        if (window.screen && window.screen.orientation) {
            window.screen.orientation.addEventListener('change', handleOrientation);
        }
        
        window.addEventListener('orientationchange', handleOrientation);
    }
    
    /**
     * Setup touch gestures for mobile interaction
     */
    setupTouchGestures() {
        if (!this.state.isMobile) return;
        
        let startX, startY, endX, endY;
        
        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            endX = e.changedTouches[0].clientX;
            endY = e.changedTouches[0].clientY;
            
            this.handleSwipeGesture(startX, startY, endX, endY);
        }, { passive: true });
    }
    
    /**
     * Handle swipe gestures
     */
    handleSwipeGesture(startX, startY, endX, endY) {
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const minSwipeDistance = 50;
        
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
            if (deltaX > 0) {
                // Swipe right - go back or show menu
                this.onSwipeRight();
            } else {
                // Swipe left - next screen or show order summary
                this.onSwipeLeft();
            }
        }
    }
    
    /**
     * Check NFC availability for contactless payments
     */
    async checkNFCAvailability() {
        if ('NDEFReader' in window) {
            try {
                const ndef = new NDEFReader();
                await ndef.scan();
                this.state.nfcAvailable = true;
                this.logger.info("NFC is available for contactless payments");
            } catch (error) {
                this.logger.warn("NFC not available", error);
                this.state.nfcAvailable = false;
            }
        } else {
            this.logger.info("Web NFC not supported");
            this.state.nfcAvailable = false;
        }
    }
    
    /**
     * Initialize offline mode capabilities
     */
    initializeOfflineMode() {
        // Register service worker for offline functionality
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/pos_cash_restaurant/static/src/js/service-worker.js')
                .then((registration) => {
                    this.state.serviceWorkerReady = true;
                    this.logger.info('Service Worker registered successfully', registration);
                })
                .catch((error) => {
                    this.logger.error('Service Worker registration failed', error);
                });
        }
        
        // Setup offline/online event listeners
        window.addEventListener('online', this.onOnline.bind(this));
        window.addEventListener('offline', this.onOffline.bind(this));
    }
    
    /**
     * Monitor connection status
     */
    startConnectionMonitoring() {
        setInterval(() => {
            const wasOnline = this.state.connectionStatus === 'online';
            const isOnline = navigator.onLine;
            
            if (wasOnline !== isOnline) {
                this.state.connectionStatus = isOnline ? 'online' : 'offline';
            }
        }, 5000);
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Screen navigation events
        this.env.services.bus.addEventListener('switch-screen', this.onScreenSwitch.bind(this));
        
        // Order events
        this.env.services.bus.addEventListener('order-created', this.onOrderCreated.bind(this));
        this.env.services.bus.addEventListener('order-updated', this.onOrderUpdated.bind(this));
        
        // Payment events
        this.env.services.bus.addEventListener('payment-started', this.onPaymentStarted.bind(this));
        this.env.services.bus.addEventListener('payment-completed', this.onPaymentCompleted.bind(this));
        
        // Table events (restaurant mode)
        this.env.services.bus.addEventListener('table-selected', this.onTableSelected.bind(this));
        
        // Kitchen events
        this.env.services.bus.addEventListener('kitchen-order-updated', this.onKitchenOrderUpdated.bind(this));
    }
    
    /**
     * Cleanup event listeners
     */
    cleanupEventListeners() {
        // Remove all event listeners to prevent memory leaks
        this.env.services.bus.removeEventListener('switch-screen', this.onScreenSwitch);
        this.env.services.bus.removeEventListener('order-created', this.onOrderCreated);
        this.env.services.bus.removeEventListener('order-updated', this.onOrderUpdated);
        this.env.services.bus.removeEventListener('payment-started', this.onPaymentStarted);
        this.env.services.bus.removeEventListener('payment-completed', this.onPaymentCompleted);
        this.env.services.bus.removeEventListener('table-selected', this.onTableSelected);
        this.env.services.bus.removeEventListener('kitchen-order-updated', this.onKitchenOrderUpdated);
    }
    
    /**
     * Acquire wake lock to keep screen active
     */
    async acquireWakeLock() {
        if (this.state.wakeLockSupported) {
            try {
                this.state.wakeLock = await navigator.wakeLock.request('screen');
                this.logger.info('Wake lock acquired successfully');
                
                this.state.wakeLock.addEventListener('release', () => {
                    this.logger.info('Wake lock was released');
                });
            } catch (err) {
                this.logger.warn('Wake lock failed', err);
            }
        }
    }
    
    /**
     * Handle screen switching
     */
    onScreenSwitch(event) {
        this.state.currentScreen = event.detail.screen;
        
        // Update URL for navigation
        this.router.pushState({
            screen: this.state.currentScreen,
            table: this.state.selectedTable?.id
        });
        
        // Provide haptic feedback on screen switch (if available)
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }
    
    /**
     * Handle order creation
     */
    onOrderCreated(event) {
        this.state.currentOrder = event.detail.order;
        this.addNotification(_t("New order created"), "success");
    }
    
    /**
     * Handle order updates
     */
    onOrderUpdated(event) {
        this.state.currentOrder = event.detail.order;
        
        // Auto-save order locally for offline capability
        this.saveOrderLocally(event.detail.order);
    }
    
    /**
     * Handle payment started
     */
    onPaymentStarted(event) {
        this.state.paymentInProgress = true;
        
        // Show payment processing UI
        this.showPaymentProcessing();
    }
    
    /**
     * Handle payment completed
     */
    onPaymentCompleted(event) {
        this.state.paymentInProgress = false;
        
        const success = event.detail.success;
        if (success) {
            this.addNotification(_t("Payment successful!"), "success");
            
            // Provide success haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
            }
            
            // Auto-print receipt if configured
            this.handleReceiptPrinting(event.detail.order);
        } else {
            this.addNotification(_t("Payment failed. Please try again."), "danger");
            
            // Provide error haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
            }
        }
    }
    
    /**
     * Handle table selection (restaurant mode)
     */
    onTableSelected(event) {
        this.state.selectedTable = event.detail.table;
        this.state.currentScreen = "product";
    }
    
    /**
     * Handle kitchen order updates
     */
    onKitchenOrderUpdated(event) {
        const order = event.detail.order;
        const status = event.detail.status;
        
        this.addNotification(_t(`Order ${order.name} is now ${status}`), "info");
        
        // Send notification to customer if they have the app
        this.sendCustomerNotification(order, status);
    }
    
    /**
     * Handle swipe right gesture
     */
    onSwipeRight() {
        switch (this.state.currentScreen) {
            case "payment":
                this.state.currentScreen = "product";
                break;
            case "receipt":
                this.state.currentScreen = "product";
                break;
            default:
                // Show navigation menu
                this.showNavigationMenu();
        }
    }
    
    /**
     * Handle swipe left gesture
     */
    onSwipeLeft() {
        switch (this.state.currentScreen) {
            case "product":
                if (this.state.currentOrder && this.state.currentOrder.lines.length > 0) {
                    this.state.currentScreen = "payment";
                }
                break;
            case "payment":
                // Process payment if ready
                this.processPayment();
                break;
        }
    }
    
    /**
     * Show payment processing UI
     */
    showPaymentProcessing() {
        // Implementation for payment processing UI
        this.logger.debug("Showing payment processing UI");
    }
    
    /**
     * Add notification to the queue
     */
    addNotification(message, type = "info") {
        const notification = {
            id: Date.now(),
            message,
            type,
            timestamp: new Date()
        };
        
        this.state.notifications.push(notification);
        
        // Auto-remove notification after 5 seconds
        setTimeout(() => {
            this.removeNotification(notification.id);
        }, 5000);
    }
    
    /**
     * Remove notification
     */
    removeNotification(id) {
        const index = this.state.notifications.findIndex(n => n.id === id);
        if (index > -1) {
            this.state.notifications.splice(index, 1);
        }
    }
    
    /**
     * Save order locally for offline capability
     */
    saveOrderLocally(order) {
        try {
            const orders = JSON.parse(localStorage.getItem('pos_cash_offline_orders') || '[]');
            const existingIndex = orders.findIndex(o => o.id === order.id);
            
            if (existingIndex > -1) {
                orders[existingIndex] = order;
            } else {
                orders.push(order);
            }
            
            localStorage.setItem('pos_cash_offline_orders', JSON.stringify(orders));
            this.logger.debug('Order saved locally for offline sync', order.id);
        } catch (error) {
            this.logger.error('Failed to save order locally:', error);
        }
    }
    
    /**
     * Sync offline data when connection is restored
     */
    async syncOfflineData() {
        try {
            const offlineOrders = JSON.parse(localStorage.getItem('pos_cash_offline_orders') || '[]');
            
            if (offlineOrders.length > 0) {
                for (const order of offlineOrders) {
                    await this.orm.call('pos.order', 'sync_offline_order', [order]);
                }
                
                // Clear offline orders after successful sync
                localStorage.removeItem('pos_cash_offline_orders');
                
                this.addNotification(_t(`Synced ${offlineOrders.length} offline orders`), "success");
                this.logger.info(`Successfully synced ${offlineOrders.length} offline orders`);
            }
        } catch (error) {
            this.logger.error('Failed to sync offline data:', error);
            this.addNotification(_t("Failed to sync offline data"), "danger");
        }
    }
    
    /**
     * Handle receipt printing
     */
    async handleReceiptPrinting(order) {
        if (this.pos.config.auto_print_receipt) {
            await this.printReceipt(order);
        }
    }
    
    /**
     * Print receipt
     */
    async printReceipt(order) {
        try {
            await this.pos.printReceipt(order);
            this.addNotification(_t("Receipt printed successfully"), "success");
        } catch (error) {
            this.logger.error('Receipt printing failed:', error);
            this.addNotification(_t("Receipt printing failed"), "danger");
        }
    }
    
    /**
     * Send notification to customer
     */
    async sendCustomerNotification(order, status) {
        if (order.partner_id && this.pos.config.customer_notifications_enabled) {
            try {
                await this.orm.call('pos.order', 'send_customer_notification', [
                    order.id,
                    status
                ]);
                this.logger.debug('Customer notification sent successfully');
            } catch (error) {
                this.logger.error('Failed to send customer notification:', error);
            }
        }
    }
    
    /**
     * Show navigation menu
     */
    showNavigationMenu() {
        // Implementation for navigation menu
        this.logger.debug("Showing navigation menu");
    }
    
    /**
     * Process payment
     */
    async processPayment() {
        if (!this.state.currentOrder || this.state.paymentInProgress) {
            return;
        }
        
        this.state.paymentInProgress = true;
        
        try {
            // Implementation for payment processing
            const result = await this.pos.pay();
            
            if (result.success) {
                this.state.currentScreen = "receipt";
                this.logger.info('Payment processed successfully');
            }
        } catch (error) {
            this.logger.error('Payment processing failed:', error);
            this.addNotification(_t("Payment failed. Please try again."), "danger");
        } finally {
            this.state.paymentInProgress = false;
        }
    }
    
    /**
     * Get current screen component
     */
    getCurrentScreenComponent() {
        switch (this.state.currentScreen) {
            case "floor":
                return FloorScreen;
            case "product":
                return ProductScreen;
            case "payment":
                return PaymentScreen;
            case "receipt":
                return ReceiptScreen;
            default:
                return ProductScreen;
        }
    }
    
    /**
     * Get header title based on current screen
     */
    getHeaderTitle() {
        switch (this.state.currentScreen) {
            case "floor":
                return _t("Select Table");
            case "product":
                return this.state.selectedTable ? 
                    _t("Table %s", this.state.selectedTable.name) : 
                    _t("POS Cash");
            case "payment":
                return _t("Payment");
            case "receipt":
                return _t("Receipt");
            default:
                return _t("POS Cash");
        }
    }
    
    /**
     * Handle online status
     */
    onOnline() {
        this.state.connectionStatus = 'online';
        this.syncOfflineData();
        this.addNotification(_t("Connection restored"), "success");
    }
    
    /**
     * Handle offline status
     */
    onOffline() {
        this.state.connectionStatus = 'offline';
        this.addNotification(_t("Working offline"), "warning");
    }
} 