
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { useState } from "react";

export const Navigation = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm animate-fade-in">
      <div className="container mx-auto px-6">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center">
            <Link to="/" className="hover:scale-105 hover-glow transition-all duration-300">
              <img 
                src="/lovable-uploads/ae344ce5-1c9f-41c8-b990-94ddff083a5a.png" 
                alt="Fynlo Logo" 
                className="h-24 w-auto md:h-28 animate-float"
              />
            </Link>
          </div>
          
          {/* Professional Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link 
              to="/" 
              className={`font-medium transition-all duration-300 hover:scale-105 hover:-rotate-1 hover-lift animate-slide-in ${
                isActive('/') 
                  ? 'text-brand-orange' 
                  : 'text-brand-black hover:text-brand-orange'
              }`}
            >
              Home
            </Link>
            <Link 
              to="/platform" 
              className={`font-medium transition-all duration-300 hover:scale-105 hover:-rotate-1 hover-lift animate-slide-in ${
                isActive('/platform') 
                  ? 'text-brand-orange' 
                  : 'text-brand-black hover:text-brand-orange'
              }`}
              style={{ animationDelay: '0.1s' }}
            >
              Platform
            </Link>
            <Link 
              to="/restaurant" 
              className={`font-medium transition-all duration-300 hover:scale-105 hover:-rotate-1 hover-lift animate-slide-in ${
                isActive('/restaurant') 
                  ? 'text-brand-orange' 
                  : 'text-brand-black hover:text-brand-orange'
              }`}
              style={{ animationDelay: '0.15s' }}
            >
              Restaurant
            </Link>
            <Link 
              to="/solutions" 
              className={`font-medium transition-all duration-300 hover:scale-105 hover:-rotate-1 hover-lift animate-slide-in ${
                isActive('/solutions') 
                  ? 'text-brand-orange' 
                  : 'text-brand-black hover:text-brand-orange'
              }`}
              style={{ animationDelay: '0.2s' }}
            >
              Solutions
            </Link>
            <Link 
              to="/pricing" 
              className={`font-medium transition-all duration-300 hover:scale-105 hover:-rotate-1 hover-lift animate-slide-in ${
                isActive('/pricing') 
                  ? 'text-brand-orange' 
                  : 'text-brand-black hover:text-brand-orange'
              }`}
              style={{ animationDelay: '0.3s' }}
            >
              Pricing
            </Link>
            <Link 
              to="/resources" 
              className={`font-medium transition-all duration-300 hover:scale-105 hover:-rotate-1 hover-lift animate-slide-in ${
                isActive('/resources') 
                  ? 'text-brand-orange' 
                  : 'text-brand-black hover:text-brand-orange'
              }`}
              style={{ animationDelay: '0.4s' }}
            >
              Resources
            </Link>
          </div>

          {/* Desktop Sign In Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {!user && (
              <>
                <Button 
                  variant="ghost" 
                  onClick={handleGetStarted}
                  className="text-brand-black hover:text-brand-orange hover:bg-orange-50 font-medium px-4 py-2 transition-all duration-300 hover:scale-105 hover-lift animate-scale-in"
                  style={{ animationDelay: '0.5s' }}
                >
                  Sign In
                </Button>
                <Button 
                  onClick={handleGetStarted}
                  className="bg-brand-orange hover:bg-orange-600 text-white font-medium px-6 py-2 shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-lg hover-glow animate-scale-in"
                  style={{ animationDelay: '0.6s' }}
                >
                  Get Started
                </Button>
              </>
            )}
          </div>

          {/* Mobile Hamburger Menu */}
          <div className="md:hidden">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-brand-black hover:text-brand-orange h-12 w-12">
                  <Menu className="h-8 w-8" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <nav className="flex flex-col space-y-4 mt-8">
                  <Link 
                    to="/" 
                    onClick={() => setIsOpen(false)}
                    className={`text-lg font-medium transition-colors p-3 rounded-lg ${
                      isActive('/') 
                        ? 'text-brand-orange bg-orange-50' 
                        : 'text-brand-black hover:text-brand-orange hover:bg-orange-50'
                    }`}
                  >
                    Home
                  </Link>
                  <Link 
                    to="/platform" 
                    onClick={() => setIsOpen(false)}
                    className={`text-lg font-medium transition-colors p-3 rounded-lg ${
                      isActive('/platform') 
                        ? 'text-brand-orange bg-orange-50' 
                        : 'text-brand-black hover:text-brand-orange hover:bg-orange-50'
                    }`}
                  >
                    Platform
                  </Link>
                  <Link 
                    to="/restaurant" 
                    onClick={() => setIsOpen(false)}
                    className={`text-lg font-medium transition-colors p-3 rounded-lg ${
                      isActive('/restaurant') 
                        ? 'text-brand-orange bg-orange-50' 
                        : 'text-brand-black hover:text-brand-orange hover:bg-orange-50'
                    }`}
                  >
                    Restaurant
                  </Link>
                  <Link 
                    to="/solutions" 
                    onClick={() => setIsOpen(false)}
                    className={`text-lg font-medium transition-colors p-3 rounded-lg ${
                      isActive('/solutions') 
                        ? 'text-brand-orange bg-orange-50' 
                        : 'text-brand-black hover:text-brand-orange hover:bg-orange-50'
                    }`}
                  >
                    Solutions
                  </Link>
                  <Link 
                    to="/pricing" 
                    onClick={() => setIsOpen(false)}
                    className={`text-lg font-medium transition-colors p-3 rounded-lg ${
                      isActive('/pricing') 
                        ? 'text-brand-orange bg-orange-50' 
                        : 'text-brand-black hover:text-brand-orange hover:bg-orange-50'
                    }`}
                  >
                    Pricing
                  </Link>
                  <Link 
                    to="/resources" 
                    onClick={() => setIsOpen(false)}
                    className={`text-lg font-medium transition-colors p-3 rounded-lg ${
                      isActive('/resources') 
                        ? 'text-brand-orange bg-orange-50' 
                        : 'text-brand-black hover:text-brand-orange hover:bg-orange-50'
                    }`}
                  >
                    Resources
                  </Link>
                  
                  {!user && (
                    <div className="flex flex-col space-y-3 pt-6 border-t">
                      <Button 
                        variant="ghost" 
                        onClick={() => {
                          handleGetStarted();
                          setIsOpen(false);
                        }}
                        className="text-brand-black hover:text-brand-orange hover:bg-orange-50 font-medium justify-start"
                      >
                        Sign In
                      </Button>
                      <Button 
                        onClick={() => {
                          handleGetStarted();
                          setIsOpen(false);
                        }}
                        className="bg-brand-orange hover:bg-orange-600 text-white font-medium"
                      >
                        Get Started
                      </Button>
                    </div>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};
