
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Smartphone, CreditCard, BarChart3, Users } from "lucide-react";
import mobilePosImage from "@/assets/mobile-pos-professional.jpg";
import paymentTerminalImage from "@/assets/payment-terminal-professional.jpg";
import analyticsDashboardImage from "@/assets/analytics-dashboard-professional.jpg";
import staffManagementImage from "@/assets/staff-management-professional.jpg";

export const ProductShowcase = () => {
  const products = [
    {
      icon: <Smartphone className="h-8 w-8" />,
      title: "Mobile POS",
      description: "Take payments anywhere with our mobile-first approach",
      image: mobilePosImage,
      features: ["Contactless payments", "Inventory sync", "Real-time reporting"]
    },
    {
      icon: <CreditCard className="h-8 w-8" />,
      title: "Payment Terminal",
      description: "Professional-grade hardware for high-volume businesses",
      image: paymentTerminalImage,
      features: ["EMV compliant", "NFC enabled", "Receipt printing"]
    },
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: "Analytics Dashboard",
      description: "Comprehensive insights to grow your business",
      image: analyticsDashboardImage,
      features: ["Sales analytics", "Customer insights", "Trend analysis"]
    },
    {
      icon: <Users className="h-8 w-8" />,
      title: "Staff Management",
      description: "Manage your team with integrated scheduling tools",
      image: staffManagementImage,
      features: ["Time tracking", "Performance metrics", "Payroll integration"]
    }
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 bg-orange-100 text-brand-orange hover:bg-orange-200 hover:scale-105 transition-all duration-300">
            Product Showcase
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-brand-black mb-6 hover:text-brand-orange transition-colors duration-500">
            Everything You Need
            <span className="block text-brand-orange hover:text-orange-600 hover:scale-105 transition-all duration-300">
              In One Platform
            </span>
          </h2>
          <p className="text-xl text-brand-gray max-w-3xl mx-auto">
            Discover our comprehensive suite of business solutions designed to streamline your operations
          </p>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {products.map((product, index) => (
            <Card 
              key={index} 
              className="overflow-hidden hover:shadow-xl hover:-translate-y-2 hover:rotate-1 transition-all duration-500 group"
              style={{
                animationDelay: `${index * 0.1}s`
              }}
            >
              <div className="aspect-video overflow-hidden">
                <img 
                  src={product.image} 
                  alt={product.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <CardContent className="p-6">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mr-4 group-hover:bg-brand-orange group-hover:text-white group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                    <span className="text-brand-orange group-hover:text-white group-hover:animate-pulse">
                      {product.icon}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-brand-black group-hover:text-brand-orange transition-colors duration-300">
                    {product.title}
                  </h3>
                </div>
                <p className="text-brand-gray mb-4 group-hover:text-brand-black transition-colors duration-300">
                  {product.description}
                </p>
                <div className="space-y-2 mb-6">
                  {product.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center text-sm text-brand-gray hover:transform hover:translate-x-2 transition-all duration-300 group/item">
                      <div className="w-2 h-2 bg-brand-orange rounded-full mr-3 group-hover/item:bg-orange-600 group-hover/item:scale-125 transition-all duration-300"></div>
                      <span className="group-hover/item:text-brand-black transition-colors duration-300">{feature}</span>
                    </div>
                  ))}
                </div>
                <Button 
                  variant="outline" 
                  className="w-full border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white transition-all duration-300 hover:scale-105 group-hover:shadow-lg"
                >
                  Learn More
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <div className="bg-gradient-to-r from-brand-black to-slate-800 rounded-2xl p-12 text-white hover:shadow-2xl hover:scale-105 transition-all duration-500">
            <h3 className="text-3xl font-bold mb-4">See our products in action</h3>
            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Schedule a personalized demo to discover how our solutions can transform your business
            </p>
            <Button 
              size="lg" 
              className="bg-brand-orange hover:bg-orange-600 text-white px-8 py-4 hover:scale-105 transition-all duration-300"
            >
              Schedule Demo
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
