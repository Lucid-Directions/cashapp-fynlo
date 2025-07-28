
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export const CallToAction = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  return (
    <section className="py-24 bg-brand-orange">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
          Start Building Your
          <span className="block">Restaurant Technology Platform</span>
        </h2>
        <p className="text-xl text-orange-100 mb-12 max-w-2xl mx-auto">
          Get access to enterprise-grade POS infrastructure with competitive processing rates and zero hardware investment. Join the restaurant technology revolution today.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-12">
          <Button 
            size="lg" 
            className="px-8 py-4 text-lg font-semibold bg-white text-brand-orange hover:bg-gray-100"
            onClick={handleGetStarted}
          >
            Get Started Today
          </Button>
          
          <Button 
            variant="outline" 
            size="lg"
            className="px-8 py-4 text-lg font-semibold border-2 border-white text-white hover:bg-white hover:text-brand-orange"
            onClick={() => navigate('/platform')}
          >
            View Platform Demo
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-white">
          <div>
            <div className="text-3xl font-bold mb-2">Quick Setup</div>
            <div className="text-orange-100">Get started in minutes, not months</div>
          </div>
          <div>
            <div className="text-3xl font-bold mb-2">Expert Support</div>
            <div className="text-orange-100">Dedicated technical assistance</div>
          </div>
          <div>
            <div className="text-3xl font-bold mb-2">Proven Results</div>
            <div className="text-orange-100">Trusted by industry leaders</div>
          </div>
        </div>
      </div>
    </section>
  );
};
