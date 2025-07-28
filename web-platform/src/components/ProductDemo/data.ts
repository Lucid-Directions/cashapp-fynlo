import React from "react";
import { BarChart3, CreditCard } from "lucide-react";
import { PlatformFeature } from "./types";
import platformManagementDemo from "@/assets/platform-management-demo.jpg";
import restaurantPosDemo from "@/assets/restaurant-pos-demo.jpg";
import paymentProcessingDemo from "@/assets/payment-processing-demo.jpg";
import businessIntelligenceDemo from "@/assets/business-intelligence-demo.jpg";

export const platformFeatures: PlatformFeature[] = [
  {
    id: "dashboard",
    label: "Platform Management",
    icon: React.createElement(BarChart3, { className: "h-5 w-5" }),
    title: "Multi-Location Dashboard",
    description: "Comprehensive oversight and analytics across all restaurant locations",
    image: platformManagementDemo,
    features: [
      "Real-time performance monitoring",
      "Cross-location analytics and reporting",
      "Centralized menu and pricing management",
      "Staff performance tracking",
      "Revenue optimization insights"
    ]
  },
  {
    id: "pos",
    label: "Restaurant Operations",
    icon: React.createElement(CreditCard, { className: "h-5 w-5" }),
    title: "Advanced Point-of-Sale",
    description: "Intuitive POS system designed for high-volume restaurant operations",
    image: restaurantPosDemo,
    features: [
      "Lightning-fast order processing",
      "Split payments and custom modifications",
      "Kitchen display system integration",
      "Inventory management automation",
      "Staff scheduling and time tracking"
    ]
  },
  {
    id: "payments",
    label: "Payment Processing",
    icon: React.createElement(CreditCard, { className: "h-5 w-5" }),
    title: "Integrated Payment Solutions",
    description: "Secure, low-cost payment processing with multiple payment options",
    image: paymentProcessingDemo,
    features: [
      "1% processing rates (vs 2.9% industry standard)",
      "Contactless and mobile payments",
      "Split billing and group payments",
      "Automatic tip distribution",
      "Comprehensive payment analytics"
    ]
  },
  {
    id: "analytics",
    label: "Business Intelligence",
    icon: React.createElement(BarChart3, { className: "h-5 w-5" }),
    title: "Advanced Analytics Suite",
    description: "Data-driven insights to optimize restaurant performance and profitability",
    image: businessIntelligenceDemo,
    features: [
      "Real-time sales and performance metrics",
      "Customer behavior analysis",
      "Predictive inventory management",
      "Profit margin optimization",
      "Custom reporting and dashboards"
    ]
  }
];