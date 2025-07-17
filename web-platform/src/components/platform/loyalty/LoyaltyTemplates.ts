export interface LoyaltyTemplate {
  id: string;
  name: string;
  category: 'restaurant' | 'retail' | 'service' | 'general';
  description: string;
  icon: string;
  color: string;
  programType: string;
  defaultSettings: {
    rules: LoyaltyRule[];
    rewards: RewardTier[];
    notifications: NotificationSettings;
    advanced: AdvancedSettings;
  };
}

export interface LoyaltyRule {
  id: string;
  type: 'spend' | 'visit' | 'item' | 'time' | 'referral' | 'review' | 'birthday';
  name: string;
  description: string;
  condition: {
    operator: 'equals' | 'greater_than' | 'less_than' | 'between';
    value: number | string;
    secondaryValue?: number;
  };
  action: {
    type: 'points' | 'cashback' | 'discount' | 'free_item' | 'tier_upgrade';
    value: number;
    multiplier?: number;
    conditions?: string[];
  };
  isActive: boolean;
  priority: number;
}

export interface RewardTier {
  id: string;
  name: string;
  pointsRequired: number;
  rewardType: 'discount' | 'free_item' | 'cashback' | 'special_access';
  value: number;
  description: string;
  isActive: boolean;
}

export interface NotificationSettings {
  welcomeMessage: boolean;
  pointsEarned: boolean;
  rewardAvailable: boolean;
  tierUpgrade: boolean;
  expiryReminder: boolean;
  customTriggers: CustomTrigger[];
}

export interface CustomTrigger {
  id: string;
  name: string;
  condition: string;
  message: string;
  channel: 'email' | 'sms' | 'push' | 'in_app';
}

export interface AdvancedSettings {
  pointExpiry: {
    enabled: boolean;
    days: number;
    warningDays: number;
  };
  tierMaintenance: {
    enabled: boolean;
    period: 'monthly' | 'quarterly' | 'yearly';
    requirements: string;
  };
  referralBonus: {
    enabled: boolean;
    referrerPoints: number;
    refereePoints: number;
  };
  socialSharing: {
    enabled: boolean;
    platforms: string[];
    bonusPoints: number;
  };
}

