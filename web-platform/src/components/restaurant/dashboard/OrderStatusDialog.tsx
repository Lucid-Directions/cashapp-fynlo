import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Phone, Mail, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  special_instructions?: string;
  status: string;
  menu_items: {
    name: string;
    description?: string;
  };
  modifiers?: any[];
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  order_type: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  table_id?: string;
  subtotal: number;
  tax_amount: number;
  service_charge: number;
  total_amount: number;
  special_instructions?: string;
  notes?: string;
  estimated_ready_time?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  order_items: OrderItem[];
  restaurant_tables?: {
    table_number: string;
    section?: string;
  };
}

interface OrderStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  onOrderUpdated: () => void;
}

const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-blue-100 text-blue-800' },
  { value: 'preparing', label: 'Preparing', color: 'bg-orange-100 text-orange-800' },
  { value: 'ready', label: 'Ready', color: 'bg-green-100 text-green-800' },
  { value: 'completed', label: 'Completed', color: 'bg-gray-100 text-gray-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' }
];

export const OrderStatusDialog: React.FC<OrderStatusDialogProps> = ({
  open,
  onOpenChange,
  order,
  onOrderUpdated
}) => {
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (order) {
      setNewStatus(order.status);
      setNotes(order.notes || '');
      if (order.estimated_ready_time) {
        const date = new Date(order.estimated_ready_time);
        setEstimatedTime(date.toISOString().slice(0, 16));
      }
    }
  }, [order]);

  const handleUpdateOrder = async () => {
    if (!order) return;

    setLoading(true);
    try {
      const updates: any = {
        status: newStatus,
        notes: notes || null,
        estimated_ready_time: estimatedTime ? new Date(estimatedTime).toISOString() : null,
        updated_at: new Date().toISOString()
      };

      // If marking as completed, set completed_at
      if (newStatus === 'completed' && order.status !== 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Order updated successfully",
      });

      onOrderUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: "Error",
        description: "Failed to update order",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = ORDER_STATUSES.find(s => s.value === status);
    return (
      <Badge className={statusInfo?.color || 'bg-gray-100 text-gray-800'}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => `£${amount.toFixed(2)}`;

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Order #{order.order_number}</span>
            {getStatusBadge(order.status)}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Order Details */}
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-3">Order Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>Created: {formatDateTime(order.created_at)}</span>
                </div>
                <div>
                  <span className="font-medium">Type:</span> {order.order_type.replace('_', ' ').toUpperCase()}
                </div>
                {order.restaurant_tables && (
                  <div>
                    <span className="font-medium">Table:</span> {order.restaurant_tables.table_number}
                    {order.restaurant_tables.section && ` (${order.restaurant_tables.section})`}
                  </div>
                )}
              </div>
            </div>

            {/* Customer Information */}
            {(order.customer_name || order.customer_phone || order.customer_email) && (
              <div>
                <h3 className="font-semibold mb-3">Customer Information</h3>
                <div className="space-y-2 text-sm">
                  {order.customer_name && (
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span>{order.customer_name}</span>
                    </div>
                  )}
                  {order.customer_phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{order.customer_phone}</span>
                    </div>
                  )}
                  {order.customer_email && (
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span>{order.customer_email}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Order Items */}
            <div>
              <h3 className="font-semibold mb-3">Order Items</h3>
              <div className="space-y-3">
                {order.order_items.map((item) => (
                  <div key={item.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium">{item.menu_items.name}</h4>
                        {item.menu_items.description && (
                          <p className="text-sm text-gray-600">{item.menu_items.description}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(item.total_price)}</div>
                        <div className="text-sm text-gray-500">
                          {item.quantity} × {formatCurrency(item.unit_price)}
                        </div>
                      </div>
                    </div>
                    
                    {item.special_instructions && (
                      <div className="text-sm text-orange-600 bg-orange-50 p-2 rounded">
                        <strong>Special Instructions:</strong> {item.special_instructions}
                      </div>
                    )}
                    
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="text-sm text-gray-600 mt-2">
                        <strong>Modifications:</strong> {JSON.stringify(item.modifiers)}
                      </div>
                    )}
                    
                    <div className="mt-2">
                      {getStatusBadge(item.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Special Instructions */}
            {order.special_instructions && (
              <div>
                <h3 className="font-semibold mb-2">Special Instructions</h3>
                <div className="text-sm bg-yellow-50 p-3 rounded border border-yellow-200">
                  {order.special_instructions}
                </div>
              </div>
            )}
          </div>

          {/* Order Management */}
          <div className="space-y-4">
            {/* Order Summary */}
            <div>
              <h3 className="font-semibold mb-3">Order Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>{formatCurrency(order.tax_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Service Charge:</span>
                  <span>{formatCurrency(order.service_charge)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(order.total_amount)}</span>
                </div>
              </div>
            </div>

            {/* Status Management */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="status">Update Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="estimated_time">Estimated Ready Time</Label>
                <input
                  id="estimated_time"
                  type="datetime-local"
                  value={estimatedTime}
                  onChange={(e) => setEstimatedTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <Label htmlFor="notes">Internal Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add internal notes about this order..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpdateOrder} disabled={loading}>
            {loading ? 'Updating...' : 'Update Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};