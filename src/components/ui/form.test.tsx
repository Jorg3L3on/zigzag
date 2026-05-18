import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
});

type Values = z.infer<typeof schema>;

const TestForm = () => {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => undefined)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input aria-label="Nombre" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit">Enviar</button>
      </form>
    </Form>
  );
};

describe('Form accessibility', () => {
  it('associates validation errors with inputs via aria-describedby', async () => {
    const user = userEvent.setup();
    render(<TestForm />);

    const input = screen.getByRole('textbox', { name: 'Nombre' });
    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => {
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    const message = screen.getByRole('alert');
    expect(message).toHaveTextContent(/El nombre es requerido/i);

    const messageId = message.getAttribute('id');
    expect(messageId).toBeTruthy();
    expect(input.getAttribute('aria-describedby')).toContain(messageId!);
  });
});
