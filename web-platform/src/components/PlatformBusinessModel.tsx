
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle } from "lucide-react";

export const PlatformBusinessModel = () => {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* More for your business section */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-8">More for your business</h2>
        </div>

        {/* Three column feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          <div className="text-center p-8 hover:transform hover:scale-105 hover:-rotate-1 transition-all duration-300">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6 hover:bg-brand-orange hover:animate-pulse transition-all duration-300">
              <div className="text-2xl">📊</div>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-4">Real-time Analytics</h3>
            <p className="text-slate-600 mb-6">
              Track your business performance with detailed insights and reporting tools that help you make informed decisions.
            </p>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-center hover:transform hover:translate-x-1 transition-all duration-200">
                <CheckCircle className="w-4 h-4 text-brand-orange mr-2" />
                Sales reporting
              </div>
              <div className="flex items-center justify-center hover:transform hover:translate-x-1 transition-all duration-200">
                <CheckCircle className="w-4 h-4 text-brand-orange mr-2" />
                Customer insights  
              </div>
              <div className="flex items-center justify-center hover:transform hover:translate-x-1 transition-all duration-200">
                <CheckCircle className="w-4 h-4 text-brand-orange mr-2" />
                Trend analysis
              </div>
            </div>
          </div>

          <div className="text-center p-8 hover:transform hover:scale-105 hover:-rotate-1 transition-all duration-300">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6 hover:bg-brand-orange hover:animate-pulse transition-all duration-300">
              <div className="text-2xl">🔄</div>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-4">Inventory Management</h3>
            <p className="text-slate-600 mb-6">
              Keep track of your stock levels, set up automatic reorder points, and never run out of your best-selling items.
            </p>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-center hover:transform hover:translate-x-1 transition-all duration-200">
                <CheckCircle className="w-4 h-4 text-brand-orange mr-2" />
                Stock tracking
              </div>
              <div className="flex items-center justify-center hover:transform hover:translate-x-1 transition-all duration-200">
                <CheckCircle className="w-4 h-4 text-brand-orange mr-2" />
                Auto reorders
              </div>
              <div className="flex items-center justify-center hover:transform hover:translate-x-1 transition-all duration-200">
                <CheckCircle className="w-4 h-4 text-brand-orange mr-2" />
                Multi-location sync
              </div>
            </div>
          </div>

          <div className="text-center p-8 hover:transform hover:scale-105 hover:-rotate-1 transition-all duration-300">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6 hover:bg-brand-orange hover:animate-pulse transition-all duration-300">
              <div className="text-2xl">👥</div>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-4">Customer Management</h3>
            <p className="text-slate-600 mb-6">
              Build stronger relationships with your customers through integrated CRM tools and loyalty programs.
            </p>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-center hover:transform hover:translate-x-1 transition-all duration-200">
                <CheckCircle className="w-4 h-4 text-brand-orange mr-2" />
                Customer profiles
              </div>
              <div className="flex items-center justify-center hover:transform hover:translate-x-1 transition-all duration-200">
                <CheckCircle className="w-4 h-4 text-brand-orange mr-2" />
                Loyalty rewards
              </div>
              <div className="flex items-center justify-center hover:transform hover:translate-x-1 transition-all duration-200">
                <CheckCircle className="w-4 h-4 text-brand-orange mr-2" />
                Email marketing
              </div>
            </div>
          </div>
        </div>

        {/* Call to action section */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-12 text-center text-white hover:shadow-2xl hover:scale-105 transition-all duration-500">
          <h3 className="text-3xl font-bold mb-4">Ready to take your business to the next level?</h3>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Let us know how we can help. Get personalized recommendations for your business needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-brand-orange text-white hover:bg-orange-600 px-8 py-4 hover:scale-105 transition-all duration-300">
              Get Started Today
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-slate-900 px-8 py-4 hover:scale-105 transition-all duration-300">
              Schedule a Demo
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
