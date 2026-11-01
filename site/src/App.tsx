import { useState } from "react";
import { SITE_CONTENT, type Locale } from "./locales/content";
import { HeroSection } from "./components/HeroSection";
import { FeaturesSection } from "./components/FeaturesSection";
import { WorkflowSection } from "./components/WorkflowSection";
import { EcosystemSection } from "./components/EcosystemSection";
import { Footer } from "./components/Footer";

export default function App() {
  const [locale, setLocale] = useState<Locale>("zh");
  const content = SITE_CONTENT[locale];

  const handleToggleLocale = () => {
    setLocale((prev) => (prev === "zh" ? "en" : "zh"));
  };

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-[#111111]">
      <HeroSection
        content={content}
        locale={locale}
        onToggleLocale={handleToggleLocale}
      />

      <main>
        <FeaturesSection
          showcase={content.showcase}
          features={content.features}
        />

        <WorkflowSection workflow={content.workflow} />

        <EcosystemSection ecosystem={content.ecosystem} />
      </main>

      <Footer cta={content.cta} footer={content.footer} />
    </div>
  );
}
