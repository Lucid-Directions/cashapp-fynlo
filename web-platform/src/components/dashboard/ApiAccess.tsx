import React from 'react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { UpgradePrompt } from './UpgradePrompt';

export const ApiAccess = () => {
  const { hasFeature } = useFeatureAccess();

  if (!hasFeature('api_access')) {
    return (
      <UpgradePrompt
        title="API Access"
        description="Integrate with third-party applications using our powerful API."
        requiredPlan="omega"
        features={[
          'Full API access',
          'Webhook support',
          'API key management',
          'Usage analytics',
          'Developer documentation',
          'Priority support'
        ]}
      />
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">API Access</h1>
      <p className="text-gray-600">Manage your API integrations</p>
      {/* API access implementation will be added */}
    </div>
  );
};