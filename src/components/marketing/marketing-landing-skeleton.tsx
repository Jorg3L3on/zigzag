import Link from 'next/link';
import Image from 'next/image';

/**
 * Minimal public landing for the route-gate slice.
 * Full buyer composition lands in the Spanish landing slice.
 */
export const MarketingLandingSkeleton = () => {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-12 sm:px-6 sm:py-16">
      <section
        className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]"
        aria-labelledby="landing-hero-heading"
      >
        <div className="space-y-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            ZigZag
          </p>
          <h1
            id="landing-hero-heading"
            className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl"
          >
            Tickets, cobranza y facturas PDF para empresas de servicios
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Una plataforma multi-empresa para operar clientes, servicios y
            cobros en un solo lugar — lista para móvil.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Iniciar sesión
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ver cómo funciona
            </a>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_24px_60px_-28px_rgba(37,99,235,0.45)]">
          <Image
            src="/guides/images/empresa/01-dashboard.webp"
            alt="Captura del dashboard de ZigZag con métricas y tickets"
            width={1200}
            height={750}
            className="h-auto w-full object-cover"
            priority
          />
        </div>
      </section>

      <section
        id="como-funciona"
        className="scroll-mt-24 space-y-4 rounded-2xl border border-border/70 bg-background/70 p-6 sm:p-8"
        aria-labelledby="como-funciona-heading"
      >
        <h2
          id="como-funciona-heading"
          className="text-2xl font-semibold tracking-tight"
        >
          Cómo funciona
        </h2>
        <p className="max-w-3xl text-muted-foreground">
          Cliente → Ticket → Servicios → Cobro → Factura PDF. La página
          completa de producto se publicará en la siguiente entrega de
          marketing; este esqueleto confirma que el acceso público a ZigZag ya
          está abierto.
        </p>
      </section>
    </div>
  );
};
