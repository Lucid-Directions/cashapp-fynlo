
import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, User } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export const UserButton = () => {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed Out",
      description: "You have been successfully signed out.",
    });
  };

  if (!user) return null;

  return (
    <div className="flex items-center space-x-2">
      <div className="flex items-center space-x-2 text-sm text-gray-700">
        <User className="w-4 h-4" />
        <span>{user.email}</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSignOut}
        className="hover:bg-red-50 hover:border-red-300"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </Button>
    </div>
  );
};
