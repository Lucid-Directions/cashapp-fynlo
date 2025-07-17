import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  Trash2, 
  Settings, 
  Target, 
  Gift,
  ArrowRight,
  Info,
  GripVertical
} from 'lucide-react';
import { LoyaltyRule } from './LoyaltyTemplates';

interface RuleBuilderProps {
  rules: LoyaltyRule[];
  onChange: (rules: LoyaltyRule[]) => void;
}

const RULE_TYPES = [
  { value: 'spend', label: 'Amount Spent', icon: '💰', description: 'Trigger based on purchase amount' },
  { value: 'visit', label: 'Store Visits', icon: '🏪', description: 'Trigger based on visit frequency' },
  { value: 'item', label: 'Specific Items', icon: '🛍️', description: 'Trigger based on item purchases' },
  { value: 'time', label: 'Time-based', icon: '⏰', description: 'Trigger based on time/date' },
  { value: 'referral', label: 'Referrals', icon: '🤝', description: 'Trigger based on referrals' },
  { value: 'review', label: 'Reviews', icon: '⭐', description: 'Trigger based on reviews' },
  { value: 'birthday', label: 'Birthday', icon: '🎂', description: 'Trigger on customer birthday' }
];

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
  { value: 'between', label: 'Between' }
];

const ACTION_TYPES = [
  { value: 'points', label: 'Award Points', icon: '🎯' },
  { value: 'cashback', label: 'Cashback', icon: '💸' },
  { value: 'discount', label: 'Discount', icon: '🏷️' },
  { value: 'free_item', label: 'Free Item', icon: '🎁' },
  { value: 'tier_upgrade', label: 'Tier Upgrade', icon: '⬆️' }
];

