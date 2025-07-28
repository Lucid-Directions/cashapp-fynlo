/** @odoo-module **/

import { Component, onMounted, onWillDestroy, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";

// Analytics Dashboard Component
export class AnalyticsDashboard extends Component {
    static template = "pos_analytics_reporting.AnalyticsDashboard";
    
    setup() {
        this.rpc = useService("rpc");
        this.notification = useService("notification");
        
        this.state = useState({
            loading: true,
            data: {},
            dateRange: 'today',
            dateFrom: null,
            dateTo: null,
            charts: {},
            refreshInterval: 30000, // 30 seconds
            autoRefresh: true
        });
        
        this.chartInstances = {};
        this.refreshTimer = null;
        
        onMounted(() => {
            this.loadDashboardData();
            this.setupAutoRefresh();
        });
        
        onWillDestroy(() => {
            this.destroyCharts();
            if (this.refreshTimer) {
                clearInterval(this.refreshTimer);
            }
        });
    }
    
    async loadDashboardData() {
        try {
            this.state.loading = true;
            
            const data = await this.rpc('/pos_analytics/dashboard_data', {
                date_range: this.state.dateRange,
                date_from: this.state.dateFrom,
                date_to: this.state.dateTo
            });
            
            this.state.data = data;
            this.state.loading = false;
            
            // Initialize charts after data is loaded
            setTimeout(() => {
                this.initializeCharts();
            }, 100);
            
        } catch (error) {
            this.notification.add("Failed to load dashboard data", { type: "danger" });
            this.state.loading = false;
        }
    }
    
    setupAutoRefresh() {
        if (this.state.autoRefresh) {
            this.refreshTimer = setInterval(() => {
                this.loadDashboardData();
            }, this.state.refreshInterval);
        }
    }
    
    toggleAutoRefresh() {
        this.state.autoRefresh = !this.state.autoRefresh;
        
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        
        if (this.state.autoRefresh) {
            this.refreshTimer = setInterval(() => {
                this.loadDashboardData();
            }, this.state.refreshInterval);
        }
    }
    
    async onDateRangeChange(event) {
        this.state.dateRange = event.target.value;
        await this.loadDashboardData();
    }
    
    async onDateChange() {
        await this.loadDashboardData();
    }
    
    initializeCharts() {
        this.destroyCharts(); // Clean up existing charts
        
        // Sales Trend Chart
        this.createSalesTrendChart();
        
        // Sales by Hour Chart
        this.createHourlySalesChart();
        
        // Payment Methods Chart
        this.createPaymentMethodsChart();
        
        // Staff Performance Chart
        this.createStaffPerformanceChart();
        
        // Product Performance Chart
        this.createProductPerformanceChart();
        
        // Revenue vs Profit Chart
        this.createRevenueProfitChart();
    }
    
    createSalesTrendChart() {
        const ctx = document.getElementById('salesTrendChart');
        if (!ctx || !this.state.data.sales_trends) return;
        
        const data = this.state.data.sales_trends;
        
        this.chartInstances.salesTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels || [],
                datasets: [{
                    label: 'Sales',
                    data: data.sales || [],
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1
                }, {
                    label: 'Orders',
                    data: data.orders || [],
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Sales ($)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Orders'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Sales Trends'
                    }
                }
            }
        });
    }
    
    createHourlySalesChart() {
        const ctx = document.getElementById('hourlySalesChart');
        if (!ctx || !this.state.data.hourly_breakdown) return;
        
        const data = this.state.data.hourly_breakdown;
        
        this.chartInstances.hourlySales = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.hours || [],
                datasets: [{
                    label: 'Sales by Hour',
                    data: data.sales || [],
                    backgroundColor: 'rgba(54, 162, 235, 0.8)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Sales by Hour'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Sales ($)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Hour of Day'
                        }
                    }
                }
            }
        });
    }
    
    createPaymentMethodsChart() {
        const ctx = document.getElementById('paymentMethodsChart');
        if (!ctx || !this.state.data.payment_methods) return;
        
        const data = this.state.data.payment_methods;
        
        this.chartInstances.paymentMethods = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels || ['Cash', 'Card', 'Digital'],
                datasets: [{
                    data: data.values || [0, 0, 0],
                    backgroundColor: [
                        'rgba(255, 206, 86, 0.8)',
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(153, 102, 255, 0.8)'
                    ],
                    borderColor: [
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    title: {
                        display: true,
                        text: 'Payment Methods Distribution'
                    }
                }
            }
        });
    }
    
    createStaffPerformanceChart() {
        const ctx = document.getElementById('staffPerformanceChart');
        if (!ctx || !this.state.data.staff_performance) return;
        
        const data = this.state.data.staff_performance;
        
        this.chartInstances.staffPerformance = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: data.employees || [],
                datasets: [{
                    label: 'Performance Score',
                    data: data.scores || [],
                    fill: true,
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgb(255, 99, 132)',
                    pointBackgroundColor: 'rgb(255, 99, 132)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(255, 99, 132)'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Staff Performance'
                    }
                },
                scales: {
                    r: {
                        angleLines: {
                            display: false
                        },
                        suggestedMin: 0,
                        suggestedMax: 100
                    }
                }
            }
        });
    }
    
    createProductPerformanceChart() {
        const ctx = document.getElementById('productPerformanceChart');
        if (!ctx || !this.state.data.product_performance) return;
        
        const data = this.state.data.product_performance;
        
        this.chartInstances.productPerformance = new Chart(ctx, {
            type: 'horizontalBar',
            data: {
                labels: data.products || [],
                datasets: [{
                    label: 'Quantity Sold',
                    data: data.quantities || [],
                    backgroundColor: 'rgba(75, 192, 192, 0.8)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }, {
                    label: 'Revenue',
                    data: data.revenues || [],
                    backgroundColor: 'rgba(255, 99, 132, 0.8)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Top Products Performance'
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                }
            }
        });
    }
    
    createRevenueProfitChart() {
        const ctx = document.getElementById('revenueProfitChart');
        if (!ctx || !this.state.data.financial_metrics) return;
        
        const data = this.state.data.financial_metrics;
        
        this.chartInstances.revenueProfit = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.periods || [],
                datasets: [{
                    label: 'Revenue',
                    data: data.revenue || [],
                    backgroundColor: 'rgba(54, 162, 235, 0.8)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }, {
                    label: 'Profit',
                    data: data.profit || [],
                    backgroundColor: 'rgba(75, 192, 192, 0.8)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Revenue vs Profit'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Amount ($)'
                        }
                    }
                }
            }
        });
    }
    
    destroyCharts() {
        Object.values(this.chartInstances).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
        this.chartInstances = {};
    }
    
    async exportDashboard() {
        try {
            const response = await this.rpc('/pos_analytics/export_dashboard', {
                date_range: this.state.dateRange,
                date_from: this.state.dateFrom,
                date_to: this.state.dateTo,
                format: 'pdf'
            });
            
            // Create download link
            const link = document.createElement('a');
            link.href = response.url;
            link.download = response.filename;
            link.click();
            
            this.notification.add("Dashboard exported successfully", { type: "success" });
        } catch (error) {
            this.notification.add("Failed to export dashboard", { type: "danger" });
        }
    }
    
    formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(value || 0);
    }
    
    formatNumber(value) {
        return new Intl.NumberFormat('en-US').format(value || 0);
    }
    
    formatPercentage(value) {
        return `${(value || 0).toFixed(1)}%`;
    }
}

