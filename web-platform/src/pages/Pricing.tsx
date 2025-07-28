
import { Navigation } from "@/components/Navigation";
import { InvestmentPricing } from "@/components/InvestmentPricing";
import { Implementation } from "@/components/Implementation";
import { GettingStarted } from "@/components/GettingStarted";

const Pricing = () => {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <InvestmentPricing />
      <Implementation />
      <GettingStarted />
    </div>
  );
};

export default Pricing;
