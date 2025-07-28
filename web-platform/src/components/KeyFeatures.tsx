
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const KeyFeatures = () => {
  const features = [
    {
      title: "Multi-Tenant Architecture",
      description: "Serve multiple restaurant brands from a single platform with complete data isolation and customization capabilities.",
      icon: "🏢",
      color: "bg-orange-50 text-brand-orange"
    },
    {
      title: "1% Processing Rates",
      description: "Industry-leading payment processing rates that significantly reduce transaction costs compared to traditional providers.",
      icon: "💳",
      color: "bg-orange-50 text-brand-orange"
    },
    {
      title: "Zero Hardware Investment",
      description: "Cloud-based infrastructure eliminates the need for expensive hardware purchases and maintenance.",
      icon: "☁️",
      color: "bg-orange-50 text-brand-orange"
    },
    {
      title: "Enterprise Security",
      description: "Bank-level security with PCI DSS compliance, encryption, and comprehensive audit trails.",
      icon: "🔒",
      color: "bg-orange-50 text-brand-orange"
    },
    {
      title: "Real-Time Analytics",
      description: "Advanced reporting and analytics dashboards providing insights across all restaurant operations.",
      icon: "📊",
      color: "bg-orange-50 text-brand-orange"
    },
    {
      title: "Seamless Integrations",
      description: "Connect with leading restaurant technology partners through our comprehensive API ecosystem.",
      icon: "🔗",
      color: "bg-orange-50 text-brand-orange"
    }
  ];

  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 bg-orange-100 text-brand-orange hover:bg-orange-200 hover:scale-105 transition-all duration-300">Key Features</Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-brand-black mb-6 hover:text-brand-orange transition-colors duration-500">
            Why Choose Fynlo
            <span className="block text-brand-orange hover:text-orange-600 hover:scale-105 transition-all duration-300">Platform Solutions</span>
          </h2>
          <p className="text-xl text-brand-gray max-w-3xl mx-auto">
            Built specifically for restaurant technology companies, our platform delivers enterprise-grade capabilities with the flexibility to scale your business.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="p-6 hover:shadow-lg transition-all duration-300 bg-white border-0 shadow-sm hover:scale-105 hover:-rotate-1 group">
              <CardContent className="p-0">
                <div className={`w-12 h-12 rounded-lg ${feature.color} flex items-center justify-center text-2xl mb-4 group-hover:animate-pulse transition-all duration-300`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-brand-black mb-3 group-hover:text-brand-orange transition-colors duration-300">{feature.title}</h3>
                <p className="text-brand-gray leading-relaxed group-hover:text-brand-black transition-colors duration-300">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
