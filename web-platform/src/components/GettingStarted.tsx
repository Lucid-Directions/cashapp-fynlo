
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Calendar, MessageSquare, Presentation, Handshake } from "lucide-react";

export const GettingStarted = () => {
  const engagementProcess = [
    {
      step: "1",
      icon: <MessageSquare className="h-8 w-8 text-brand-orange" />,
      title: "Discovery Consultation",
      duration: "60 minutes",
      description: "Market assessment and opportunity analysis with our business development team",
      deliverables: [
        "Market size analysis",
        "Competitive landscape review",
        "Revenue opportunity assessment",
        "Initial feasibility study"
      ]
    },
    {
      step: "2",
      icon: <Presentation className="h-8 w-8 text-brand-orange" />,
      title: "Platform Demonstration",
      duration: "90 minutes",
      description: "Comprehensive platform overview with technical review and customization options",
      deliverables: [
        "Complete platform walkthrough",
        "Technical architecture review",
        "Integration capabilities demo",
        "Customization options overview"
      ]
    },
    {
      step: "3",
      icon: <Calendar className="h-8 w-8 text-brand-orange" />,
      title: "Business Planning",
      duration: "2-3 weeks",
      description: "Market strategy development and implementation planning with financial modeling",
      deliverables: [
        "Go-to-market strategy",
        "Financial projections",
        "Implementation timeline",
        "Resource requirements plan"
      ]
    },
    {
      step: "4",
      icon: <Handshake className="h-8 w-8 text-orange-600" />,
      title: "Partnership Launch",
      duration: "4-6 weeks",
      description: "Technical deployment, training, and market entry support for successful launch",
      deliverables: [
        "Platform deployment",
        "Team training completion",
        "Marketing campaign launch",
        "First customer acquisition"
      ]
    }
  ];

  return (
    <section className="py-24 bg-gradient-to-br from-brand-black via-gray-900 to-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 bg-orange-100 text-brand-orange hover:bg-orange-200 hover:scale-105 transition-all duration-300">Getting Started</Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Begin Your Platform
            <span className="block text-brand-orange">Partnership Journey</span>
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            From initial consultation to successful market launch, our structured engagement process ensures your platform success from day one.
          </p>
        </div>

        {/* Engagement Process */}
        <div className="mb-20">
          <h3 className="text-3xl font-bold text-center mb-12">Professional Engagement Process</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {engagementProcess.map((process, index) => (
              <Card key={index} className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 transition-all duration-300">
                <CardHeader>
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="w-12 h-12 bg-brand-orange rounded-full flex items-center justify-center font-bold text-lg">
                      {process.step}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-white text-xl mb-2">{process.title}</CardTitle>
                      <Badge variant="outline" className="border-white/30 text-white">
                        {process.duration}
                      </Badge>
                    </div>
                    <div className="p-3 bg-white/10 rounded-lg">
                      {process.icon}
                    </div>
                  </div>
                  <p className="text-slate-300">{process.description}</p>
                </CardHeader>
                <CardContent>
                  <h5 className="font-semibold text-white mb-3">Key Deliverables:</h5>
                  <ul className="space-y-2">
                    {process.deliverables.map((deliverable, deliverableIndex) => (
                      <li key={deliverableIndex} className="flex items-start space-x-2">
                        <div className="w-4 h-4 bg-brand-orange rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                        <span className="text-slate-300 text-sm">{deliverable}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Contact Form */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Form */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10 p-8">
            <CardHeader className="px-0 pb-6">
              <CardTitle className="text-2xl text-white mb-2">Schedule Your Discovery Consultation</CardTitle>
              <p className="text-slate-300">
                Start your platform partnership journey with a comprehensive market assessment and opportunity analysis.
              </p>
            </CardHeader>
            <CardContent className="px-0 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">First Name *</label>
                  <Input className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" placeholder="John" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Last Name *</label>
                  <Input className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" placeholder="Smith" />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">Email Address *</label>
                <Input className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" placeholder="john@company.com" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">Phone Number *</label>
                <Input className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" placeholder="+1 (555) 123-4567" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">Company/Organization</label>
                <Input className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" placeholder="Your Company Name" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">Market Interest</label>
                <Select>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="Select your target market" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local Market (Single City)</SelectItem>
                    <SelectItem value="regional">Regional Market (Multi-City)</SelectItem>
                    <SelectItem value="state">State-wide Market</SelectItem>
                    <SelectItem value="national">National Market</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">Business Experience</label>
                <Textarea 
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" 
                  placeholder="Tell us about your business background and experience in the restaurant or technology industry..."
                  rows={4}
                />
              </div>
              
              <Button className="w-full bg-brand-orange hover:bg-orange-600 text-white py-3 text-lg font-semibold hover:scale-105 transition-all duration-300">
                Schedule Discovery Call
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-bold text-white mb-6">Ready to Get Started?</h3>
              <p className="text-slate-300 mb-8">
                Our business development team is ready to help you explore the platform opportunity and develop a customized market entry strategy.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-brand-orange rounded-lg flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-white font-semibold">Direct Contact</div>
                    <div className="text-slate-300">partnerships@fynlo.com</div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-brand-orange rounded-lg flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-white font-semibold">Response Time</div>
                    <div className="text-slate-300">Within 24 hours</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
              <h4 className="text-lg font-semibold text-white mb-4">What to Expect</h4>
              <ul className="space-y-2 text-slate-300">
                <li className="flex items-start space-x-2">
                  <div className="w-4 h-4 bg-brand-orange rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <span>Comprehensive market analysis for your region</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="w-4 h-4 bg-brand-orange rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <span>Revenue projection modeling and ROI analysis</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="w-4 h-4 bg-brand-orange rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <span>Platform demonstration and technical overview</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="w-4 h-4 bg-brand-orange rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <span>Customized implementation strategy</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
