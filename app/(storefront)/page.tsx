"use client";

import HeroSection from "@/components/storefront/home/HeroSection";
import TrustBadges from "@/components/storefront/home/TrustBadges";
import FeaturedProducts from "@/components/storefront/home/FeaturedProducts";
import BrandStory from "@/components/storefront/home/BrandStory";
import GrindChooser from "@/components/storefront/home/GrindChooser";
import SubscriptionCTA from "@/components/storefront/home/SubscriptionCTA";
import TestimonialSection from "@/components/storefront/home/TestimonialSection";
// v1: Newsletter hidden — restore import when the newsletter feature ships
// import Newsletter from "@/components/storefront/home/Newsletter";

export default function Home() {
  return (
    <>
      <HeroSection />
      <TrustBadges />
      <FeaturedProducts />
      <BrandStory />
      <GrindChooser />
      <SubscriptionCTA />
      <TestimonialSection />
      {/* v1: Newsletter hidden — restore when the newsletter feature ships */}
      {/* <Newsletter /> */}
    </>
  );
}