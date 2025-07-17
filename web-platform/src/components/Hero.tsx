
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Navigation } from "@/components/Navigation";

export const Hero = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  return (
    <section className="min-h-screen bg-white">
      <Navigation />

      {/* Hero Content with Brand Colors */}
      <div className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-brand-black leading-tight">
            Enterprise Payment Solutions
            <span className="block text-brand-orange mt-2">
              Built for Scale
            </span>
          </h1>
          
          <p className="text-lg md:text-xl mb-12 text-brand-gray max-w-3xl mx-auto leading-relaxed">
            Empowering restaurant technology companies with enterprise-grade, multi-tenant POS infrastructure. 
            Trusted by industry leaders with competitive 1% processing rates and zero hardware investment.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Button 
              size="lg" 
              className="px-8 py-4 text-lg font-semibold bg-brand-orange hover:bg-orange-600 text-white"
              onClick={handleGetStarted}
            >
              Get Started
            </Button>
            
            <Button 
              variant="outline" 
              size="lg"
              className="px-8 py-4 text-lg font-semibold border-2 border-brand-black hover:border-brand-orange hover:text-brand-orange text-brand-black"
              onClick={() => navigate('/platform')}
            >
              Platform Overview
            </Button>
          </div>

          <div className="mt-8 text-sm text-brand-gray font-medium">
            Trusted by restaurant technology leaders across 12+ markets
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="p-8 rounded-xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 hover:shadow-lg transition-shadow duration-300">
              <div className="text-4xl font-bold text-brand-orange mb-3">1%</div>
              <div className="text-brand-black font-medium">Processing Rate</div>
              <div className="text-sm text-brand-gray mt-1">vs 2.9% Industry Standard</div>
            </div>
            <div className="p-8 rounded-xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 hover:shadow-lg transition-shadow duration-300">
              <div className="text-4xl font-bold text-green-600 mb-3">Zero</div>
              <div className="text-brand-black font-medium">Hardware Investment</div>
              <div className="text-sm text-brand-gray mt-1">Cloud-Based Infrastructure</div>
            </div>
            <div className="p-8 rounded-xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 hover:shadow-lg transition-shadow duration-300">
              <div className="text-4xl font-bold text-purple-600 mb-3">99.9%</div>
              <div className="text-brand-black font-medium">Uptime Guarantee</div>
              <div className="text-sm text-brand-gray mt-1">Enterprise-Grade Reliability</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
