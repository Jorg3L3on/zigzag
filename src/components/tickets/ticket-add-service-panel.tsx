import type { Service } from '@/db/schema';
import { ServiceForm } from '@/components/services/service-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  sanitizeDecimal,
  sanitizeInteger,
} from '@/components/tickets/ticket-services-utils';
import { CheckCircle2, Loader2, Minus, Plus, PlusCircle } from 'lucide-react';

type TicketAddServicePanelProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  services: Service[];
  filteredServices: Service[];
  selectedService: string;
  onServiceSelect: (serviceId: string) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  quantity: string;
  onQuantityChange: (value: string) => void;
  onQuantityAdjust: (nextValue: number) => void;
  price: string;
  onPriceChange: (value: string) => void;
  onPriceAdjust: (nextValue: number) => void;
  isCreatingNewService: boolean;
  onStartCreateService: () => void;
  onCancelCreateService: () => void;
  onServiceCreated: (savedService: Service) => void;
  isSubmitting: boolean;
  onAddService: () => void;
};

export const TicketAddServicePanel = ({
  isOpen,
  onOpenChange,
  filteredServices,
  selectedService,
  onServiceSelect,
  searchTerm,
  onSearchTermChange,
  quantity,
  onQuantityChange,
  onQuantityAdjust,
  price,
  onPriceChange,
  onPriceAdjust,
  isCreatingNewService,
  onStartCreateService,
  onCancelCreateService,
  onServiceCreated,
  isSubmitting,
  onAddService,
}: TicketAddServicePanelProps) => (
  <Dialog open={isOpen} onOpenChange={onOpenChange}>
    <DialogTrigger asChild>
      <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md transition-all duration-200 hover:from-blue-700 hover:to-purple-700 hover:shadow-lg sm:w-auto">
        <PlusCircle className="mr-2 h-5 w-5" />
        Agregar servicio
      </Button>
    </DialogTrigger>
    <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-x-hidden sm:max-w-lg">
      <DialogHeader>
        <DialogTitle
          data-initial-focus
          tabIndex={-1}
          className="text-2xl font-semibold text-foreground outline-none focus:outline-none"
        >
          {isCreatingNewService
            ? 'Crear nuevo servicio'
            : 'Agregar servicio al ticket'}
        </DialogTitle>
        <DialogDescription>
          {isCreatingNewService
            ? 'El servicio quedará guardado en el catálogo de tu empresa y podrás agregarlo a este ticket.'
            : 'Selecciona un servicio existente o crea uno nuevo. Define cantidad y precio para agregarlo al ticket.'}
        </DialogDescription>
      </DialogHeader>
      {isCreatingNewService ? (
        <div className="py-2">
          <ServiceForm
            onCancel={onCancelCreateService}
            onSuccess={onServiceCreated}
          />
        </div>
      ) : (
        <div className="grid min-w-0 gap-6 py-4">
          <div className="space-y-3">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-3">
                <Label className="text-sm font-medium text-foreground">
                  Servicio
                </Label>
                <Select value={selectedService} onValueChange={onServiceSelect}>
                  <SelectTrigger className="h-auto min-h-12 w-full items-start whitespace-normal border-2 py-2 transition-colors focus:border-primary [&>span]:block [&>span]:max-w-[calc(100%-1.5rem)] [&>span]:whitespace-normal [&>span]:break-words [&>span]:text-left">
                    <SelectValue placeholder="Seleccione un servicio" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-3rem)]">
                    <div className="flex items-center px-3 pb-2">
                      <Input
                        placeholder="Buscar servicio..."
                        value={searchTerm}
                        onChange={(e) => onSearchTermChange(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      {filteredServices.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No se encontraron servicios
                        </div>
                      ) : (
                        filteredServices.map((service) => (
                          <SelectItem
                            key={service.id}
                            value={service.id.toString()}
                            textValue={service.name}
                            className="items-start whitespace-normal py-2"
                          >
                            <span className="block whitespace-normal break-words pr-2 leading-snug">
                              {service.name}
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </div>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-12 shrink-0 sm:mt-0"
                onClick={onStartCreateService}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nuevo servicio
              </Button>
            </div>
          </div>

          <div className="grid min-w-0 gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">
                Cantidad
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 shrink-0"
                  onClick={() =>
                    onQuantityAdjust(sanitizeInteger(quantity) - 1)
                  }
                  aria-label="Reducir cantidad"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={quantity}
                  onChange={(e) =>
                    onQuantityChange(e.target.value.replace(/[^\d]/g, ''))
                  }
                  onBlur={() => onQuantityAdjust(sanitizeInteger(quantity))}
                  className="h-12 border-2 text-center transition-colors focus:border-primary"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 shrink-0"
                  onClick={() =>
                    onQuantityAdjust(sanitizeInteger(quantity) + 1)
                  }
                  aria-label="Aumentar cantidad"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">
                Precio
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 shrink-0"
                  onClick={() =>
                    onPriceAdjust(
                      Number((sanitizeDecimal(price) - 1).toFixed(2)),
                    )
                  }
                  aria-label="Reducir precio"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => onPriceChange(e.target.value)}
                    onBlur={() => onPriceAdjust(sanitizeDecimal(price))}
                    className="h-12 border-2 pl-8 text-center transition-colors focus:border-primary"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 shrink-0"
                  onClick={() =>
                    onPriceAdjust(
                      Number((sanitizeDecimal(price) + 1).toFixed(2)),
                    )
                  }
                  aria-label="Aumentar precio"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <Button
            type="button"
            onClick={onAddService}
            className="h-12 w-full transform bg-gradient-to-r from-blue-600 to-purple-600 font-medium text-white transition-all duration-200 hover:scale-[1.02] hover:from-blue-700 hover:to-purple-700"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Agregando servicio...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Agregar al ticket
              </>
            )}
          </Button>
        </div>
      )}
    </DialogContent>
  </Dialog>
);
