
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const BusinessSolutions = () => {
  const businessTypes = [
    {
      title: "Retail",
      description: "Complete solutions for retail businesses",
      image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80",
      features: ["Inventory management", "Customer tracking", "Multi-location support"]
    },
    {
      title: "Food and Services",
      description: "Perfect for restaurants and service businesses",  
      image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80",
      features: ["Table management", "Order tracking", "Staff scheduling"]
    },
    {
      title: "Creative",
      description: "Tailored for creative professionals and studios",
      image: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=800&q=80", 
      features: ["Project billing", "Client management", "Portfolio integration"]
    }
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-6">
            Solutions for your business
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Whether you're in retail, food service, or creative industries, we have the right solution for your business needs.
          </p>
        </div>

        {/* Business Types Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {businessTypes.map((business, index) => (
            <Card key={index} className="overflow-hidden hover:shadow-xl transition-all duration-300 group hover:scale-105 hover:-rotate-1">
              <div className="aspect-video overflow-hidden">
                <img 
                  src={business.image} 
                  alt={business.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-3">{business.title}</h3>
                <p className="text-slate-600 mb-4">{business.description}</p>
                <ul className="space-y-2 mb-6">
                  {business.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center text-sm text-slate-600">
                      <div className="w-2 h-2 bg-brand-orange rounded-full mr-3"></div>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white transition-all duration-300 hover:scale-105">
                  Learn More
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Business Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h3 className="text-3xl font-bold text-slate-900 mb-6">
              We understand that every business has different needs
            </h3>
            <p className="text-lg text-slate-600 mb-6">
              That's why we offer tailored solutions that grow with your business. From simple card readers to comprehensive POS systems, we have everything you need to succeed.
            </p>
            <div className="space-y-4">
              <div className="flex items-start space-x-3 hover:transform hover:translate-x-2 transition-all duration-300">
                <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <div className="w-2 h-2 bg-brand-orange rounded-full"></div>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Scalable Solutions</h4>
                  <p className="text-slate-600">Start small and expand as your business grows</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 hover:transform hover:translate-x-2 transition-all duration-300">
                <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <div className="w-2 h-2 bg-brand-orange rounded-full"></div>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Expert Support</h4>
                  <p className="text-slate-600">Get help when you need it with our 24/7 support team</p>
                </div>  
              </div>
              <div className="flex items-start space-x-3 hover:transform hover:translate-x-2 transition-all duration-300">
                <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <div className="w-2 h-2 bg-brand-orange rounded-full"></div>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Integrated Ecosystem</h4>
                  <p className="text-slate-600">Connect with the tools you already use</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="lg:pl-8">
            <img 
              src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80"
              alt="Business owner using payment system"
              className="w-full h-auto rounded-2xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-500"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
