/** @odoo-module **/

import { Component, useState, onMounted, onWillDestroy } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";

export class KitchenDisplay extends Component {
    static template = "pos_restaurant_features.KitchenDisplay";

    setup() {
        this.rpc = useService("rpc");
        this.notification = useService("notification");
        
        this.state = useState({
            orders: [],
            stations: [],
            selectedStation: null,
            selectedStations: [], // For multi-station view
            layout: 'grid', // grid, list, kanban
            autoRefresh: true,
            refreshInterval: 5000, // 5 seconds
            loading: true,
            showCompletedOrders: false,
            soundEnabled: true,
            filters: {
                priority: 'all',
                status: 'active', // active, all, pending, preparing
                timeRange: 'all'
            },
            stationSummary: {},
            alerts: []
        });

        this.refreshTimer = null;
        this.audioContext = null;

        onMounted(() => {
            this.loadKitchenStations();
            this.loadKitchenOrders();
            this.setupAutoRefresh();
            this.initializeAudio();
        });

        onWillDestroy(() => {
            if (this.refreshTimer) {
                clearInterval(this.refreshTimer);
            }
        });
    }

    // ============ INITIALIZATION METHODS ============

    async loadKitchenStations() {
        try {
            const data = await this.rpc('/kitchen/stations');
            this.state.stations = data.stations || [];
            
            // Auto-select first station if none selected
            if (this.state.stations.length > 0 && !this.state.selectedStation) {
                this.state.selectedStation = this.state.stations[0].id;
                this.state.selectedStations = [this.state.stations[0].id];
            }
        } catch (error) {
            this.notification.add("Failed to load kitchen stations", { type: "danger" });
        }
    }

    async loadKitchenOrders() {
        try {
            this.state.loading = true;
            
            const stationIds = this.state.selectedStations.length > 0 
                ? this.state.selectedStations 
                : null;
            
            const data = await this.rpc('/kitchen/orders', {
                station_ids: stationIds,
                limit: 50
            });
            
            this.state.orders = data.orders || [];
            this.processOrderAlerts(data.orders);
            this.state.loading = false;
            
        } catch (error) {
            this.notification.add("Failed to load kitchen orders", { type: "danger" });
            this.state.loading = false;
        }
    }

    async loadStationSummary() {
        try {
            const data = await this.rpc('/kitchen/station/summary', {
                station_id: this.state.selectedStation
            });
            this.state.stationSummary = data;
        } catch (error) {
            console.error("Failed to load station summary:", error);
        }
    }

    setupAutoRefresh() {
        if (this.state.autoRefresh) {
            this.refreshTimer = setInterval(() => {
                this.loadKitchenOrders();
                this.loadStationSummary();
            }, this.state.refreshInterval);
        }
    }

    initializeAudio() {
        if (this.state.soundEnabled && 'AudioContext' in window) {
            this.audioContext = new AudioContext();
        }
    }

    // ============ ORDER MANAGEMENT METHODS ============

    async startItemPreparation(itemId) {
        try {
            const result = await this.rpc('/kitchen/item/start_preparation', {
                item_id: itemId
            });

            if (result.success) {
                this.notification.add(result.message, { type: "success" });
                this.playNotificationSound('start');
                await this.loadKitchenOrders();
            } else {
                this.notification.add(result.error || "Failed to start preparation", { type: "danger" });
            }
        } catch (error) {
            this.notification.add("Error starting item preparation", { type: "danger" });
        }
    }

    async markItemReady(itemId) {
        try {
            const result = await this.rpc('/kitchen/item/mark_ready', {
                item_id: itemId
            });

            if (result.success) {
                this.notification.add(result.message, { type: "success" });
                this.playNotificationSound('ready');
                await this.loadKitchenOrders();
            } else {
                this.notification.add(result.error || "Failed to mark item ready", { type: "danger" });
            }
        } catch (error) {
            this.notification.add("Error marking item ready", { type: "danger" });
        }
    }