export const LOYALTY_TEMPLATES: LoyaltyTemplate[] = [
  {
    id: 'restaurant-points',
    name: 'Restaurant Points Classic',
    category: 'restaurant',
    description: 'Traditional points-per-pound system perfect for restaurants and cafes',
    icon: '🍽️',
    color: 'bg-orange-500',
    programType: 'points',
    defaultSettings: {
      rules: [
        {
          id: 'spend-rule',
          type: 'spend',
          name: 'Points per Purchase',
          description: 'Earn 1 point for every £1 spent',
          condition: { operator: 'greater_than', value: 1 },
          action: { type: 'points', value: 1 },
          isActive: true,
          priority: 1
        },
        {
          id: 'birthday-rule',
          type: 'birthday',
          name: 'Birthday Bonus',
          description: 'Double points on birthday month',
          condition: { operator: 'equals', value: 'birthday_month' },
          action: { type: 'points', value: 2, multiplier: 2 },
          isActive: true,
          priority: 2
        }
      ],
      rewards: [
        { id: 'tier1', name: '£5 Off', pointsRequired: 100, rewardType: 'discount', value: 5, description: '£5 discount on your next order', isActive: true },
        { id: 'tier2', name: '£10 Off', pointsRequired: 200, rewardType: 'discount', value: 10, description: '£10 discount on your next order', isActive: true },
        { id: 'tier3', name: 'Free Dessert', pointsRequired: 150, rewardType: 'free_item', value: 1, description: 'Complimentary dessert of your choice', isActive: true }
      ],
      notifications: {
        welcomeMessage: true,
        pointsEarned: true,
        rewardAvailable: true,
        tierUpgrade: false,
        expiryReminder: true,
        customTriggers: []
      },
      advanced: {
        pointExpiry: { enabled: true, days: 365, warningDays: 30 },
        tierMaintenance: { enabled: false, period: 'yearly', requirements: '' },
        referralBonus: { enabled: true, referrerPoints: 50, refereePoints: 25 },
        socialSharing: { enabled: true, platforms: ['facebook', 'instagram'], bonusPoints: 10 }
      }
    }
  },
  {
    id: 'coffee-punch-card',
    name: 'Coffee Punch Card Digital',
    category: 'restaurant',
    description: 'Digital version of traditional punch cards - perfect for coffee shops',
    icon: '☕',
    color: 'bg-amber-600',
    programType: 'visit',
    defaultSettings: {
      rules: [
        {
          id: 'visit-rule',
          type: 'visit',
          name: 'Visit Counter',
          description: 'Earn 1 punch per visit',
          condition: { operator: 'equals', value: 1 },
          action: { type: 'points', value: 1 },
          isActive: true,
          priority: 1
        }
      ],
      rewards: [
        { id: 'free-coffee', name: 'Free Coffee', pointsRequired: 10, rewardType: 'free_item', value: 1, description: 'Free coffee of your choice', isActive: true }
      ],
      notifications: {
        welcomeMessage: true,
        pointsEarned: false,
        rewardAvailable: true,
        tierUpgrade: false,
        expiryReminder: false,
        customTriggers: []
      },
      advanced: {
        pointExpiry: { enabled: false, days: 0, warningDays: 0 },
        tierMaintenance: { enabled: false, period: 'yearly', requirements: '' },
        referralBonus: { enabled: false, referrerPoints: 0, refereePoints: 0 },
        socialSharing: { enabled: false, platforms: [], bonusPoints: 0 }
      }
    }
  },
  {
    id: 'vip-tiered',
    name: 'VIP Tiered Program',
    category: 'general',
    description: 'Multi-tier program with exclusive benefits for high-value customers',
    icon: '👑',
    color: 'bg-purple-600',
    programType: 'tiered',
    defaultSettings: {
      rules: [
        {
          id: 'bronze-tier',
          type: 'spend',
          name: 'Bronze Tier',
          description: '1x points for Bronze members',
          condition: { operator: 'between', value: 0, secondaryValue: 499 },
          action: { type: 'points', value: 1, multiplier: 1 },
          isActive: true,
          priority: 1
        },
        {
          id: 'silver-tier',
          type: 'spend',
          name: 'Silver Tier',
          description: '1.5x points for Silver members',
          condition: { operator: 'between', value: 500, secondaryValue: 1499 },
          action: { type: 'points', value: 1, multiplier: 1.5 },
          isActive: true,
          priority: 2
        },
        {
          id: 'gold-tier',
          type: 'spend',
          name: 'Gold Tier',
          description: '2x points for Gold members',
          condition: { operator: 'greater_than', value: 1500 },
          action: { type: 'points', value: 1, multiplier: 2 },
          isActive: true,
          priority: 3
        }
      ],
      rewards: [
        { id: 'bronze-reward', name: '5% Discount', pointsRequired: 100, rewardType: 'discount', value: 5, description: 'Bronze tier reward', isActive: true },
        { id: 'silver-reward', name: '10% Discount', pointsRequired: 150, rewardType: 'discount', value: 10, description: 'Silver tier reward', isActive: true },
        { id: 'gold-reward', name: '15% Discount + Free Delivery', pointsRequired: 200, rewardType: 'special_access', value: 15, description: 'Gold tier exclusive benefits', isActive: true }
      ],
      notifications: {
        welcomeMessage: true,
        pointsEarned: true,
        rewardAvailable: true,
        tierUpgrade: true,
        expiryReminder: true,
        customTriggers: []
      },
      advanced: {
        pointExpiry: { enabled: true, days: 730, warningDays: 60 },
        tierMaintenance: { enabled: true, period: 'yearly', requirements: 'Annual spend requirement' },
        referralBonus: { enabled: true, referrerPoints: 100, refereePoints: 50 },
        socialSharing: { enabled: true, platforms: ['facebook', 'instagram', 'twitter'], bonusPoints: 25 }
      }
    }
  },
  {
    id: 'cashback-simple',
    name: 'Simple Cashback',
    category: 'general',
    description: 'Straightforward cashback program - earn percentage back on every purchase',
    icon: '💰',
    color: 'bg-green-600',
    programType: 'cashback',
    defaultSettings: {
      rules: [
        {
          id: 'cashback-rule',
          type: 'spend',
          name: 'Cashback on Spend',
          description: 'Earn 2% cashback on all purchases',
          condition: { operator: 'greater_than', value: 1 },
          action: { type: 'cashback', value: 2 },
          isActive: true,
          priority: 1
        }
      ],
      rewards: [
        { id: 'cashback-reward', name: 'Cashback Redemption', pointsRequired: 10, rewardType: 'cashback', value: 10, description: 'Minimum £10 cashback redemption', isActive: true }
      ],
      notifications: {
        welcomeMessage: true,
        pointsEarned: true,
        rewardAvailable: true,
        tierUpgrade: false,
        expiryReminder: false,
        customTriggers: []
      },
      advanced: {
        pointExpiry: { enabled: false, days: 0, warningDays: 0 },
        tierMaintenance: { enabled: false, period: 'yearly', requirements: '' },
        referralBonus: { enabled: false, referrerPoints: 0, refereePoints: 0 },
        socialSharing: { enabled: false, platforms: [], bonusPoints: 0 }
      }
    }
  },
  {
    id: 'referral-focused',
    name: 'Referral Champion',
    category: 'general',
    description: 'Program focused on customer referrals and word-of-mouth marketing',
    icon: '🤝',
    color: 'bg-blue-600',
    programType: 'referral',
    defaultSettings: {
      rules: [
        {
          id: 'referral-rule',
          type: 'referral',
          name: 'Successful Referral',
          description: 'Earn points for successful referrals',
          condition: { operator: 'equals', value: 1 },
          action: { type: 'points', value: 100 },
          isActive: true,
          priority: 1
        },
        {
          id: 'referee-bonus',
          type: 'referral',
          name: 'New Customer Bonus',
          description: 'Welcome bonus for referred customers',
          condition: { operator: 'equals', value: 'new_customer' },
          action: { type: 'points', value: 50 },
          isActive: true,
          priority: 2
        }
      ],
      rewards: [
        { id: 'referral-reward', name: '£20 Credit', pointsRequired: 200, rewardType: 'cashback', value: 20, description: 'Account credit for active referrers', isActive: true }
      ],
      notifications: {
        welcomeMessage: true,
        pointsEarned: true,
        rewardAvailable: true,
        tierUpgrade: false,
        expiryReminder: false,
        customTriggers: []
      },
      advanced: {
        pointExpiry: { enabled: false, days: 0, warningDays: 0 },
        tierMaintenance: { enabled: false, period: 'yearly', requirements: '' },
        referralBonus: { enabled: true, referrerPoints: 100, refereePoints: 50 },
        socialSharing: { enabled: true, platforms: ['facebook', 'instagram', 'twitter', 'whatsapp'], bonusPoints: 20 }
      }
    }
  },
  {
    id: 'review-rewards',
    name: 'Review & Rewards',
    category: 'service',
    description: 'Incentivize customer reviews and feedback with rewards',
    icon: '⭐',
    color: 'bg-yellow-500',
    programType: 'engagement',
    defaultSettings: {
      rules: [
        {
          id: 'review-rule',
          type: 'review',
          name: 'Review Reward',
          description: 'Earn points for leaving reviews',
          condition: { operator: 'equals', value: 1 },
          action: { type: 'points', value: 25 },
          isActive: true,
          priority: 1
        },
        {
          id: 'photo-review-bonus',
          type: 'review',
          name: 'Photo Review Bonus',
          description: 'Extra points for reviews with photos',
          condition: { operator: 'equals', value: 'with_photo' },
          action: { type: 'points', value: 15 },
          isActive: true,
          priority: 2
        }
      ],
      rewards: [
        { id: 'review-reward', name: '£10 Discount', pointsRequired: 100, rewardType: 'discount', value: 10, description: 'Reward for active reviewers', isActive: true }
      ],
      notifications: {
        welcomeMessage: true,
        pointsEarned: true,
        rewardAvailable: true,
        tierUpgrade: false,
        expiryReminder: false,
        customTriggers: []
      },
      advanced: {
        pointExpiry: { enabled: true, days: 180, warningDays: 14 },
        tierMaintenance: { enabled: false, period: 'yearly', requirements: '' },
        referralBonus: { enabled: false, referrerPoints: 0, refereePoints: 0 },
        socialSharing: { enabled: true, platforms: ['google', 'facebook', 'tripadvisor'], bonusPoints: 10 }
      }
    }
  }
];

export const getTemplatesByCategory = (category?: string) => {
  if (!category) return LOYALTY_TEMPLATES;
  return LOYALTY_TEMPLATES.filter(template => template.category === category);
};

export const getTemplateById = (id: string) => {
  return LOYALTY_TEMPLATES.find(template => template.id === id);
};