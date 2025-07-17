
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Eye, FileCheck } from "lucide-react";

export const SecurityCompliance = () => {
  const securityFeatures = [
    {
      icon: <Shield className="h-8 w-8 text-brand-orange" />,
      title: "Payment Security",
      description: "PCI DSS Level 1 compliance with end-to-end encryption for all payment data",
      features: [
        "PCI DSS Level 1 certified",
        "Point-to-point encryption",
        "Tokenization of sensitive data",
        "Secure key management",
        "Regular security audits"
      ]
    },
    {
      icon: <Lock className="h-8 w-8 text-brand-orange" />,
      title: "Data Protection",
      description: "Enterprise-grade data protection with GDPR compliance and privacy controls",
      features: [
        "GDPR compliance framework",
        "Data encryption at rest and in transit",
        "Access control and permissions",
        "Data backup and recovery",
        "Privacy by design architecture"
      ]
    },
    {
      icon: <Eye className="h-8 w-8 text-brand-orange" />,
      title: "Infrastructure Security",
      description: "Multi-layered security architecture with continuous monitoring and threat detection",
      features: [
        "Cloud security best practices",
        "Network segmentation",
        "Intrusion detection systems",
        "24/7 security monitoring",
        "Automated threat response"
      ]
    },
    {
      icon: <FileCheck className="h-8 w-8 text-brand-orange" />,
      title: "Audit & Compliance",
      description: "Comprehensive audit trails and regulatory compliance across multiple frameworks",
      features: [
        "SOC 2 Type II compliance",
        "ISO 27001 certification",
        "Complete audit logging",
        "Regulatory reporting tools",
        "Third-party security assessments"
      ]
    }
  ];

  const certifications = [
    {
      name: "PCI DSS Level 1",
      description: "Highest level of payment card industry compliance",
      authority: "PCI Security Standards Council",
      validity: "Annual certification"
    },
    {
      name: "SOC 2 Type II",
      description: "Security, availability, and confidentiality controls",
      authority: "AICPA",
      validity: "Annual audit"
    },
    {
      name: "ISO 27001",
      description: "Information security management system standard",
      authority: "International Organization for Standardization",
      validity: "3-year certification cycle"
    },
    {
      name: "GDPR Compliance",
      description: "European Union data protection regulation",
      authority: "EU Regulatory Framework",
      validity: "Ongoing compliance"
    }
  ];

  const securityMetrics = [
    { value: "99.9%", label: "Security Uptime", description: "Zero security incidents" },
    { value: "256-bit", label: "Encryption Standard", description: "Military-grade security" },
    { value: "<1 min", label: "Threat Response", description: "Automated detection" },
    { value: "24/7", label: "Security Monitoring", description: "Continuous oversight" }
  ];

  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 bg-orange-100 text-brand-orange hover:bg-orange-200 hover:scale-105 transition-all duration-300">Security & Compliance</Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-brand-black mb-6 hover:text-brand-orange transition-colors duration-500">
            Bank-Grade Security and
            <span className="block text-brand-orange hover:text-orange-600 hover:scale-105 transition-all duration-300">Regulatory Compliance</span>
          </h2>
          <p className="text-xl text-brand-gray max-w-3xl mx-auto">
            Enterprise-level security architecture with comprehensive compliance frameworks to protect your business and your customers' data.
          </p>
        </div>

        {/* Security Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          {securityFeatures.map((feature, index) => (
            <Card key={index} className="p-8 hover:shadow-xl transition-all duration-300 border-l-4 border-l-brand-orange bg-white hover:scale-105 hover:-rotate-1 group">
              <CardHeader className="pb-4 px-0">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-orange-50 rounded-lg group-hover:bg-orange-100 group-hover:animate-pulse transition-all duration-300">
                    {feature.icon}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2 text-brand-black group-hover:text-brand-orange transition-colors duration-300">{feature.title}</CardTitle>
                    <p className="text-brand-gray group-hover:text-brand-black transition-colors duration-300">{feature.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-0">
                <ul className="space-y-2">
                  {feature.features.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start space-x-2 hover:translate-x-1 transition-transform duration-200">
                      <div className="w-4 h-4 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1 group-hover:bg-orange-200 transition-colors duration-300">
                        <div className="w-2 h-2 bg-brand-orange rounded-full"></div>
                      </div>
                      <span className="text-brand-gray text-sm group-hover:text-brand-black transition-colors duration-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Security Metrics */}
        <div className="mb-20">
          <h3 className="text-3xl font-bold text-brand-black text-center mb-12 hover:text-brand-orange transition-colors duration-300">Security Performance Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {securityMetrics.map((metric, index) => (
              <Card key={index} className="text-center p-6 hover:shadow-lg transition-all duration-300 hover:scale-105 hover:-translate-y-2 group bg-white">
                <CardContent className="p-0">
                  <div className="text-3xl font-bold text-brand-orange mb-2 group-hover:animate-pulse">{metric.value}</div>
                  <div className="text-lg font-semibold text-brand-black mb-1 group-hover:text-brand-orange transition-colors duration-300">{metric.label}</div>
                  <div className="text-brand-gray text-sm group-hover:text-brand-black transition-colors duration-300">{metric.description}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Certifications */}
        <div className="p-8 bg-gradient-to-r from-orange-50 to-orange-100 rounded-2xl hover:shadow-xl transition-all duration-500">
          <h3 className="text-3xl font-bold text-brand-black text-center mb-12 hover:text-brand-orange transition-colors duration-300">Security Certifications & Compliance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {certifications.map((cert, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-all duration-300 hover:scale-105 hover:rotate-1 group bg-white">
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-16 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-orange-200 group-hover:animate-pulse transition-all duration-300">
                    <Shield className="h-8 w-8 text-brand-orange" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-brand-black mb-2 group-hover:text-brand-orange transition-colors duration-300">{cert.name}</h4>
                    <p className="text-brand-gray mb-3 group-hover:text-brand-black transition-colors duration-300">{cert.description}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-brand-gray">Authority:</span>
                        <span className="text-brand-black group-hover:text-brand-orange transition-colors duration-300">{cert.authority}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-brand-gray">Validity:</span>
                        <span className="text-brand-black group-hover:text-brand-orange transition-colors duration-300">{cert.validity}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Security Commitment */}
        <div className="mt-16 text-center">
          <h3 className="text-2xl font-bold text-brand-black mb-6 hover:text-brand-orange transition-colors duration-300">Our Security Commitment</h3>
          <p className="text-lg text-brand-gray max-w-3xl mx-auto mb-8">
            Security isn't just a feature—it's the foundation of everything we build. We maintain the highest standards of security and compliance to protect your business and earn your customers' trust.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-lg border-2 border-orange-100 hover:border-orange-200 hover:scale-105 hover:-rotate-1 transition-all duration-300 group">
              <h4 className="font-semibold text-brand-black mb-2 group-hover:text-brand-orange transition-colors duration-300">Proactive Monitoring</h4>
              <p className="text-brand-gray text-sm group-hover:text-brand-black transition-colors duration-300">24/7 security monitoring with automated threat detection and response</p>
            </div>
            <div className="p-6 bg-white rounded-lg border-2 border-orange-100 hover:border-orange-200 hover:scale-105 hover:rotate-1 transition-all duration-300 group">
              <h4 className="font-semibold text-brand-black mb-2 group-hover:text-brand-orange transition-colors duration-300">Regular Audits</h4>
              <p className="text-brand-gray text-sm group-hover:text-brand-black transition-colors duration-300">Third-party security assessments and compliance audits</p>
            </div>
            <div className="p-6 bg-white rounded-lg border-2 border-orange-100 hover:border-orange-200 hover:scale-105 hover:-rotate-1 transition-all duration-300 group">
              <h4 className="font-semibold text-brand-black mb-2 group-hover:text-brand-orange transition-colors duration-300">Transparent Reporting</h4>
              <p className="text-brand-gray text-sm group-hover:text-brand-black transition-colors duration-300">Regular security reports and compliance documentation</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
