import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Sparkles, 
  ArrowRight,
  Check,
  Info,
  Clock,
  Users,
  Target
} from 'lucide-react';
import { LOYALTY_TEMPLATES, LoyaltyTemplate, getTemplatesByCategory } from './LoyaltyTemplates';

interface TemplateSelectorProps {
  onSelectTemplate: (template: LoyaltyTemplate) => void;
  selectedTemplate?: LoyaltyTemplate | null;
}

const CATEGORIES = [
  { value: 'all', label: 'All Templates', icon: '🎯' },
  { value: 'restaurant', label: 'Restaurant & Food', icon: '🍽️' },
  { value: 'retail', label: 'Retail & Shopping', icon: '🛍️' },
  { value: 'service', label: 'Service Business', icon: '🔧' },
  { value: 'general', label: 'General Business', icon: '🏢' }
];

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  onSelectTemplate,
  selectedTemplate
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredTemplates = React.useMemo(() => {
    let templates = selectedCategory === 'all' 
      ? LOYALTY_TEMPLATES 
      : getTemplatesByCategory(selectedCategory);
    
    if (searchTerm) {
      templates = templates.filter(template =>
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return templates;
  }, [selectedCategory, searchTerm]);

  const getComplexityBadge = (template: LoyaltyTemplate) => {
    const ruleCount = template.defaultSettings.rules.length;
    const hasAdvanced = template.defaultSettings.advanced.referralBonus.enabled || 
                      template.defaultSettings.advanced.pointExpiry.enabled ||
                      template.defaultSettings.advanced.tierMaintenance.enabled;
    
    if (ruleCount <= 2 && !hasAdvanced) return { label: 'Simple', color: 'bg-green-100 text-green-800' };
    if (ruleCount <= 4 || hasAdvanced) return { label: 'Intermediate', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Advanced', color: 'bg-red-100 text-red-800' };
  };

  const getEstimatedSetupTime = (template: LoyaltyTemplate) => {
    const complexity = getComplexityBadge(template);
    switch (complexity.label) {
      case 'Simple': return '5-10 min';
      case 'Intermediate': return '15-25 min';
      case 'Advanced': return '30-45 min';
      default: return '10-20 min';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center space-x-2 mb-2">
          <Sparkles className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Choose Your Loyalty Program Template</h2>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Start with a professionally designed template tailored to your industry, 
          then customize it to match your unique business needs.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md mx-auto">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search templates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Categories */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          {CATEGORIES.map((category) => (
            <TabsTrigger key={category.value} value={category.value} className="text-xs">
              <span className="mr-1">{category.icon}</span>
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-6">
          {filteredTemplates.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="w-12 h-12 text-muted-foreground mb-4" />
                <h4 className="text-lg font-medium mb-2">No templates found</h4>
                <p className="text-sm text-muted-foreground text-center">
                  Try adjusting your search terms or category selection
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((template) => {
                const complexity = getComplexityBadge(template);
                const setupTime = getEstimatedSetupTime(template);
                const isSelected = selectedTemplate?.id === template.id;

                return (
                  <Card 
                    key={template.id} 
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      isSelected ? 'ring-2 ring-primary shadow-lg' : ''
                    }`}
                    onClick={() => onSelectTemplate(template)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-12 h-12 rounded-lg ${template.color} flex items-center justify-center text-white text-xl`}>
                            {template.icon}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{template.name}</CardTitle>
                            <Badge variant="outline" className="text-xs mt-1">
                              {template.category}
                            </Badge>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">{template.description}</p>

                      {/* Features Preview */}
                      <div className="space-y-2">
                        <h5 className="text-sm font-medium flex items-center">
                          <Target className="w-3 h-3 mr-1" />
                          Features Included:
                        </h5>
                        <div className="flex flex-wrap gap-1">
                          {template.defaultSettings.rules.slice(0, 3).map((rule, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {rule.name}
                            </Badge>
                          ))}
                          {template.defaultSettings.rules.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{template.defaultSettings.rules.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-xs text-muted-foreground">Rules</div>
                          <div className="font-medium text-sm">{template.defaultSettings.rules.length}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Rewards</div>
                          <div className="font-medium text-sm">{template.defaultSettings.rewards.length}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Setup</div>
                          <div className="font-medium text-sm flex items-center justify-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {setupTime}
                          </div>
                        </div>
                      </div>

                      {/* Complexity Badge */}
                      <div className="flex items-center justify-between">
                        <Badge className={`text-xs ${complexity.color}`}>
                          {complexity.label}
                        </Badge>
                        
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Users className="w-3 h-3 mr-1" />
                          Best for {template.category}
                        </div>
                      </div>

                      {/* Action Button */}
                      <Button 
                        className="w-full" 
                        variant={isSelected ? "default" : "outline"}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTemplate(template);
                        }}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Selected
                          </>
                        ) : (
                          <>
                            Select Template
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Info Box */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-500 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Template Customization</h4>
              <p className="text-xs text-muted-foreground">
                All templates are fully customizable. You can modify rules, rewards, and settings 
                after selection to perfectly match your business requirements.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};