import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

export const DemoHeader = () => {
  return (
    <div className="text-center mb-16">
      <Badge variant="secondary" className="mb-4 bg-orange-100 text-brand-orange hover:bg-orange-200 hover:scale-105 transition-all duration-300 animate-fade-in">
        Product Demo
      </Badge>
      <h2 className="text-4xl md:text-5xl font-bold text-brand-black mb-6 hover:text-brand-orange transition-colors duration-500 animate-fade-in">
        Complete Restaurant
        <span className="block text-brand-orange hover:text-orange-600 hover:scale-105 transition-all duration-300">
          Operations Platform
        </span>
      </h2>
      <p className="text-xl text-brand-gray max-w-3xl mx-auto mb-8 animate-fade-in">
        Experience the power of our integrated platform through interactive demonstrations and real-world use cases.
      </p>
      
      <Button size="lg" className="bg-brand-orange hover:bg-orange-600 text-white px-8 py-4 text-lg font-semibold hover:scale-110 hover:shadow-xl transition-all duration-300 group animate-scale-in">
        <Play className="mr-2 h-5 w-5 group-hover:animate-pulse" />
        Watch Interactive Demo
      </Button>
    </div>
  );
};