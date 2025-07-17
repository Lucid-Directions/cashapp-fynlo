import React, { useState } from 'react';
import { Sidebar, SidebarContent, SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard,
  Building2,
  PoundSterling,
  Settings,
  MessageSquare,
  ChevronLeft,
  Crown,
  LogOut,
  Heart
} from 'lucide-react';

interface PlatformLayoutProps {
  children: React.ReactNode;
}

// 👤 PLATFORM OWNER LAYOUT - For platform administrators only
export const PlatformLayout: React.FC<PlatformLayoutProps> = ({ children }) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <PlatformSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <PlatformTopBar />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

const PlatformSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname;

  const navigationItems = [
    {
      title: 'Dashboard',
      href: '/platform/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: 'Restaurants',
      href: '/platform/restaurants',
      icon: Building2,
    },
    {
      title: 'Loyalty Programs',
      href: '/platform/loyalty',
      icon: Heart,
    },
    {
      title: 'Financial',
      href: '/platform/financial',
      icon: PoundSterling,
    },
    {
      title: 'Configuration',
      href: '/platform/configuration',
      icon: Settings,
    },
    {
      title: 'Support',
      href: '/platform/support',
      icon: MessageSquare,
    },
  ];

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"}>
      <SidebarContent className="bg-white border-r">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Crown className="h-4 w-4 text-white" />
            </div>
            {!collapsed && (
              <div>
                <h2 className="font-semibold text-sm">Fynlo Platform</h2>
                <Badge variant="secondary" className="text-xs">Admin</Badge>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            {navigationItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${isActive(item.href) 
                    ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span>{item.title}</span>}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Collapse Toggle */}
        <div className="p-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronLeft className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Collapse</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
};

const PlatformTopBar = () => {
  const { user, signOut } = useAuth();

  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="lg:hidden" />
        <div className="hidden sm:block">
          <h1 className="text-lg font-semibold text-gray-900">Platform Administration</h1>
          <p className="text-sm text-gray-500">Manage all restaurants and platform settings</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Platform owner indicator */}
        <Badge className="bg-purple-100 text-purple-800 border-purple-200">
          <Crown className="h-3 w-3 mr-1" />
          Platform Owner
        </Badge>

        {/* User menu */}
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.user_metadata?.avatar_url} />
            <AvatarFallback>
              {user?.email?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium">{user?.user_metadata?.full_name || 'Platform Admin'}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};