import {
  COMPANY_FORM_SECTIONS_STORAGE_KEY,
  DEFAULT_COMPANY_FORM_SECTIONS,
  firstInvalidCompanyField,
  readCompanyFormSections,
  summarizeCompanyAddress,
  summarizeCompanyGeneral,
  summarizeCompanySettings,
  writeCompanyFormSections,
} from '@/lib/company-form-sections';

describe('company-form-sections', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('finds the first invalid field in form order and its section', () => {
    expect(
      firstInvalidCompanyField({
        settings: { rfc: { message: 'RFC inválido' } },
        city: { message: 'Requerido' },
      }),
    ).toEqual({ field: 'city', section: 'direccion' });
    expect(
      firstInvalidCompanyField({ settings: { tagline: { message: 'x' } } }),
    ).toEqual({ field: 'settings.tagline', section: 'configuracion' });
    expect(firstInvalidCompanyField({})).toBeNull();
  });

  it('summarizes each section in one line', () => {
    expect(
      summarizeCompanyGeneral({ name: 'ClimaTotal', email: 'hola@clima.mx', phone: '' }),
    ).toBe('ClimaTotal · hola@clima.mx');
    expect(
      summarizeCompanyAddress({
        street: 'Av. Juárez',
        exterior_number: '120',
        neighborhood: 'Centro',
        city: 'Mérida',
        postal_code: '97000',
      }),
    ).toBe('Av. Juárez 120, Centro, Mérida, CP 97000');
    expect(summarizeCompanyAddress({})).toBe('Sin dirección');
    expect(
      summarizeCompanySettings({
        rfc: 'CTD010101AAA',
        default_currency: 'MXN',
        experience_mode: 'campo',
      }),
    ).toBe('RFC CTD010101AAA · MXN · Inicio Campo');
    expect(summarizeCompanySettings(undefined)).toBe('Sin RFC · MXN · Inicio automático');
  });

  it('remembers open sections per viewer and survives bad storage', () => {
    expect(readCompanyFormSections()).toEqual(DEFAULT_COMPANY_FORM_SECTIONS);

    writeCompanyFormSections({ general: false, direccion: true, configuracion: false });
    expect(readCompanyFormSections()).toEqual({
      general: false,
      direccion: true,
      configuracion: false,
    });

    window.localStorage.setItem(COMPANY_FORM_SECTIONS_STORAGE_KEY, '{not json');
    expect(readCompanyFormSections()).toEqual(DEFAULT_COMPANY_FORM_SECTIONS);
  });
});
