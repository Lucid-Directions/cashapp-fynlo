import { Card } from "@/components/ui/card";

export const BenefitsSummary = () => {
  const benefits = [
    {
      icon: "💰",
      title: "Reduce Operating Costs",
      description: "Save up to 40% on processing fees and operational expenses",
      hoverColor: "group-hover:text-green-600"
    },
    {
      icon: "📈",
      title: "Increase Revenue", 
      description: "Data-driven insights help optimize pricing and operations",
      hoverColor: "group-hover:text-brand-orange"
    },
    {
      icon: "⚡",
      title: "Streamline Operations",
      description: "Integrated platform eliminates manual processes and errors",
      hoverColor: "group-hover:text-gray-600"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {benefits.map((benefit, index) => (
        <Card 
          key={benefit.title}
          className="text-center p-8 hover:shadow-xl hover:-translate-y-3 hover:rotate-1 transition-all duration-500 group cursor-pointer animate-fade-in"
          style={{
            animationDelay: `${index * 0.2}s`
          }}
        >
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-orange-200 group-hover:scale-125 group-hover:rotate-12 transition-all duration-300">
            <div className="text-2xl group-hover:animate-bounce">{benefit.icon}</div>
          </div>
          <h4 className={`text-xl font-bold text-brand-black mb-4 transition-colors duration-300 ${benefit.hoverColor}`}>
            {benefit.title}
          </h4>
          <p className="text-brand-gray group-hover:text-brand-black transition-colors duration-300">
            {benefit.description}
          </p>
        </Card>
      ))}
    </div>
  );
};