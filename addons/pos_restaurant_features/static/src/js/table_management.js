/** @odoo-module **/

import { Component, useState, onMounted, onWillDestroy } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";

export class TableManagement extends Component {
    static template = "pos_restaurant_features.TableManagement";

    setup() {
        this.rpc = useService("rpc");
        this.notification = useService("notification");
        
        this.state = useState({
            tables: [],
            sections: [],
            selectedTable: null,
            selectedSection: null,
            floorPlan: { width: 1200, height: 800 },
            editMode: false,
            draggedTable: null,
            showTableDetails: false,
            loading: true,
            realTimeUpdates: true,
            filters: {
                status: 'all',
                section: 'all',
                server: 'all'
            }
        });

        this.refreshTimer = null;
        this.dragOffset = { x: 0, y: 0 };

        onMounted(() => {
            this.loadFloorPlan();
            this.setupRealTimeUpdates();
            this.setupEventListeners();
        });

        onWillDestroy(() => {
            if (this.refreshTimer) {
                clearInterval(this.refreshTimer);
            }
            this.removeEventListeners();
        });
    }

    async loadFloorPlan() {
        try {
            this.state.loading = true;
            const data = await this.rpc('/restaurant/floor_plan', {
                section_id: this.state.selectedSection
            });
            
            this.state.tables = data.tables || [];
            this.state.sections = data.sections || [];
            this.state.loading = false;
            
        } catch (error) {
            this.notification.add("Failed to load floor plan", { type: "danger" });
            this.state.loading = false;
        }
    }

    setupRealTimeUpdates() {
        if (this.state.realTimeUpdates) {
            this.refreshTimer = setInterval(() => {
                this.loadFloorPlan();
            }, 10000); // Refresh every 10 seconds
        }
    }

    toggleRealTimeUpdates() {
        this.state.realTimeUpdates = !this.state.realTimeUpdates;
        
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        
        if (this.state.realTimeUpdates) {
            this.setupRealTimeUpdates();
        }
    }

    setupEventListeners() {
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
    }

    removeEventListeners() {
        document.removeEventListener('mousemove', this.onMouseMove.bind(this));
        document.removeEventListener('mouseup', this.onMouseUp.bind(this));
    }

    // ============ TABLE INTERACTION METHODS ============

    selectTable(table) {
        this.state.selectedTable = table;
        this.state.showTableDetails = true;
    }

    async updateTableStatus(tableId, status, extraData = {}) {
        try {
            const result = await this.rpc('/restaurant/table/update_status', {
                table_id: tableId,
                status: status,
                ...extraData
            });

            if (result.success) {
                this.notification.add(result.message, { type: "success" });
                await this.loadFloorPlan();
            } else {
                this.notification.add(result.error || "Failed to update table status", { type: "danger" });
            }
        } catch (error) {
            this.notification.add("Error updating table status", { type: "danger" });
        }
    }

    async assignServerToTable(tableId, serverId) {
        try {
            const result = await this.rpc('/restaurant/table/assign_server', {
                table_id: tableId,
                server_id: serverId
            });

            if (result.success) {
                this.notification.add(result.message, { type: "success" });
                await this.loadFloorPlan();
            } else {
                this.notification.add(result.error || "Failed to assign server", { type: "danger" });
            }
        } catch (error) {
            this.notification.add("Error assigning server", { type: "danger" });
        }
    }

    // ============ DRAG AND DROP FUNCTIONALITY ============