    async markItemServed(itemId) {
        try {
            const result = await this.rpc('/kitchen/item/mark_served', {
                item_id: itemId
            });

            if (result.success) {
                this.notification.add(result.message, { type: "success" });
                await this.loadKitchenOrders();
            } else {
                this.notification.add(result.error || "Failed to mark item served", { type: "danger" });
            }
        } catch (error) {
            this.notification.add("Error marking item served", { type: "danger" });
        }
    }

    async cancelItem(itemId, reason = null) {
        try {
            const cancelReason = reason || prompt("Reason for cancellation:");
            if (!cancelReason) return;

            const result = await this.rpc('/kitchen/item/cancel', {
                item_id: itemId,
                reason: cancelReason
            });

            if (result.success) {
                this.notification.add(result.message, { type: "success" });
                await this.loadKitchenOrders();
            } else {
                this.notification.add(result.error || "Failed to cancel item", { type: "danger" });
            }
        } catch (error) {
            this.notification.add("Error cancelling item", { type: "danger" });
        }
    }

    // ============ STATION MANAGEMENT ============

    async selectStation(stationId) {
        this.state.selectedStation = stationId;
        this.state.selectedStations = [stationId];
        await this.loadKitchenOrders();
        await this.loadStationSummary();
    }

    async toggleStationSelection(stationId) {
        const index = this.state.selectedStations.indexOf(stationId);
        if (index > -1) {
            this.state.selectedStations.splice(index, 1);
        } else {
            this.state.selectedStations.push(stationId);
        }
        await this.loadKitchenOrders();
    }

    async selectAllStations() {
        this.state.selectedStations = this.state.stations.map(s => s.id);
        this.state.selectedStation = null;
        await this.loadKitchenOrders();
    }

    async clearStationSelection() {
        this.state.selectedStations = [];
        this.state.selectedStation = null;
        await this.loadKitchenOrders();
    }

    // ============ DISPLAY CONTROLS ============

    toggleAutoRefresh() {
        this.state.autoRefresh = !this.state.autoRefresh;
        
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        
        if (this.state.autoRefresh) {
            this.setupAutoRefresh();
        }
    }

    changeLayout(layout) {
        this.state.layout = layout;
    }

    changeRefreshInterval(interval) {
        this.state.refreshInterval = interval * 1000; // Convert to milliseconds
        
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        
        if (this.state.autoRefresh) {
            this.setupAutoRefresh();
        }
    }

    toggleSoundEnabled() {
        this.state.soundEnabled = !this.state.soundEnabled;
        if (this.state.soundEnabled) {
            this.initializeAudio();
        }
    }

    // ============ FILTERING AND SORTING ============

    onFilterChange(filterType, value) {
        this.state.filters[filterType] = value;
        this.applyFilters();
    }

    applyFilters() {
        // Filter orders based on current filter settings
        let filteredOrders = [...this.state.orders];

        // Priority filter
        if (this.state.filters.priority !== 'all') {
            filteredOrders = filteredOrders.filter(order => 
                order.priority === this.state.filters.priority
            );
        }

        // Status filter
        if (this.state.filters.status === 'pending') {
            filteredOrders = filteredOrders.filter(order =>
                order.items.some(item => item.status === 'pending')
            );
        } else if (this.state.filters.status === 'preparing') {
            filteredOrders = filteredOrders.filter(order =>
                order.items.some(item => item.status === 'preparing')
            );
        }

        // Time range filter
        if (this.state.filters.timeRange !== 'all') {
            const now = new Date();
            const cutoffMinutes = parseInt(this.state.filters.timeRange);
            filteredOrders = filteredOrders.filter(order => {
                const orderTime = new Date(order.order_time);
                const diffMinutes = (now - orderTime) / (1000 * 60);
                return diffMinutes <= cutoffMinutes;
            });
        }

        return filteredOrders;
    }

