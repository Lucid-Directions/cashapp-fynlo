
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileText, PlayCircle, BookOpen } from "lucide-react";

export const ResourceCenter = () => {
  const businessResources = [
    {
      title: "Platform Business Case Template",
      description: "Comprehensive ROI model and market analysis framework for restaurant technology platforms",
      type: "Excel Template",
      size: "2.4 MB",
      icon: <FileText className="h-6 w-6 text-blue-600" />
    },
    {
      title: "Restaurant Market Analysis Guide",
      description: "Step-by-step guide to analyzing your local restaurant market and identifying opportunities",
      type: "PDF Guide",
      size: "1.8 MB",
      icon: <FileText className="h-6 w-6 text-emerald-600" />
    },
    {
      title: "Platform Demo Presentation",
      description: "Professional presentation deck for pitching restaurant technology solutions to prospects",
      type: "PowerPoint",
      size: "15.2 MB",
      icon: <FileText className="h-6 w-6 text-purple-600" />
    },
    {
      title: "Implementation Timeline Template",
      description: "Project management template for platform deployment and restaurant onboarding",
      type: "Excel Template",
      size: "1.2 MB",
      icon: <FileText className="h-6 w-6 text-orange-600" />
    }
  ];

  const webinars = [
    {
      title: "Building a Successful Restaurant Technology Platform",
      description: "Learn the key strategies for launching and scaling your restaurant technology business",
      duration: "45 minutes",
      date: "December 2024"
    },
    {
      title: "Understanding Restaurant Payment Processing",
      description: "Deep dive into payment processing, fees, and how to optimize for profitability",
      duration: "30 minutes",
      date: "November 2024"
    },
    {
      title: "Multi-Tenant Architecture for Restaurants",
      description: "Technical overview of building scalable restaurant technology platforms",
      duration: "60 minutes",
      date: "October 2024"
    }
  ];

  const caseStudies = [
    {
      title: "Regional Chain Scales from 5 to 50 Locations",
      description: "How a growing restaurant chain used our platform to expand rapidly while maintaining operational efficiency",
      industry: "Quick Service Restaurant",
      results: "300% growth in 18 months"
    },
    {
      title: "Technology Partner Launches Multi-Brand Platform",
      description: "Restaurant technology company builds comprehensive platform serving multiple restaurant brands",
      industry: "Technology Partner",
      results: "15 brands, 200+ locations"
    },
    {
      title: "Enterprise Restaurant Group Modernizes Operations",
      description: "Large restaurant enterprise replaces legacy systems with modern, scalable platform solution",
      industry: "Enterprise Restaurant",
      results: "40% cost reduction"
    }
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 bg-orange-100 text-brand-orange hover:bg-orange-200 hover:scale-105 transition-all duration-300">Resource Center</Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-brand-black mb-6 hover:text-brand-orange transition-colors duration-500">
            Platform Resources and
            <span className="block text-brand-orange hover:text-orange-600 hover:scale-105 transition-all duration-300">Business Development Tools</span>
          </h2>
          <p className="text-xl text-brand-gray max-w-3xl mx-auto">
            Access comprehensive resources, tools, and educational content designed to accelerate your platform business development and market success.
          </p>
        </div>

        {/* Business Resources */}
        <div className="mb-20">
          <h3 className="text-3xl font-bold text-brand-black text-center mb-12 hover:text-brand-orange transition-colors duration-300">Business Development Resources</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {businessResources.map((resource, index) => (
              <Card key={index} className="p-6 hover:shadow-lg hover:-translate-y-1 hover:rotate-1 transition-all duration-300 group">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-orange-50 rounded-lg flex-shrink-0 group-hover:bg-brand-orange group-hover:scale-110 transition-all duration-300">
                    <span className="group-hover:text-white transition-colors duration-300">{resource.icon}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-brand-black mb-2 group-hover:text-brand-orange transition-colors duration-300">{resource.title}</h4>
                    <p className="text-brand-gray mb-3 group-hover:text-brand-black transition-colors duration-300">{resource.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <Badge variant="outline" className="border-brand-orange text-brand-orange">{resource.type}</Badge>
                        <span className="text-sm text-brand-gray">{resource.size}</span>
                      </div>
                      <Button variant="outline" size="sm" className="border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white hover:scale-105 transition-all duration-300">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Webinars Section */}
        <div className="mb-20">
          <h3 className="text-3xl font-bold text-brand-black text-center mb-12 hover:text-brand-orange transition-colors duration-300">Educational Webinars</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {webinars.map((webinar, index) => (
              <Card key={index} className="p-6 hover:shadow-lg hover:-translate-y-1 hover:rotate-1 transition-all duration-300 group">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-orange-50 rounded-lg flex-shrink-0 group-hover:bg-brand-orange group-hover:scale-110 transition-all duration-300">
                    <PlayCircle className="h-6 w-6 text-brand-orange group-hover:text-white transition-colors duration-300" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-brand-black mb-2 group-hover:text-brand-orange transition-colors duration-300">{webinar.title}</h4>
                    <p className="text-brand-gray mb-3 group-hover:text-brand-black transition-colors duration-300">{webinar.description}</p>
                    <div className="flex items-center justify-between text-sm text-brand-gray mb-4">
                      <span>{webinar.duration}</span>
                      <span>{webinar.date}</span>
                    </div>
                    <Button variant="outline" size="sm" className="w-full border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white hover:scale-105 transition-all duration-300">
                      Watch Now
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Case Studies Section */}
        <div className="mb-20">
          <h3 className="text-3xl font-bold text-brand-black text-center mb-12 hover:text-brand-orange transition-colors duration-300">Success Stories</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {caseStudies.map((study, index) => (
              <Card key={index} className="p-6 hover:shadow-lg hover:-translate-y-1 hover:rotate-1 transition-all duration-300 group">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-orange-50 rounded-lg flex-shrink-0 group-hover:bg-brand-orange group-hover:scale-110 transition-all duration-300">
                    <BookOpen className="h-6 w-6 text-brand-orange group-hover:text-white transition-colors duration-300" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-brand-black mb-2 group-hover:text-brand-orange transition-colors duration-300">{study.title}</h4>
                    <p className="text-brand-gray mb-3 group-hover:text-brand-black transition-colors duration-300">{study.description}</p>
                    <div className="flex items-center justify-between mb-4">
                      <Badge variant="secondary" className="bg-orange-100 text-brand-orange">{study.industry}</Badge>
                      <span className="text-sm font-semibold text-brand-orange group-hover:animate-pulse">{study.results}</span>
                    </div>
                    <Button variant="outline" size="sm" className="w-full border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white hover:scale-105 transition-all duration-300">
                      Read Case Study
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Partner Portal CTA */}
        <div className="text-center">
          <div className="max-w-3xl mx-auto p-8 bg-gradient-to-r from-brand-orange to-orange-600 rounded-2xl text-white">
            <h3 className="text-2xl font-bold mb-4">Access the Partner Portal</h3>
            <p className="text-orange-100 mb-6">
              Get exclusive access to advanced resources, training materials, and business development tools designed specifically for platform partners.
            </p>
            <Button size="lg" className="bg-white text-brand-orange hover:bg-gray-100 hover:scale-105 px-8 py-4 text-lg font-semibold transition-all duration-300">
              Request Portal Access
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
