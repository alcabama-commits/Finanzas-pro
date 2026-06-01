import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { signInWithGoogle } from '@/src/lib/firebase';
import { Wallet, LogIn } from 'lucide-react';
import { motion } from 'motion/react';

export function Auth() {
  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="w-full max-w-md border-none shadow-xl bg-white">
          <CardHeader className="text-center pt-8">
            <div className="mx-auto bg-zinc-900 text-white p-3 rounded-2xl w-fit mb-4">
              <Wallet className="size-8" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Finanza Pro</CardTitle>
            <CardDescription className="text-zinc-500">
              Toma el control de tus finanzas personales hoy mismo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 py-6">
            <div className="space-y-2 text-center text-sm text-zinc-600">
              <p>• Gestiona tus ingresos y gastos</p>
              <p>• Establece límites de presupuesto</p>
              <p>• Visualiza tu progreso con gráficas</p>
              <p>• Ciclos quincenales y mensuales</p>
            </div>
          </CardContent>
          <CardFooter className="pb-8">
            <Button 
              onClick={handleLogin} 
              className="w-full py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all"
            >
              <LogIn className="mr-2 size-5" />
              Continuar con Google
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
