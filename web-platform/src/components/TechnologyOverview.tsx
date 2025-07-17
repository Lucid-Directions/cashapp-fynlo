
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Cloud, Zap, Globe } from "lucide-react";

export const TechnologyOverview = () => {
  const architectureFeatures = [
    {
      icon: <Cloud className="h-8 w-8 text-brand-orange" />,
      title: "Cloud-Native Architecture",
      description: "Built on enterprise-grade cloud infrastructure with automatic scaling and 99.9% uptime guarantee",
      specs: ["Auto-scaling", "Multi-region deployment", "Real-time sync"]
    },
    {
      icon: <Shield className="h-8 w-8 text-brand-orange" />,
      title: "Enterprise Security",
      description: "Bank-grade security with PCI DSS Level 1 compliance and end-to-end encryption",
      specs: ["PCI DSS Level 1", "SOX Compliance", "GDPR Ready"]
    },
    {
      icon: <Zap className="h-8 w-8 text-brand-orange" />,
      title: "High Performance",
      description: "Sub-second transaction processing with advanced caching and optimization",
      specs: ["<100ms response", "Real-time analytics", "Edge computing"]
    },
    {
      icon: <Globe className="h-8 w-8 text-brand-orange" />,
      title: "Global Scalability",
      description: "Multi-tenant platform serving thousands of restaurants from a single instance",
      specs: ["Multi-tenant", "Global CDN", "API-first design"]
    }
  ];

  const performanceMetrics = [
    { metric: "99.9%", label: "Platform Uptime", description: "Guaranteed SLA" },
    { metric: "<100ms", label: "Transaction Speed", description: "Average processing time" },
    { metric: "10K+", label: "Concurrent Users", description: "Per platform instance" },
    { metric: "24/7", label: "Monitoring", description: "Proactive system health" }
  ];

  const integrationPartners = [
    "Xero", "Square", "Stripe", "SumUp"
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 bg-orange-100 text-brand-orange hover:bg-orange-200 hover:scale-105 transition-all duration-300">Technology Platform</Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-brand-black mb-6 hover:text-brand-orange transition-colors duration-500">
            Enterprise-Grade Restaurant
            <span className="block text-brand-orange hover:text-orange-600 hover:scale-105 transition-all duration-300">Technology Infrastructure</span>
          </h2>
          <p className="text-xl text-brand-gray max-w-3xl mx-auto">
            Built for scale, security, and performance. Our platform delivers the reliability and features that enterprise restaurants demand.
          </p>
        </div>

        {/* Architecture Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          {architectureFeatures.map((feature, index) => (
            <Card key={index} className="p-8 hover:shadow-xl transition-all duration-300 border-l-4 border-l-brand-orange hover:scale-105 hover:rotate-1">
              <CardHeader className="pb-4 px-0">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors duration-300">
                    {feature.icon}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2 text-brand-black group-hover:text-brand-orange transition-colors duration-300">{feature.title}</CardTitle>
                    <p className="text-brand-gray group-hover:text-brand-black transition-colors duration-300">{feature.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-0 pt-4">
                <div className="flex flex-wrap gap-2">
                  {feature.specs.map((spec, specIndex) => (
                    <Badge key={specIndex} variant="outline" className="text-brand-orange border-orange-200 hover:bg-orange-50 transition-colors duration-200">
                      {spec}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Performance Metrics */}
        <div className="mb-20">
          <h3 className="text-3xl font-bold text-brand-black text-center mb-12 hover:text-brand-orange transition-colors duration-300">Platform Performance Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {performanceMetrics.map((metric, index) => (
              <Card key={index} className="text-center p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 group">
                <CardContent className="p-0">
                  <div className="text-4xl font-bold text-brand-orange mb-2 group-hover:animate-pulse">{metric.metric}</div>
                  <div className="text-lg font-semibold text-brand-black mb-1 group-hover:text-brand-orange transition-colors duration-300">{metric.label}</div>
                  <div className="text-brand-gray text-sm group-hover:text-brand-black transition-colors duration-300">{metric.description}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Integration Ecosystem */}
        <div className="p-8 bg-gradient-to-r from-orange-50 to-orange-100 rounded-2xl">
          <h3 className="text-3xl font-bold text-brand-black text-center mb-8 hover:text-brand-orange transition-colors duration-300">Integration Ecosystem</h3>
          <p className="text-center text-brand-gray mb-8 max-w-2xl mx-auto">
            Seamlessly connect with leading business applications and services through our comprehensive API ecosystem.
          </p>
          
          {/* Integration Partners Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {integrationPartners.map((partner, index) => (
              <div key={index} className="bg-white p-4 rounded-lg text-center font-semibold text-brand-black hover:shadow-md transition-all duration-300 hover:scale-105 hover:-rotate-1 hover:text-brand-orange">
                {partner}
              </div>
            ))}
          </div>

          {/* API Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="text-center hover:transform hover:scale-105 transition-all duration-300">
              <div className="w-16 h-16 bg-brand-orange rounded-full flex items-center justify-center mx-auto mb-4 hover:animate-pulse">
                <div className="text-2xl text-white">🔗</div>
              </div>
              <h4 className="font-semibold text-brand-black mb-2 group-hover:text-brand-orange transition-colors duration-300">RESTful APIs</h4>
              <p className="text-brand-gray group-hover:text-brand-black transition-colors duration-300">Comprehensive API documentation and SDKs</p>
            </div>
            <div className="text-center hover:transform hover:scale-105 transition-all duration-300 group">
              <div className="w-16 h-16 bg-brand-orange rounded-full flex items-center justify-center mx-auto mb-4 hover:animate-pulse">
                <div className="text-2xl text-white">⚡</div>
              </div>
              <h4 className="font-semibold text-brand-black mb-2 group-hover:text-brand-orange transition-colors duration-300">Real-time Webhooks</h4>
              <p className="text-brand-gray group-hover:text-brand-black transition-colors duration-300">Instant data synchronization across systems</p>
            </div>
            <div className="text-center hover:transform hover:scale-105 transition-all duration-300 group">
              <div className="w-16 h-16 bg-brand-orange rounded-full flex items-center justify-center mx-auto mb-4 hover:animate-pulse">
                <div className="text-2xl text-white">🛡️</div>
              </div>
              <h4 className="font-semibold text-brand-black mb-2 group-hover:text-brand-orange transition-colors duration-300">Secure Authentication</h4>
              <p className="text-brand-gray group-hover:text-brand-black transition-colors duration-300">OAuth 2.0 and API key management</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
