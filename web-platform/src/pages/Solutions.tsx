
import { Navigation } from "@/components/Navigation";
import { MarketOpportunity } from "@/components/MarketOpportunity";
import { ProductShowcase } from "@/components/ProductShowcase";
import { BusinessSolutions } from "@/components/BusinessSolutions";
import { PlatformBusinessModel } from "@/components/PlatformBusinessModel";
import { ClientSuccess } from "@/components/ClientSuccess";
import { IndustryPartnerships } from "@/components/IndustryPartnerships";

const Solutions = () => {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <MarketOpportunity />
      <ProductShowcase />
      <BusinessSolutions />
      <PlatformBusinessModel />
      <ClientSuccess />
      <IndustryPartnerships />
    </div>
  );
};

export default Solutions;
