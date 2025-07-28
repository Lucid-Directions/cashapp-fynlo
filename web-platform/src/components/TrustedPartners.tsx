
import { Badge } from "@/components/ui/badge";

export const TrustedPartners = () => {
  const stats = [
    { number: "12+", label: "Markets Served", description: "Across North America" },
    { number: "500K+", label: "Transactions Daily", description: "Processed securely" },
    { number: "99.9%", label: "Uptime", description: "Enterprise reliability" },
    { number: "24/7", label: "Support", description: "Technical assistance" }
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 bg-orange-100 text-brand-orange hover:bg-orange-200 hover:scale-105 transition-all duration-300">Trusted Performance</Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-brand-black mb-6 hover:text-brand-orange transition-colors duration-500">
            Platform You Can
            <span className="block text-brand-orange hover:text-orange-600 hover:scale-105 transition-all duration-300">Count On</span>
          </h2>
          <p className="text-xl text-brand-gray max-w-3xl mx-auto">
            Our track record speaks for itself. Join restaurant technology leaders who trust Fynlo to power their growth.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {stats.map((stat, index) => (
            <div key={index} className="text-center group hover:scale-105 transition-all duration-300">
              <div className="text-5xl font-bold text-brand-orange mb-2 group-hover:animate-pulse">{stat.number}</div>
              <div className="text-xl font-semibold text-brand-black mb-1 group-hover:text-brand-orange transition-colors duration-300">{stat.label}</div>
              <div className="text-brand-gray group-hover:text-brand-black transition-colors duration-300">{stat.description}</div>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-brand-black to-slate-800 rounded-2xl p-12 text-center text-white hover:shadow-2xl hover:scale-105 transition-all duration-500">
          <h3 className="text-3xl font-bold mb-4">Ready to Transform Your Restaurant Technology Business?</h3>
          <p className="text-xl text-orange-100 mb-8 max-w-2xl mx-auto">
            Join the leading restaurant technology companies who have chosen Fynlo as their platform partner.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <div className="text-left group hover:scale-105 transition-all duration-300">
              <div className="text-2xl font-bold text-brand-orange group-hover:animate-pulse">Enterprise Grade</div>
              <div className="text-orange-100">Multi-tenant architecture</div>
            </div>
            <div className="text-left group hover:scale-105 transition-all duration-300">
              <div className="text-2xl font-bold text-white group-hover:text-brand-orange transition-colors duration-300">Cost Effective</div>
              <div className="text-orange-100">1% processing rates</div>
            </div>
            <div className="text-left group hover:scale-105 transition-all duration-300">
              <div className="text-2xl font-bold text-orange-300 group-hover:text-brand-orange transition-colors duration-300">Scalable</div>
              <div className="text-orange-100">Zero hardware investment</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
