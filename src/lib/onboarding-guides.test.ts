import { getWrittenGuides, guideHref } from '@/components/ayuda/guide-registry';
import { AYUDA_PATH } from '@/lib/marketing-routes';
import {
  HELP_CENTER_LINK,
  OPERATOR_GUIDE_ANCHORS,
} from './onboarding-guides';
import * as onboardingGuides from './onboarding-guides';

describe('onboarding-guides', () => {
  it('has one help link, to the /ayuda help centre', () => {
    expect(HELP_CENTER_LINK.href).toBe(AYUDA_PATH);
    expect(HELP_CENTER_LINK.href).toBe('/ayuda');
  });

  it('retires the executive summary and the static /guides paths (ZIG-I40-6)', () => {
    const exported = JSON.stringify(onboardingGuides);
    expect(exported).not.toMatch(/\/guides|resumen-ejecutivo|investor/);
    expect(Object.keys(onboardingGuides)).not.toEqual(
      expect.arrayContaining(['EXECUTIVE_SUMMARY_LINK']),
    );
  });

  it('points every checklist link at /ayuda or a written guide', () => {
    const written = new Set(getWrittenGuides().map((guide) => guideHref(guide.slug)));
    for (const href of Object.values(OPERATOR_GUIDE_ANCHORS)) {
      expect(href === AYUDA_PATH || written.has(href)).toBe(true);
    }
    expect(OPERATOR_GUIDE_ANCHORS.crearTicket).toBe('/ayuda/crear-un-ticket');
    expect(OPERATOR_GUIDE_ANCHORS.clientes).toBe('/ayuda/guardar-un-cliente');
  });
});
