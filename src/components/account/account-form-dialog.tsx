'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AccountForm } from '@/components/account/account-form';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function AccountFormDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const handleSuccess = async () => {
    setOpen(false);
    await signOut({ redirect: false });
    router.push('/login');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
          <Pencil className="mr-2 h-4 w-4" />
          Editar información
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar información personal</DialogTitle>
          <DialogDescription>
            Actualiza tu información personal. Los cambios se guardarán y serás
            redirigido al inicio de sesión.
          </DialogDescription>
        </DialogHeader>
        <Alert variant="default" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Serás cerrado sesión después de guardar los cambios para que estos
            surtan efecto.
          </AlertDescription>
        </Alert>
        <AccountForm onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  );
}