    sortOrdersByPriority(orders) {
        const priorityOrder = { 'urgent': 0, 'high': 1, 'normal': 2, 'low': 3 };
        return orders.sort((a, b) => {
            // First sort by priority
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0) return priorityDiff;
            
            // Then by elapsed time (oldest first)
            return b.elapsed_minutes - a.elapsed_minutes;
        });
    }

    // ============ UTILITY METHODS ============

    getOrderPriorityClass(order) {
        const classes = {
            'urgent': 'order-urgent',
            'high': 'order-high',
            'normal': 'order-normal',
            'low': 'order-low'
        };
        return classes[order.priority] || 'order-normal';
    }

    getItemStatusClass(status) {
        const classes = {
            'pending': 'item-pending',
            'preparing': 'item-preparing',
            'ready': 'item-ready',
            'served': 'item-served',
            'cancelled': 'item-cancelled'
        };
        return classes[status] || 'item-pending';
    }

    getElapsedTimeClass(elapsedMinutes) {
        if (elapsedMinutes > 25) return 'time-critical';
        if (elapsedMinutes > 15) return 'time-warning';
        return 'time-normal';
    }

    formatElapsedTime(elapsedMinutes) {
        if (elapsedMinutes < 60) {
            return `${elapsedMinutes}m`;
        } else {
            const hours = Math.floor(elapsedMinutes / 60);
            const minutes = elapsedMinutes % 60;
            return `${hours}h ${minutes}m`;
        }
    }

    getStationColor(stationId) {
        const station = this.state.stations.find(s => s.id === stationId);
        return station ? station.color : '#3498db';
    }

    getStationName(stationId) {
        const station = this.state.stations.find(s => s.id === stationId);
        return station ? station.name : 'Unknown Station';
    }

    // ============ ALERT AND NOTIFICATION METHODS ============

    processOrderAlerts(orders) {
        const alerts = [];
        
        orders.forEach(order => {
            // Check for orders taking too long
            if (order.elapsed_minutes > 30) {
                alerts.push({
                    type: 'critical',
                    title: 'Order Delayed',
                    message: `Order ${order.name} has been pending for ${order.elapsed_minutes} minutes`,
                    orderId: order.id
                });
            }
            
            // Check for rush orders
            if (order.rush_order) {
                alerts.push({
                    type: 'warning',
                    title: 'Rush Order',
                    message: `Order ${order.name} is marked as rush`,
                    orderId: order.id
                });
            }
        });
        
        this.state.alerts = alerts;
        
        // Play alert sound for critical alerts
        if (alerts.some(alert => alert.type === 'critical')) {
            this.playNotificationSound('alert');
        }
    }

    playNotificationSound(type) {
        if (!this.state.soundEnabled || !this.audioContext) return;
        
        const frequencies = {
            'start': 440,    // A note
            'ready': 523,    // C note
            'alert': 880     // High A note
        };
        
        const frequency = frequencies[type] || 440;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.5);
    }

    // ============ EXPORT AND REPORTING ============

    async exportKitchenReport() {
        try {
            // This would generate a kitchen performance report
            this.notification.add("Kitchen report export feature coming soon", { type: "info" });
        } catch (error) {
            this.notification.add("Error exporting kitchen report", { type: "danger" });
        }
    }

    // ============ KEYBOARD SHORTCUTS ============

    onKeyDown(event) {
        // Implement keyboard shortcuts for common actions
        if (event.ctrlKey) {
            switch (event.key) {
                case 'r':
                    event.preventDefault();
                    this.loadKitchenOrders();
                    break;
                case 'a':
                    event.preventDefault();
                    this.selectAllStations();
                    break;
                case 's':
                    event.preventDefault();
                    this.toggleSoundEnabled();
                    break;
            }
        }
    }
}

// Register the component
registry.category("actions").add("kitchen_display", KitchenDisplay); 