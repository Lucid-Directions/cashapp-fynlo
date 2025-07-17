
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, Handshake } from "lucide-react";

export const IndustryPartnerships = () => {
  const partners = [
    {
      name: "Stripe",
      logo: "https://images.unsplash.com/photo-1611224923853-80b023f02d71?auto=format&fit=crop&w=100&q=80",
      description: "Secure payment processing infrastructure",
      category: "Payment Processing"
    },
    {
      name: "QuickBooks",
      logo: "https://images.unsplash.com/photo-1611224923853-80b023f02d71?auto=format&fit=crop&w=100&q=80",
      description: "Seamless accounting integration",
      category: "Accounting"
    },
    {
      name: "Shopify",
      logo: "https://images.unsplash.com/photo-1611224923853-80b023f02d71?auto=format&fit=crop&w=100&q=80",
      description: "E-commerce platform connectivity",
      category: "E-commerce"
    },
    {
      name: "Square",
      logo: "https://images.unsplash.com/photo-1611224923853-80b023f02d71?auto=format&fit=crop&w=100&q=80",
      description: "Hardware and software solutions",
      category: "POS Systems"
    },
    {
      name: "Mailchimp",
      logo: "https://images.unsplash.com/photo-1611224923853-80b023f02d71?auto=format&fit=crop&w=100&q=80",
      description: "Customer relationship management",
      category: "Marketing"
    },
    {
      name: "Slack",
      logo: "https://images.unsplash.com/photo-1611224923853-80b023f02d71?auto=format&fit=crop&w=100&q=80",
      description: "Team communication and notifications",
      category: "Communication"
    }
  ];

  const benefits = [
    "Seamless data synchronization across platforms",
    "Reduced manual work and data entry",
    "Enhanced functionality through integrations",
    "Streamlined workflows and processes",
    "Real-time updates and notifications",
    "Centralized business management"
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 bg-orange-100 text-brand-orange hover:bg-orange-200 hover:scale-105 transition-all duration-300">
            Industry Partnerships
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-brand-black mb-6 hover:text-brand-orange transition-colors duration-500">
            Integrated with
            <span className="block text-brand-orange hover:text-orange-600 hover:scale-105 transition-all duration-300">
              Your Favorite Tools
            </span>
          </h2>
          <p className="text-xl text-brand-gray max-w-3xl mx-auto">
            Connect with the tools you already use to create a unified business ecosystem
          </p>
        </div>

        {/* Partners Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-16">
          {partners.map((partner, index) => (
            <Card 
              key={index} 
              className="p-6 text-center hover:shadow-xl hover:-translate-y-2 hover:rotate-1 transition-all duration-500 group cursor-pointer"
              style={{
                animationDelay: `${index * 0.1}s`
              }}
            >
              <CardContent className="p-0">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-orange-100 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                  <Handshake className="h-8 w-8 text-brand-gray group-hover:text-brand-orange group-hover:animate-pulse transition-colors duration-300" />
                </div>
                <h3 className="font-semibold text-brand-black mb-2 group-hover:text-brand-orange transition-colors duration-300">
                  {partner.name}
                </h3>
                <p className="text-xs text-brand-gray mb-2 group-hover:text-brand-black transition-colors duration-300">
                  {partner.category}
                </p>
                <p className="text-xs text-brand-gray group-hover:text-brand-black transition-colors duration-300">
                  {partner.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Integration Benefits */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h3 className="text-3xl font-bold text-brand-black mb-6 hover:text-brand-orange transition-colors duration-300">
              Why integrate with Fynlo?
            </h3>
            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <div 
                  key={index} 
                  className="flex items-start space-x-3 hover:transform hover:translate-x-2 transition-all duration-300 group"
                  style={{
                    animationDelay: `${index * 0.1}s`
                  }}
                >
                  <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-brand-orange group-hover:scale-110 transition-all duration-300">
                    <CheckCircle className="w-4 h-4 text-brand-orange group-hover:text-white group-hover:animate-pulse transition-colors duration-300" />
                  </div>
                  <span className="text-brand-gray group-hover:text-brand-black transition-colors duration-300">
                    {benefit}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="lg:pl-8">
            <div className="bg-gradient-to-br from-brand-orange to-orange-600 rounded-2xl p-8 text-white hover:shadow-2xl hover:scale-105 transition-all duration-500">
              <h4 className="text-2xl font-bold mb-4">Ready to connect your tools?</h4>
              <p className="text-orange-100 mb-6">
                Start integrating with your existing workflow today and experience the power of unified business management.
              </p>
              <Button 
                size="lg" 
                className="bg-white text-brand-orange hover:bg-gray-100 hover:text-orange-600 hover:scale-105 transition-all duration-300"
              >
                View All Integrations
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <div className="bg-gradient-to-r from-brand-black to-slate-800 rounded-2xl p-12 text-white hover:shadow-2xl hover:scale-105 transition-all duration-500">
            <h3 className="text-3xl font-bold mb-4">Don't see your tool?</h3>
            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              We're constantly adding new integrations. Let us know what you need and we'll make it happen.
            </p>
            <Button 
              variant="outline" 
              size="lg" 
              className="border-white text-white hover:bg-white hover:text-brand-black px-8 py-4 hover:scale-105 transition-all duration-300"
            >
              Request Integration
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