// Register the component
registry.category("actions").add("pos_analytics_dashboard", AnalyticsDashboard);

// Staff Performance Dashboard Component
export class StaffPerformanceDashboard extends Component {
    static template = "pos_analytics_reporting.StaffPerformanceDashboard";
    
    setup() {
        this.rpc = useService("rpc");
        this.notification = useService("notification");
        
        this.state = useState({
            loading: true,
            data: {},
            selectedEmployee: null,
            dateFrom: null,
            dateTo: null
        });
        
        onMounted(() => {
            this.loadStaffData();
        });
    }
    
    async loadStaffData() {
        try {
            this.state.loading = true;
            
            const data = await this.rpc('/pos_analytics/staff_performance_data', {
                employee_ids: this.state.selectedEmployee ? [this.state.selectedEmployee] : null,
                date_from: this.state.dateFrom,
                date_to: this.state.dateTo
            });
            
            this.state.data = data;
            this.state.loading = false;
            
        } catch (error) {
            this.notification.add("Failed to load staff performance data", { type: "danger" });
            this.state.loading = false;
        }
    }
    
    async onEmployeeChange(event) {
        this.state.selectedEmployee = parseInt(event.target.value) || null;
        await this.loadStaffData();
    }
    
    async onDateChange() {
        await this.loadStaffData();
    }
}

registry.category("actions").add("staff_performance_dashboard", StaffPerformanceDashboard); 