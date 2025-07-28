import React from 'react';
import { Bell, Search, Maximize, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Restaurant } from '../types';

interface RestaurantTopBarProps {
  restaurant: Restaurant;
}

export const RestaurantTopBar: React.FC<RestaurantTopBarProps> = ({ restaurant }) => {
  const currentTime = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const currentDate = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side - Search */}
        <div className="flex items-center space-x-4 flex-1">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search orders, menu items..."
              className="pl-10 bg-gray-50 border-gray-200"
            />
          </div>
        </div>

        {/* Center - Date and Time */}
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>{currentDate} • {currentTime}</span>
          </div>
          <Badge variant="outline" className="text-green-600 border-green-200">
            OPEN
          </Badge>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center space-x-3">
          {/* Notifications */}
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="w-5 h-5" />
            <Badge className="absolute -top-1 -right-1 w-5 h-5 rounded-full p-0 flex items-center justify-center text-xs">
              3
            </Badge>
          </Button>

          {/* Fullscreen toggle */}
          <Button variant="ghost" size="sm">
            <Maximize className="w-5 h-5" />
          </Button>

          {/* Restaurant status */}
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{restaurant.name}</p>
            <p className="text-xs text-gray-500">Restaurant Dashboard</p>
          </div>
        </div>
      </div>
    </header>
  );
};