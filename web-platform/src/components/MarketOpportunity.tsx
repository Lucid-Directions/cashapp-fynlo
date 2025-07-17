
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, DollarSign } from "lucide-react";

export const MarketOpportunity = () => {
  const opportunities = [
    {
      icon: <TrendingUp className="h-8 w-8" />,
      title: "Growing Market",
      value: "$45B",
      description: "Global POS market expected to reach $45 billion by 2027",
      color: "bg-orange-100 text-brand-orange"
    },
    {
      icon: <Users className="h-8 w-8" />,
      title: "Small Businesses",
      value: "33M",
      description: "Small businesses in the US need modern payment solutions",
      color: "bg-slate-100 text-brand-black"
    },
    {
      icon: <DollarSign className="h-8 w-8" />,
      title: "Cost Savings",
      value: "40%",
      description: "Average cost reduction with integrated solutions",
      color: "bg-orange-100 text-brand-orange"
    }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 bg-orange-100 text-brand-orange hover:bg-orange-200 hover:scale-105 transition-all duration-300">
            Market Opportunity
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-brand-black mb-6 hover:text-brand-orange transition-colors duration-500">
            The Future of Business
            <span className="block text-brand-orange hover:text-orange-600 hover:scale-105 transition-all duration-300">
              Payments is Here
            </span>
          </h2>
          <p className="text-xl text-brand-gray max-w-3xl mx-auto">
            Join the revolution in payment processing and business management solutions
          </p>
        </div>

        {/* Opportunity Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {opportunities.map((opportunity, index) => (
            <Card 
              key={index} 
              className="p-8 text-center hover:shadow-xl hover:-translate-y-3 hover:rotate-1 transition-all duration-500 group cursor-pointer"
              style={{
                animationDelay: `${index * 0.1}s`
              }}
            >
              <CardContent className="p-0">
                <div className={`w-16 h-16 ${opportunity.color} rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-125 group-hover:rotate-12 transition-all duration-300`}>
                  <span className="group-hover:animate-pulse">{opportunity.icon}</span>
                </div>
                <h3 className="text-lg font-semibold text-brand-gray mb-2 group-hover:text-brand-black transition-colors duration-300">
                  {opportunity.title}
                </h3>
                <div className="text-3xl font-bold text-brand-black mb-3 group-hover:text-brand-orange transition-colors duration-300">
                  {opportunity.value}
                </div>
                <p className="text-brand-gray group-hover:text-brand-black transition-colors duration-300">
                  {opportunity.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Call to Action */}
        <div className="text-center mt-16">
          <div className="bg-gradient-to-r from-brand-orange to-orange-600 rounded-2xl p-12 text-white hover:shadow-2xl hover:scale-105 transition-all duration-500">
            <h3 className="text-3xl font-bold mb-4">Ready to capture this opportunity?</h3>
            <p className="text-xl text-orange-100 mb-8 max-w-2xl mx-auto">
              Don't let your competitors get ahead. Start building your competitive advantage today.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
