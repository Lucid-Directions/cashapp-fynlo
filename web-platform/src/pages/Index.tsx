
import { Hero } from "@/components/Hero";
import { KeyFeatures } from "@/components/KeyFeatures";
import { TrustedPartners } from "@/components/TrustedPartners";
import { CallToAction } from "@/components/CallToAction";

const Index = () => {
  return (
    <div className="min-h-screen bg-white">
      <Hero />
      <KeyFeatures />
      <TrustedPartners />
      <CallToAction />
    </div>
  );
};

export default Index;
