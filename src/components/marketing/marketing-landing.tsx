import { LandingAcceso } from '@/components/marketing/landing/landing-acceso';
import { LandingAsistentes } from '@/components/marketing/landing/landing-asistentes';
import { LandingComoFunciona } from '@/components/marketing/landing/landing-como-funciona';
import { LandingFacts } from '@/components/marketing/landing/landing-facts';
import { LandingFunciones } from '@/components/marketing/landing/landing-funciones';
import { LandingHero } from '@/components/marketing/landing/landing-hero';
import { LandingPreguntas } from '@/components/marketing/landing/landing-preguntas';
import { LandingProblem } from '@/components/marketing/landing/landing-problem';
import { LandingTelefonoComputadora } from '@/components/marketing/landing/landing-telefono-computadora';

/**
 * Landing body ("Papel y tinta"), in canvas order. MarketingShell adds the
 * top bar and the footer around it.
 */
export const MarketingLanding = () => (
  <>
    <LandingHero />
    <LandingFacts />
    <LandingProblem />
    <LandingComoFunciona />
    <LandingFunciones />
    <LandingTelefonoComputadora />
    <LandingAsistentes />
    <LandingPreguntas />
    <LandingAcceso />
  </>
);
