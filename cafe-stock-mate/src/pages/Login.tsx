import { useState } from 'react';
import { Delete } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 6;

const PAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '⌫'],
];

export default function Login() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'identifier' | 'pin'>('identifier');

  const handlePadPress = (key: string) => {
    if (key === '⌫') {
      setPin(p => p.slice(0, -1));
      setError('');
      return;
    }
    if (pin.length >= MAX_PIN_LENGTH) return;
    const next = pin + key;
    setPin(next);
    setError('');
    if (next.length === MAX_PIN_LENGTH) {
      submitLogin(next);
    }
  };

  const submitLogin = async (pinValue: string) => {
    if (!identifier.trim()) { setStep('identifier'); return; }
    setIsLoading(true);
    setError('');
    try {
      await login(identifier.trim(), pinValue);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid credentials');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleIdentifierNext = () => {
    if (!identifier.trim()) { setError('Please enter your phone number or email'); return; }
    setError('');
    setStep('pin');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-primary px-6 pt-16 pb-12 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 mb-4">
          <span className="text-3xl font-bold text-white">D</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Dumont</h1>
        <p className="text-white/70 text-sm mt-1">Inventory Management</p>
      </div>

      <div className="flex-1 px-6 pt-8 pb-6 flex flex-col max-w-sm mx-auto w-full">

        {step === 'identifier' ? (
          /* ── Step 1: Phone / Email ── */
          <div className="space-y-4">
            <div>
              <p className="text-base font-semibold text-foreground mb-1">Welcome back</p>
              <p className="text-sm text-muted-foreground">Enter your phone number or email to continue</p>
            </div>

            <div className="space-y-3 mt-4">
              <input
                type="text"
                inputMode="tel"
                placeholder="Phone number or email"
                value={identifier}
                onChange={e => { setIdentifier(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleIdentifierNext()}
                autoFocus
                className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {error && <p className="text-xs text-destructive font-medium">{error}</p>}
              <button
                onClick={handleIdentifierNext}
                className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-white active:opacity-90 transition-opacity"
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          /* ── Step 2: PIN ── */
          <div className="space-y-6">
            <div>
              <button
                onClick={() => { setStep('identifier'); setPin(''); setError(''); }}
                className="text-xs text-primary font-semibold mb-3 flex items-center gap-1"
              >
                ← Back
              </button>
              <p className="text-base font-semibold text-foreground">Enter your PIN</p>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">{identifier}</p>
              <p className="text-xs text-muted-foreground mt-1">{MIN_PIN_LENGTH}–{MAX_PIN_LENGTH} digits</p>
            </div>

            {/* PIN dots */}
            <div className="flex justify-center gap-2.5 sm:gap-3">
              {Array.from({ length: MAX_PIN_LENGTH }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-4 w-4 rounded-full border-2 transition-all duration-150',
                    i < pin.length
                      ? 'bg-primary border-primary scale-110'
                      : 'bg-transparent border-border'
                  )}
                />
              ))}
            </div>

            {error && (
              <p className="text-center text-xs text-destructive font-medium -mt-2">{error}</p>
            )}

            {isLoading && (
              <p className="text-center text-xs text-muted-foreground animate-pulse">Signing in…</p>
            )}

            {pin.length >= MIN_PIN_LENGTH && pin.length < MAX_PIN_LENGTH && !isLoading && (
              <button
                type="button"
                onClick={() => submitLogin(pin)}
                className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-white active:opacity-90"
              >
                Sign in
              </button>
            )}

            {/* PIN pad */}
            <div className="grid grid-cols-3 gap-3 mt-2">
              {PAD_KEYS.flat().map((key, idx) => {
                if (key === '') return <div key={idx} />;
                return (
                  <button
                    key={idx}
                    onClick={() => handlePadPress(key)}
                    disabled={isLoading}
                    className={cn(
                      'flex items-center justify-center rounded-2xl h-16 text-xl font-semibold transition-all active:scale-95',
                      key === '⌫'
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-card border border-border text-foreground shadow-sm active:bg-muted'
                    )}
                  >
                    {key === '⌫' ? <Delete className="h-5 w-5" /> : key}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-[10px] text-muted-foreground pb-6">
        Dumont Manual Inventory v1.0
      </p>
    </div>
  );
}
