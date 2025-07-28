import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, Check, X } from 'lucide-react';

interface UpgradePromptProps {
  title: string;
  description: string;
  requiredPlan: 'beta' | 'omega';
  features: string[];
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  title,
  description,
  requiredPlan,
  features
}) => {
  const planInfo = {
    beta: {
      name: 'Beta',
      price: '£59.99/month',
      color: 'bg-gray-100 text-gray-800'
    },
    omega: {
      name: 'Omega',
      price: '£99.99/month', 
      color: 'bg-yellow-100 text-yellow-800'
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <ArrowUpRight className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <p className="text-gray-600">{description}</p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="text-center">
            <Badge className={planInfo[requiredPlan].color}>
              Requires {planInfo[requiredPlan].name} Plan
            </Badge>
            <p className="text-sm text-gray-500 mt-2">
              Starting at {planInfo[requiredPlan].price}
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">Features included:</h4>
            <ul className="space-y-2">
              {features.map((feature, index) => (
                <li key={index} className="flex items-center text-sm">
                  <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col space-y-3">
            <Button className="w-full">
              <ArrowUpRight className="w-4 h-4 mr-2" />
              Upgrade to {planInfo[requiredPlan].name}
            </Button>
            <Button variant="outline" className="w-full">
              Learn More
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};