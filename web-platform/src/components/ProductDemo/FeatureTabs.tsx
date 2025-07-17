import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { PlatformFeature } from "./types";

interface FeatureTabsProps {
  features: PlatformFeature[];
}

export const FeatureTabs = ({ features }: FeatureTabsProps) => {
  return (
    <div className="mb-20">
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 mb-8 bg-white shadow-lg rounded-xl p-2">
          {features.map((feature, index) => (
            <TabsTrigger 
              key={feature.id} 
              value={feature.id}
              className="flex items-center space-x-2 text-sm font-medium hover:scale-105 transition-all duration-300 data-[state=active]:bg-orange-100 data-[state=active]:text-brand-orange rounded-lg hover:shadow-md animate-fade-in"
              style={{
                animationDelay: `${index * 0.1}s`
              }}
            >
              <span className="hover:rotate-12 transition-transform duration-300">{feature.icon}</span>
              <span className="hidden sm:inline">{feature.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {features.map((feature) => (
          <TabsContent key={feature.id} value={feature.id}>
            <Card className="p-8 hover:shadow-2xl transition-all duration-500 group animate-scale-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <h3 className="text-3xl font-bold text-brand-black mb-4 group-hover:text-brand-orange transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-xl text-brand-gray mb-8 group-hover:text-brand-black transition-colors duration-300">
                    {feature.description}
                  </p>
                  
                  <div className="space-y-4">
                    {feature.features.map((item, index) => (
                      <div 
                        key={index} 
                        className="flex items-start space-x-3 hover:translate-x-2 transition-all duration-300 group/item animate-fade-in"
                        style={{
                          animationDelay: `${index * 0.1}s`
                        }}
                      >
                        <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 group-hover/item:bg-orange-200 group-hover/item:scale-110 transition-all duration-300">
                          <div className="w-2 h-2 bg-brand-orange rounded-full group-hover/item:bg-orange-700"></div>
                        </div>
                        <span className="text-brand-gray group-hover/item:text-brand-black transition-colors duration-300">
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow-lg border group-hover:shadow-2xl group-hover:scale-105 transition-all duration-500">
                  <img 
                    src={feature.image} 
                    alt={`${feature.title} Demo`}
                    className="w-full h-64 object-cover rounded-lg hover:scale-110 transition-transform duration-500 cursor-pointer"
                  />
                </div>
              </div>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};