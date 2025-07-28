
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, Users, Zap } from "lucide-react";

export const Implementation = () => {
  const implementationSteps = [
    {
      step: "1",
      title: "Instant Sign-Up",
      duration: "2-3 minutes",
      description: "Create your account and get immediate access to your payment dashboard",
      deliverables: [
        "Account creation and verification",
        "Dashboard access setup",
        "Payment processing activation",
        "Basic configuration complete",
        "Ready to accept payments"
      ],
      icon: <Zap className="h-8 w-8 text-brand-orange" />
    },
    {
      step: "2",
      title: "App Setup & Onboarding",
      duration: "5-10 minutes",
      description: "Complete your business profile with our guided onboarding system",
      deliverables: [
        "Business details configuration",
        "Payment preferences setup",
        "Staff account creation",
        "Initial settings customization",
        "Quick tutorial completion"
      ],
      icon: <Users className="h-8 w-8 text-brand-orange" />
    },
    {
      step: "3",
      title: "Start Processing",
      duration: "Immediate",
      description: "Begin accepting payments right away with full system functionality",
      deliverables: [
        "Live payment processing",
        "Real-time transaction monitoring",
        "Customer management active",
        "Reporting and analytics available",
        "Full platform access"
      ],
      icon: <CheckCircle className="h-8 w-8 text-brand-orange" />
    }
  ];

  const supportTiers = [
    {
      name: "Standard Support",
      description: "Essential support for platform operations",
      features: [
        "Email support (24-48 hour response)",
        "Knowledge base access",
        "Monthly check-in calls",
        "Platform updates and maintenance",
        "Basic reporting and analytics"
      ],
      availability: "Business hours"
    },
    {
      name: "Premium Support",
      description: "Enhanced support for growing businesses",
      features: [
        "Priority phone and email support",
        "Dedicated account manager",
        "Weekly business reviews",
        "Custom training sessions",
        "Advanced analytics and insights"
      ],
      availability: "Extended hours"
    },
    {
      name: "Enterprise Support",
      description: "White-glove support for large-scale operations",
      features: [
        "24/7 dedicated support team",
        "On-site training and support",
        "Custom feature development",
        "Executive business reviews",
        "Priority product roadmap input"
      ],
      availability: "24/7/365"
    }
  ];

  const serviceLevels = [
    { metric: "99.9%", label: "Platform Uptime", description: "Guaranteed SLA" },
    { metric: "<2hrs", label: "Critical Issue Response", description: "Maximum response time" },
    { metric: "24/7", label: "System Monitoring", description: "Proactive issue detection" },
    { metric: "5 mins", label: "Setup Time", description: "Average account activation" }
  ];

  return (
    <section className="py-24 bg-gradient-to-br from-slate-50 to-orange-50">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 bg-orange-100 text-brand-orange">Getting Started & Support</Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
            Instant Setup,
            <span className="block text-brand-orange">Ongoing Support</span>
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Start accepting payments today with our streamlined signup process and comprehensive support services.
          </p>
        </div>

        {/* Implementation Timeline */}
        <div className="mb-20">
          <h3 className="text-3xl font-bold text-slate-900 text-center mb-12">Get Started in Minutes</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {implementationSteps.map((step, index) => (
              <Card key={index} className="relative hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="absolute -top-4 left-6">
                  <div className="w-8 h-8 bg-brand-orange text-white rounded-full flex items-center justify-center font-bold">
                    {step.step}
                  </div>
                </div>
                
                <CardHeader className="pt-8">
                  <div className="flex items-center space-x-4 mb-4">
                    {step.icon}
                    <div>
                      <CardTitle className="text-xl">{step.title}</CardTitle>
                      <Badge variant="outline" className="mt-2">
                        <Clock className="h-3 w-3 mr-1" />
                        {step.duration}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-slate-600">{step.description}</p>
                </CardHeader>
                
                <CardContent>
                  <h5 className="font-semibold text-slate-900 mb-3">What You Get:</h5>
                  <ul className="space-y-2">
                    {step.deliverables.map((deliverable, deliverableIndex) => (
                      <li key={deliverableIndex} className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-brand-orange flex-shrink-0 mt-0.5" />
                        <span className="text-slate-700 text-sm">{deliverable}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Service Level Commitments */}
        <div className="mb-20">
          <h3 className="text-3xl font-bold text-slate-900 text-center mb-12">Our Service Commitments</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {serviceLevels.map((level, index) => (
              <Card key={index} className="text-center p-6 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-0">
                  <div className="text-3xl font-bold text-brand-orange mb-2">{level.metric}</div>
                  <div className="text-lg font-semibold text-slate-900 mb-1">{level.label}</div>
                  <div className="text-slate-600 text-sm">{level.description}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Support Tiers */}
        <div>
          <h3 className="text-3xl font-bold text-slate-900 text-center mb-12">Ongoing Support Services</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {supportTiers.map((tier, index) => (
              <Card key={index} className="hover:shadow-xl transition-all duration-300 h-full">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-900">{tier.name}</CardTitle>
                  <p className="text-slate-600">{tier.description}</p>
                  <Badge variant="outline" className="w-fit">
                    {tier.availability}
                  </Badge>
                </CardHeader>
                
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {tier.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start space-x-3">
                        <CheckCircle className="h-5 w-5 text-brand-orange flex-shrink-0 mt-0.5" />
                        <span className="text-slate-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