export const RuleBuilder: React.FC<RuleBuilderProps> = ({ rules, onChange }) => {
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  const addRule = () => {
    const newRule: LoyaltyRule = {
      id: `rule-${Date.now()}`,
      type: 'spend',
      name: 'New Rule',
      description: '',
      condition: {
        operator: 'greater_than',
        value: 0
      },
      action: {
        type: 'points',
        value: 1
      },
      isActive: true,
      priority: rules.length + 1
    };
    onChange([...rules, newRule]);
    setExpandedRule(newRule.id);
  };

  const updateRule = (ruleId: string, updates: Partial<LoyaltyRule>) => {
    onChange(rules.map(rule => 
      rule.id === ruleId ? { ...rule, ...updates } : rule
    ));
  };

  const deleteRule = (ruleId: string) => {
    onChange(rules.filter(rule => rule.id !== ruleId));
    if (expandedRule === ruleId) {
      setExpandedRule(null);
    }
  };

  const getRuleTypeInfo = (type: string) => {
    return RULE_TYPES.find(rt => rt.value === type) || RULE_TYPES[0];
  };

  const getActionTypeInfo = (type: string) => {
    return ACTION_TYPES.find(at => at.value === type) || ACTION_TYPES[0];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Loyalty Rules</h3>
          <p className="text-sm text-muted-foreground">Define when and how customers earn rewards</p>
        </div>
        <Button onClick={addRule} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="w-12 h-12 text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium mb-2">No rules defined</h4>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              Create rules to define how customers earn points and rewards
            </p>
            <Button onClick={addRule}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, index) => {
            const ruleType = getRuleTypeInfo(rule.type);
            const actionType = getActionTypeInfo(rule.action.type);
            const isExpanded = expandedRule === rule.id;

            return (
              <Card key={rule.id} className={`transition-all ${isExpanded ? 'ring-2 ring-primary' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                        <Badge variant="outline" className="text-xs">
                          {index + 1}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{ruleType.icon}</span>
                        <div>
                          <h4 className="font-medium">{rule.name}</h4>
                          <p className="text-sm text-muted-foreground">{rule.description || ruleType.description}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <span>{ruleType.label}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="flex items-center">
                          <span className="mr-1">{actionType.icon}</span>
                          {rule.action.value} {rule.action.type}
                        </span>
                      </div>
                      
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={(checked) => updateRule(rule.id, { isActive: checked })}
                      />
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteRule(rule.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Rule Configuration */}
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <Target className="w-4 h-4" />
                          <h5 className="font-medium">Rule Configuration</h5>
                        </div>

                        <div>
                          <Label>Rule Name</Label>
                          <Input
                            value={rule.name}
                            onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                            placeholder="Enter rule name"
                          />
                        </div>

                        <div>
                          <Label>Description</Label>
                          <Textarea
                            value={rule.description}
                            onChange={(e) => updateRule(rule.id, { description: e.target.value })}
                            placeholder="Describe when this rule applies"
                          />
                        </div>

                        <div>
                          <Label>Rule Type</Label>
                          <Select 
                            value={rule.type} 
                            onValueChange={(value) => updateRule(rule.id, { type: value as any })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {RULE_TYPES.map(type => (
                                <SelectItem key={type.value} value={type.value}>
                                  <div className="flex items-center space-x-2">
                                    <span>{type.icon}</span>
                                    <span>{type.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Condition</Label>
                            <Select 
                              value={rule.condition.operator} 
                              onValueChange={(value) => updateRule(rule.id, {
                                condition: { ...rule.condition, operator: value as any }
                              })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {OPERATORS.map(op => (
                                  <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label>Value</Label>
                            <Input
                              type="number"
                              value={rule.condition.value}
                              onChange={(e) => updateRule(rule.id, {
                                condition: { ...rule.condition, value: Number(e.target.value) }
                              })}
                            />
                          </div>
                        </div>

                        {rule.condition.operator === 'between' && (
                          <div>
                            <Label>Upper Value</Label>
                            <Input
                              type="number"
                              value={rule.condition.secondaryValue || 0}
                              onChange={(e) => updateRule(rule.id, {
                                condition: { ...rule.condition, secondaryValue: Number(e.target.value) }
                              })}
                            />
                          </div>
                        )}
                      </div>

                      {/* Action Configuration */}
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <Gift className="w-4 h-4" />
                          <h5 className="font-medium">Action Configuration</h5>
                        </div>

                        <div>
                          <Label>Action Type</Label>
                          <Select 
                            value={rule.action.type} 
                            onValueChange={(value) => updateRule(rule.id, {
                              action: { ...rule.action, type: value as any }
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ACTION_TYPES.map(action => (
                                <SelectItem key={action.value} value={action.value}>
                                  <div className="flex items-center space-x-2">
                                    <span>{action.icon}</span>
                                    <span>{action.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>
                            {rule.action.type === 'points' ? 'Points to Award' :
                             rule.action.type === 'cashback' ? 'Cashback %' :
                             rule.action.type === 'discount' ? 'Discount %' :
                             'Value'}
                          </Label>
                          <Input
                            type="number"
                            value={rule.action.value}
                            onChange={(e) => updateRule(rule.id, {
                              action: { ...rule.action, value: Number(e.target.value) }
                            })}
                          />
                        </div>

                        {rule.action.type === 'points' && (
                          <div>
                            <Label>Points Multiplier (Optional)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={rule.action.multiplier || 1}
                              onChange={(e) => updateRule(rule.id, {
                                action: { ...rule.action, multiplier: Number(e.target.value) }
                              })}
                              placeholder="1.0"
                            />
                          </div>
                        )}

                        <div>
                          <Label>Priority</Label>
                          <Input
                            type="number"
                            value={rule.priority}
                            onChange={(e) => updateRule(rule.id, { priority: Number(e.target.value) })}
                            placeholder="1"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Higher numbers = higher priority
                          </p>
                        </div>

                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="flex items-start space-x-2">
                            <Info className="w-4 h-4 mt-0.5 text-blue-500" />
                            <div className="text-xs">
                              <p className="font-medium mb-1">Rule Preview:</p>
                              <p className="text-muted-foreground">
                                When customer {rule.condition.operator.replace('_', ' ')} {rule.condition.value}
                                {rule.condition.secondaryValue ? ` and ${rule.condition.secondaryValue}` : ''} 
                                {' '}via {rule.type}, they will receive {rule.action.value} {rule.action.type}
                                {rule.action.multiplier && rule.action.multiplier !== 1 ? ` (${rule.action.multiplier}x multiplier)` : ''}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};