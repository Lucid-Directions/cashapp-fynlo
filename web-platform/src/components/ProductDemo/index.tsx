import { DemoHeader } from "./DemoHeader";
import { FeatureTabs } from "./FeatureTabs";
import { BenefitsSummary } from "./BenefitsSummary";
import { platformFeatures } from "./data";

export const ProductDemo = () => {
  return (
    <section className="py-24 bg-gradient-to-br from-orange-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-6">
        <DemoHeader />
        <FeatureTabs features={platformFeatures} />
        <BenefitsSummary />
      </div>
    </section>
  );
};