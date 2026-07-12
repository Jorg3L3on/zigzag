import {
  EMPRESA_GUIDE_LINK,
  EMPRESA_MAESTRA_GUIDE_LINK,
  EXECUTIVE_SUMMARY_LINK,
  getGuidesMenuHref,
  getOnboardingGuidesForUser,
  ONBOARDING_GUIDE_PATHS,
  OPERATOR_GUIDE_ANCHORS,
  PUBLIC_ONBOARDING_GUIDE_LINKS,
} from './onboarding-guides';

describe('onboarding-guides', () => {
  it('exposes investor and tenant guides on login, not the platform guide', () => {
    expect(PUBLIC_ONBOARDING_GUIDE_LINKS).toEqual([
      EXECUTIVE_SUMMARY_LINK,
      EMPRESA_GUIDE_LINK,
    ]);
    expect(PUBLIC_ONBOARDING_GUIDE_LINKS).not.toContain(
      EMPRESA_MAESTRA_GUIDE_LINK,
    );
  });

  it('scopes authenticated guides by company type', () => {
    expect(getOnboardingGuidesForUser(false)).toEqual([EMPRESA_GUIDE_LINK]);
    expect(getOnboardingGuidesForUser(true)).toEqual([
      EXECUTIVE_SUMMARY_LINK,
      expect.objectContaining({ href: ONBOARDING_GUIDE_PATHS.empresaMaestra }),
      EMPRESA_GUIDE_LINK,
    ]);
  });

  it('routes the Guías menu to index for system users', () => {
    expect(getGuidesMenuHref(false)).toBe(ONBOARDING_GUIDE_PATHS.empresa);
    expect(getGuidesMenuHref(true)).toBe(ONBOARDING_GUIDE_PATHS.index);
  });

  it('exposes deep links into the operator guide', () => {
    expect(OPERATOR_GUIDE_ANCHORS.miEmpresa).toBe(
      `${ONBOARDING_GUIDE_PATHS.empresa}#paso-3`,
    );
    expect(OPERATOR_GUIDE_ANCHORS.crearTicket).toBe(
      `${ONBOARDING_GUIDE_PATHS.empresa}#paso-7`,
    );
    expect(OPERATOR_GUIDE_ANCHORS.facturaPdf).toContain('#paso-10');
  });
});