    onTableMouseDown(event, table) {
        if (!this.state.editMode) return;
        
        event.preventDefault();
        this.state.draggedTable = table;
        
        const rect = event.target.getBoundingClientRect();
        this.dragOffset = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    onMouseMove(event) {
        if (!this.state.draggedTable || !this.state.editMode) return;
        
        const floorPlan = document.querySelector('.floor-plan');
        if (!floorPlan) return;
        
        const rect = floorPlan.getBoundingClientRect();
        const x = event.clientX - rect.left - this.dragOffset.x;
        const y = event.clientY - rect.top - this.dragOffset.y;
        
        // Update table position visually
        const tableElement = document.querySelector(`[data-table-id="${this.state.draggedTable.id}"]`);
        if (tableElement) {
            tableElement.style.left = `${x}px`;
            tableElement.style.top = `${y}px`;
        }
    }

    async onMouseUp(event) {
        if (!this.state.draggedTable || !this.state.editMode) return;
        
        const floorPlan = document.querySelector('.floor-plan');
        if (!floorPlan) return;
        
        const rect = floorPlan.getBoundingClientRect();
        const x = event.clientX - rect.left - this.dragOffset.x;
        const y = event.clientY - rect.top - this.dragOffset.y;
        
        // Update table position in backend
        try {
            const result = await this.rpc('/restaurant/table/update_position', {
                table_id: this.state.draggedTable.id,
                pos_x: Math.max(0, x),
                pos_y: Math.max(0, y)
            });

            if (result.success) {
                this.notification.add("Table position updated", { type: "success" });
            } else {
                this.notification.add(result.error || "Failed to update position", { type: "danger" });
                // Revert position
                await this.loadFloorPlan();
            }
        } catch (error) {
            this.notification.add("Error updating table position", { type: "danger" });
            await this.loadFloorPlan();
        }
        
        this.state.draggedTable = null;
    }

    // ============ TABLE STATUS ACTIONS ============

    async setTableAvailable(table) {
        await this.updateTableStatus(table.id, 'available');
    }

    async setTableOccupied(table, serverId = null) {
        const extraData = serverId ? { server_id: serverId } : {};
        await this.updateTableStatus(table.id, 'occupied', extraData);
    }

    async setTableReserved(table, reservedBy, reservationTime = null) {
        const extraData = {
            reserved_by: reservedBy,
            reservation_time: reservationTime || new Date().toISOString()
        };
        await this.updateTableStatus(table.id, 'reserved', extraData);
    }

    async setTableCleaning(table) {
        await this.updateTableStatus(table.id, 'cleaning');
    }

    async setTableBlocked(table) {
        await this.updateTableStatus(table.id, 'blocked');
    }

    // ============ FILTERING AND SEARCH ============

    async onSectionChange(event) {
        this.state.selectedSection = event.target.value === 'all' ? null : parseInt(event.target.value);
        await this.loadFloorPlan();
    }

    onFilterChange(filterType, value) {
        this.state.filters[filterType] = value;
        this.applyFilters();
    }

    applyFilters() {
        // This would filter the displayed tables based on current filters
        // Implementation depends on how you want to handle filtering
    }

    // ============ UTILITY METHODS ============

    getTableStatusColor(status) {
        const colors = {
            'available': '#2ecc71',
            'occupied': '#e74c3c',
            'reserved': '#f39c12',
            'cleaning': '#9b59b6',
            'blocked': '#95a5a6',
            'maintenance': '#34495e'
        };
        return colors[status] || '#bdc3c7';
    }

    getTableStatusIcon(status) {
        const icons = {
            'available': 'fa-check-circle',
            'occupied': 'fa-users',
            'reserved': 'fa-clock',
            'cleaning': 'fa-broom',
            'blocked': 'fa-ban',
            'maintenance': 'fa-tools'
        };
        return icons[status] || 'fa-question-circle';
    }

    formatElapsedTime(occupiedSince) {
        if (!occupiedSince) return '';
        
        const now = new Date();
        const occupied = new Date(occupiedSince);
        const diffMinutes = Math.floor((now - occupied) / (1000 * 60));
        
        if (diffMinutes < 60) {
            return `${diffMinutes}m`;
        } else {
            const hours = Math.floor(diffMinutes / 60);
            const minutes = diffMinutes % 60;
            return `${hours}h ${minutes}m`;
        }
    }

    // ============ MODAL AND DIALOG METHODS ============

    showReservationDialog(table) {
        // This would open a modal for reservation details
        const reservedBy = prompt("Reserved by:");
        if (reservedBy) {
            this.setTableReserved(table, reservedBy);
        }
    }

    showServerAssignmentDialog(table) {
        // This would open a modal to select a server
        // For now, using a simple prompt
        const serverId = prompt("Enter server ID:");
        if (serverId) {
            this.assignServerToTable(table.id, parseInt(serverId));
        }
    }

    closeTableDetails() {
        this.state.showTableDetails = false;
        this.state.selectedTable = null;
    }

    toggleEditMode() {
        this.state.editMode = !this.state.editMode;
        if (this.state.editMode) {
            this.notification.add("Edit mode enabled - drag tables to reposition", { type: "info" });
        } else {
            this.notification.add("Edit mode disabled", { type: "info" });
        }
    }

    // ============ EXPORT AND REPORTING ============

    async exportFloorPlan() {
        try {
            // This would generate and download a floor plan image/PDF
            this.notification.add("Floor plan export feature coming soon", { type: "info" });
        } catch (error) {
            this.notification.add("Error exporting floor plan", { type: "danger" });
        }
    }

    async generateTableReport() {
        try {
            const result = await this.rpc('/restaurant/table/statistics', {
                date_from: new Date().toISOString().split('T')[0],
                date_to: new Date().toISOString().split('T')[0]
            });

            // Display report in a modal or new window
            console.log("Table statistics:", result);
            this.notification.add("Table report generated", { type: "success" });
        } catch (error) {
            this.notification.add("Error generating table report", { type: "danger" });
        }
    }
}

// Register the component
registry.category("actions").add("table_management", TableManagement); 