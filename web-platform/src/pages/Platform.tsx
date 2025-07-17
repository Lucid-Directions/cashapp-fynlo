
import { Navigation } from "@/components/Navigation";
import { TechnologyOverview } from "@/components/TechnologyOverview";
import { ProductDemo } from "@/components/ProductDemo/";
import { SecurityCompliance } from "@/components/SecurityCompliance";

const Platform = () => {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <TechnologyOverview />
      <ProductDemo />
      <SecurityCompliance />
    </div>
  );
};

export default Platform;
