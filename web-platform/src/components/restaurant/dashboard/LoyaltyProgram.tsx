import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Star, 
  Gift, 
  Users, 
  TrendingUp,
  Calendar,
  Target,
  Award,
  Crown,
  Heart,
  Sparkles,
  Percent,
  Coffee,
  Cake,
  Edit,
  Trash2,
  Play,
  Pause
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Restaurant } from '../../types';

interface LoyaltyProgram {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  program_type: 'points' | 'visits' | 'amount_spent' | 'tier';
  is_active: boolean;
  settings: any;
  created_at: string;
  updated_at: string;
}

interface LoyaltyProgramProps {
  restaurant: Restaurant;
}

export const LoyaltyProgram: React.FC<LoyaltyProgramProps> = ({ restaurant }) => {
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateProgram, setShowCreateProgram] = useState(false);
  const { toast } = useToast();

  const [newProgram, setNewProgram] = useState({
    name: '',
    description: '',
    program_type: 'points' as const,
    settings: {}
  });

  useEffect(() => {
    fetchPrograms();
  }, [restaurant.id]);

  const fetchPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('loyalty_programs')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrograms((data || []) as LoyaltyProgram[]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load loyalty programs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createProgram = async () => {
    try {
      const { error } = await supabase
        .from('loyalty_programs')
        .insert({
          restaurant_id: restaurant.id,
          name: newProgram.name,
          description: newProgram.description,
          program_type: newProgram.program_type,
          settings: newProgram.settings
        });

      if (error) throw error;

      await fetchPrograms();
      setShowCreateProgram(false);
      setNewProgram({ name: '', description: '', program_type: 'points', settings: {} });
      
      toast({
        title: "Success",
        description: "Loyalty program created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create loyalty program",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="p-6">Loading loyalty programs...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loyalty Programs</h1>
          <p className="text-gray-600">Create and manage customer loyalty programs and campaigns</p>
        </div>
        <Dialog open={showCreateProgram} onOpenChange={setShowCreateProgram}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Program
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Loyalty Program</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Program Name</label>
                <Input
                  value={newProgram.name}
                  onChange={(e) => setNewProgram({ ...newProgram, name: e.target.value })}
                  placeholder="e.g., VIP Rewards"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={newProgram.description}
                  onChange={(e) => setNewProgram({ ...newProgram, description: e.target.value })}
                  placeholder="Describe your loyalty program..."
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Program Type</label>
                <Select value={newProgram.program_type} onValueChange={(value: any) => setNewProgram({ ...newProgram, program_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="points">Points Based</SelectItem>
                    <SelectItem value="visits">Visit Based</SelectItem>
                    <SelectItem value="amount_spent">Spending Based</SelectItem>
                    <SelectItem value="tier">Tier Based</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreateProgram(false)}>
                  Cancel
                </Button>
                <Button onClick={createProgram}>
                  Create Program
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Programs</p>
                <p className="text-2xl font-bold">{programs.filter(p => p.is_active).length}</p>
              </div>
              <Star className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Members</p>
                <p className="text-2xl font-bold">1,234</p>
              </div>
              <Users className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rewards Claimed</p>
                <p className="text-2xl font-bold">567</p>
              </div>
              <Gift className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Engagement</p>
                <p className="text-2xl font-bold text-purple-600">85%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Programs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {programs.map((program) => (
          <Card key={program.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{program.name}</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">{program.description}</p>
                </div>
                <Badge variant={program.is_active ? "default" : "secondary"}>
                  {program.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm capitalize">{program.program_type.replace('_', ' ')} Based</span>
                </div>
                
                <div className="flex justify-between pt-2 border-t">
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      {program.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {programs.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Star className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Loyalty Programs</h3>
            <p className="text-gray-600 mb-4">Create your first loyalty program to start rewarding customers</p>
            <Button onClick={() => setShowCreateProgram(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Program
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Campaign Presets */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Presets</CardTitle>
          <p className="text-sm text-gray-600">Pre-built campaign templates to get you started quickly</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 text-red-500" />
                  <span className="font-medium">Welcome Bonus</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">Give new customers 100 bonus points when they join</p>
                <Button size="sm" variant="outline" className="w-full">
                  Use Template
                </Button>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Cake className="w-4 h-4 text-pink-500" />
                  <span className="font-medium">Birthday Special</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">20% off for customers on their birthday</p>
                <Button size="sm" variant="outline" className="w-full">
                  Use Template
                </Button>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span className="font-medium">Double Points Weekend</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">Double points on weekend purchases</p>
                <Button size="sm" variant="outline" className="w-full">
                  Use Template
                </Button>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="font-medium">Refer a Friend</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">£10 off when you refer a friend</p>
                <Button size="sm" variant="outline" className="w-full">
                  Use Template
                </Button>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4 text-orange-500" />
                  <span className="font-medium">10th Visit Free</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">Free item after 10 visits</p>
                <Button size="sm" variant="outline" className="w-full">
                  Use Template
                </Button>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-green-500" />
                  <span className="font-medium">Seasonal Promotion</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">Special offers during holidays and seasons</p>
                <Button size="sm" variant="outline" className="w-full">
                  Use Template
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};