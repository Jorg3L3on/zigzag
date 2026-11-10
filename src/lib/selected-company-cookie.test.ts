import {
  parseSelectedCompanyCookie,
  parseSelectedCompanyJson,
  SELECTED_COMPANY_COOKIE_NAME,
  serializeSelectedCompanyCookie,
  writeSelectedCompanyCookie,
} from '@/lib/selected-company-cookie';

const chano = {
  id: 7,
  name: 'SOLUCIONES CHANO',
  logoUrl: null,
  plan: 'Enterprise',
  is_system: false,
};

describe('selected company cookie', () => {
  afterEach(() => {
    document.cookie = `${SELECTED_COMPANY_COOKIE_NAME}=; path=/; max-age=0`;
  });

  it('round-trips a company through serialize and parse', () => {
    expect(
      parseSelectedCompanyCookie(serializeSelectedCompanyCookie(chano)),
    ).toEqual(chano);
  });

  it.each([
    ['absent', undefined],
    ['empty', ''],
    ['not JSON', 'not-json'],
    ['bad URI encoding', '%E0%A4%A'],
    ['an array', encodeURIComponent('[1]')],
    ['id zero', encodeURIComponent(JSON.stringify({ ...chano, id: 0 }))],
    ['negative id', encodeURIComponent(JSON.stringify({ ...chano, id: -3 }))],
    ['string id', encodeURIComponent(JSON.stringify({ ...chano, id: '7' }))],
    ['fractional id', encodeURIComponent(JSON.stringify({ ...chano, id: 1.5 }))],
    ['no name', encodeURIComponent(JSON.stringify({ ...chano, name: '' }))],
  ])('ignores a cookie that is %s', (_label, value) => {
    expect(parseSelectedCompanyCookie(value)).toBeNull();
  });

  it('normalizes missing optional fields', () => {
    expect(parseSelectedCompanyJson(JSON.stringify({ id: 3, name: 'Beta' }))).toEqual({
      id: 3,
      name: 'Beta',
      logoUrl: null,
      plan: 'Enterprise',
      is_system: false,
    });
  });

  it('drops the logo when the cookie would be too long', () => {
    const long = { ...chano, logoUrl: `https://x.test/${'a'.repeat(4000)}` };
    expect(parseSelectedCompanyCookie(serializeSelectedCompanyCookie(long))).toEqual({
      ...chano,
      logoUrl: null,
    });
  });

  it('writes and clears the cookie in the browser', () => {
    writeSelectedCompanyCookie(chano);
    const raw = document.cookie
      .split('; ')
      .find((part) => part.startsWith(`${SELECTED_COMPANY_COOKIE_NAME}=`))
      ?.slice(SELECTED_COMPANY_COOKIE_NAME.length + 1);
    expect(parseSelectedCompanyCookie(raw)).toEqual(chano);

    writeSelectedCompanyCookie(null);
    expect(document.cookie).not.toContain(`${SELECTED_COMPANY_COOKIE_NAME}=`);
  });
});
