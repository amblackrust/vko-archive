import { Footer } from "@/components/shell/footer";
import { FooterGate } from "@/components/shell/footer-gate";
import { Header } from "@/components/shell/header";
import { AssistantWidget } from "@/components/assistant/assistant-widget";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="main">{children}</main>
      <FooterGate>
        <Footer />
      </FooterGate>
      <AssistantWidget />
    </>
  );
}
