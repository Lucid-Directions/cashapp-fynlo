
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Quote } from "lucide-react";

export const ClientSuccess = () => {
  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Restaurant Owner",
      business: "Golden Dragon Bistro",
      content: "Since switching to Fynlo, we've reduced our payment processing costs by 40% and increased our table turnover by 25%. The integrated system has streamlined our entire operation.",
      rating: 5,
      image: "https://images.unsplash.com/photo-1494790108755-2616b612b890?auto=format&fit=crop&w=150&q=80",
      metrics: { cost_reduction: "40%", turnover_increase: "25%" }
    },
    {
      name: "Marcus Rodriguez",
      role: "Retail Chain Manager",
      business: "Urban Threads",
      content: "The multi-location dashboard gives us unprecedented visibility into our operations. We can now make data-driven decisions that have boosted our revenue by 30%.",
      rating: 5,
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80",
      metrics: { revenue_boost: "30%", locations: "12 stores" }
    },
    {
      name: "Jennifer Kim",
      role: "Creative Director",
      business: "Pixel Perfect Studio",
      content: "As a creative agency, we needed something more than just payment processing. Fynlo's project billing and client management features have transformed how we work.",
      rating: 5,
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80",
      metrics: { time_saved: "20 hrs/week", client_satisfaction: "95%" }
    }
  ];

  const stats = [
    { value: "10,000+", label: "Happy Customers", color: "text-brand-orange" },
    { value: "99.9%", label: "Uptime", color: "text-brand-black" },
    { value: "$2.5B+", label: "Processed Annually", color: "text-brand-orange" },
    { value: "24/7", label: "Support", color: "text-brand-black" }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 bg-orange-100 text-brand-orange hover:bg-orange-200 hover:scale-105 transition-all duration-300">
            Client Success
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-brand-black mb-6 hover:text-brand-orange transition-colors duration-500">
            Real Results from
            <span className="block text-brand-orange hover:text-orange-600 hover:scale-105 transition-all duration-300">
              Real Businesses
            </span>
          </h2>
          <p className="text-xl text-brand-gray max-w-3xl mx-auto">
            See how businesses like yours have transformed their operations with our platform
          </p>
        </div>

        {/* Success Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          {stats.map((stat, index) => (
            <div 
              key={index} 
              className="text-center p-6 hover:transform hover:scale-110 hover:-rotate-1 transition-all duration-300 cursor-pointer"
              style={{
                animationDelay: `${index * 0.1}s`
              }}
            >
              <div className={`text-3xl md:text-4xl font-bold ${stat.color} mb-2 hover:animate-pulse`}>
                {stat.value}
              </div>
              <div className="text-brand-gray hover:text-brand-black transition-colors duration-300">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card 
              key={index} 
              className="p-8 hover:shadow-xl hover:-translate-y-3 hover:rotate-1 transition-all duration-500 group relative"
              style={{
                animationDelay: `${index * 0.1}s`
              }}
            >
              <CardContent className="p-0">
                {/* Quote Icon */}
                <div className="absolute -top-2 -left-2 w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center group-hover:bg-brand-orange group-hover:scale-125 group-hover:rotate-12 transition-all duration-300">
                  <Quote className="h-4 w-4 text-brand-orange group-hover:text-white group-hover:animate-pulse" />
                </div>

                {/* Rating */}
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star 
                      key={i} 
                      className="h-5 w-5 text-brand-orange fill-current hover:scale-125 hover:rotate-12 transition-all duration-300" 
                      style={{
                        animationDelay: `${i * 0.1}s`
                      }}
                    />
                  ))}
                </div>

                {/* Content */}
                <p className="text-brand-gray mb-6 italic group-hover:text-brand-black transition-colors duration-300">
                  "{testimonial.content}"
                </p>

                {/* Author */}
                <div className="flex items-center">
                  <img 
                    src={testimonial.image} 
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full mr-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"
                  />
                  <div>
                    <div className="font-semibold text-brand-black group-hover:text-brand-orange transition-colors duration-300">
                      {testimonial.name}
                    </div>
                    <div className="text-sm text-brand-gray group-hover:text-brand-black transition-colors duration-300">
                      {testimonial.role}
                    </div>
                    <div className="text-sm text-brand-gray group-hover:text-brand-black transition-colors duration-300">
                      {testimonial.business}
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-sm">
                    {Object.entries(testimonial.metrics).map(([key, value], idx) => (
                      <div key={idx} className="text-center hover:transform hover:scale-110 transition-all duration-300">
                        <div className="font-semibold text-brand-orange hover:text-orange-600 transition-colors duration-300">
                          {value}
                        </div>
                        <div className="text-brand-gray hover:text-brand-black transition-colors duration-300">
                          {key.replace('_', ' ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
