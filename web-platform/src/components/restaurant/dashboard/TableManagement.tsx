import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  QrCode, 
  Users, 
  MapPin,
  Edit,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Restaurant } from '../../types';

// Platform-specific table type - consider adding to shared types
interface RestaurantTable {
  id: string;
  table_number: string;
  section?: string;
  capacity: number;
  position_x: number;
  position_y: number;
  is_active: boolean;
  qr_code_url?: string;
}

interface TableManagementProps {
  restaurant: Restaurant;
}

export const TableManagement: React.FC<TableManagementProps> = ({ restaurant }) => {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchTables();
  }, [restaurant.id]);

  const fetchTables = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('table_number');

      if (error) {
        throw error;
      }

      setTables(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load tables",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleTableStatus = async (tableId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('restaurant_tables')
        .update({ is_active: !currentStatus })
        .eq('id', tableId);

      if (error) {
        throw error;
      }

      await fetchTables();
      toast({
        title: "Success",
        description: `Table ${!currentStatus ? 'activated' : 'deactivated'}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update table status",
        variant: "destructive",
      });
    }
  };

  const generateQRCode = async (tableId: string, tableNumber: string) => {
    try {
      // In a real implementation, you would generate a QR code that links to your ordering system
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
        `${window.location.origin}/order/${restaurant.id}/table/${tableNumber}`
      )}`;

      const { error } = await supabase
        .from('restaurant_tables')
        .update({ qr_code_url: qrCodeUrl })
        .eq('id', tableId);

      if (error) {
        throw error;
      }

      await fetchTables();
      toast({
        title: "Success",
        description: "QR code generated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate QR code",
        variant: "destructive",
      });
    }
  };

  const sections = [...new Set(tables.map(table => table.section).filter(Boolean))];

  const filteredTables = tables.filter(table => {
    const matchesSearch = table.table_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         table.section?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSection = selectedSection === 'all' || table.section === selectedSection;
    
    return matchesSearch && matchesSection;
  });

  const getTableStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  if (loading) {
    return <div className="p-6">Loading tables...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Table Management</h1>
          <p className="text-gray-600">Manage restaurant tables and floor plan</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Table
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Tables</p>
                <p className="text-2xl font-bold">{tables.length}</p>
              </div>
              <MapPin className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Tables</p>
                <p className="text-2xl font-bold text-green-600">
                  {tables.filter(table => table.is_active).length}
                </p>
              </div>
              <Eye className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Capacity</p>
                <p className="text-2xl font-bold">
                  {tables.reduce((sum, table) => sum + table.capacity, 0)}
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">With QR Codes</p>
                <p className="text-2xl font-bold text-purple-600">
                  {tables.filter(table => table.qr_code_url).length}
                </p>
              </div>
              <QrCode className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Input
                placeholder="Search tables by number or section..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Sections</option>
              {sections.map(section => (
                <option key={section} value={section}>
                  {section}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredTables.map((table) => (
          <Card key={table.id} className={`${!table.is_active ? 'opacity-60' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">Table {table.table_number}</CardTitle>
                  {table.section && (
                    <Badge variant="outline" className="text-xs mt-1">
                      {table.section}
                    </Badge>
                  )}
                </div>
                <Badge className={getTableStatusColor(table.is_active)}>
                  {table.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">Capacity: {table.capacity}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <QrCode className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">
                      {table.qr_code_url ? 'QR Code Ready' : 'No QR Code'}
                    </span>
                  </div>
                  {table.qr_code_url && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={table.qr_code_url} target="_blank" rel="noopener noreferrer">
                        View
                      </a>
                    </Button>
                  )}
                </div>

                <div className="flex justify-between pt-2 border-t">
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleTableStatus(table.id, table.is_active)}
                    >
                      {table.is_active ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {!table.qr_code_url && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => generateQRCode(table.id, table.table_number)}
                    >
                      <QrCode className="w-4 h-4 mr-1" />
                      Generate QR
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTables.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">No tables found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};