import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  CreditCard, 
  Smartphone, 
  Banknote, 
  TrendingUp,
  Filter,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Restaurant } from '../../types';

interface Payment {
  id: string;
  amount: number;
  payment_method: string;
  payment_status: string;
  transaction_id?: string;
  processed_at?: string;
  created_at: string;
  orders: {
    order_number: string;
    customer_name?: string;
  };
}

interface PaymentStats {
  totalAmount: number;
  totalTransactions: number;
  cashPayments: number;
  cardPayments: number;
  digitalPayments: number;
  pendingPayments: number;
}

interface PaymentProcessingProps {
  restaurant: Restaurant;
}

export const PaymentProcessing: React.FC<PaymentProcessingProps> = ({ restaurant }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats>({
    totalAmount: 0,
    totalTransactions: 0,
    cashPayments: 0,
    cardPayments: 0,
    digitalPayments: 0,
    pendingPayments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchPayments();
  }, [restaurant.id, statusFilter]);

  const fetchPayments = async () => {
    try {
      let query = supabase
        .from('payments')
        .select(`
          *,
          orders!inner (order_number, customer_name)
        `)
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('payment_status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const paymentData = data || [];
      setPayments(paymentData);

      // Calculate stats
      const completed = paymentData.filter(p => p.payment_status === 'completed');
      const totalAmount = completed.reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0);
      
      const stats: PaymentStats = {
        totalAmount,
        totalTransactions: completed.length,
        cashPayments: completed.filter(p => p.payment_method === 'cash').length,
        cardPayments: completed.filter(p => ['card', 'stripe', 'square', 'sumup'].includes(p.payment_method)).length,
        digitalPayments: completed.filter(p => ['apple_pay', 'google_pay'].includes(p.payment_method)).length,
        pendingPayments: paymentData.filter(p => p.payment_status === 'pending').length,
      };

      setStats(stats);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load payments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote className="w-4 h-4" />;
      case 'apple_pay':
      case 'google_pay': return <Smartphone className="w-4 h-4" />;
      default: return <CreditCard className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'refunded': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'processing': return <RefreshCw className="w-4 h-4" />;
      case 'failed': return <XCircle className="w-4 h-4" />;
      case 'refunded': return <RefreshCw className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const filteredPayments = payments.filter(payment =>
    payment.orders.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.orders.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="p-6">Loading payments...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Processing</h1>
          <p className="text-gray-600">Manage and track all payment transactions</p>
        </div>
        <Button>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Payment Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{stats.totalAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalTransactions} completed transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Card Payments</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cardPayments}</div>
            <p className="text-xs text-muted-foreground">
              Credit/Debit & Online
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Payments</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cashPayments}</div>
            <p className="text-xs text-muted-foreground">
              Physical cash transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Digital Wallets</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.digitalPayments}</div>
            <p className="text-xs text-muted-foreground">
              Apple Pay & Google Pay
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by order number, customer, or transaction ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Payments List */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Transactions ({filteredPayments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No payments found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPayments.map((payment) => (
                <div key={payment.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        {getPaymentMethodIcon(payment.payment_method)}
                        {getStatusIcon(payment.payment_status)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold">Order #{payment.orders.order_number}</h3>
                          <Badge className={getStatusColor(payment.payment_status)}>
                            {payment.payment_status}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span className="capitalize">{payment.payment_method.replace('_', ' ')}</span>
                          {payment.orders.customer_name && <span>• {payment.orders.customer_name}</span>}
                          {payment.transaction_id && <span>• ID: {payment.transaction_id}</span>}
                          <span>
                            • {new Date(payment.created_at).toLocaleTimeString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <p className="font-semibold text-lg">£{parseFloat(payment.amount.toString()).toFixed(2)}</p>
                        <p className="text-sm text-gray-500">
                          {payment.processed_at 
                            ? new Date(payment.processed_at).toLocaleDateString('en-GB')
                            : 'Not processed'
                          }
                        </p>
                      </div>

                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};