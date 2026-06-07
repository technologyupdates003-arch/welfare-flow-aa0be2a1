import { ReactNode, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  getSecurity,
  savePin,
  verifyPin,
  isUnlocked,
  setUnlocked,
  registerBiometric,
  verifyBiometric,
  biometricSupported,
  platformAuthenticatorAvailable,
} from "@/lib/dashboardLock";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, Lock, Fingerprint, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface DashboardLockProps {
  area: string;
  children: ReactNode;
}

export default function DashboardLock({ area, children }: DashboardLockProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlockedState] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [mode, setMode] = useState<"unlock" | "setup">("unlock");
  const [busy, setBusy] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);

  // Detect a real fingerprint/face sensor on this device.
  useEffect(() => {
    platformAuthenticatorAvailable().then(setBioAvailable);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    if (isUnlocked(area)) {
      setUnlockedState(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    const sec = await getSecurity(user.id);
    setHasPin(!!sec?.pin_hash);
    setHasBiometric(!!sec?.webauthn_credential_id);
    setMode(sec?.pin_hash ? "unlock" : "setup");
    setLoading(false);
  }, [user, area]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-trigger biometric prompt when available on the unlock screen.
  const tryBiometric = useCallback(async () => {
    if (!user) return;
    try {
      setBusy(true);
      const ok = await verifyBiometric(user.id);
      if (ok) {
        setUnlocked(area);
        setUnlockedState(true);
        toast.success("Unlocked");
      } else {
        toast.error("Biometric not recognized");
      }
    } catch (e: any) {
      toast.error(e?.message || "Biometric failed");
    } finally {
      setBusy(false);
    }
  }, [user, area]);

  const handleUnlock = async () => {
    if (!user || pin.length < 4) return;
    setBusy(true);
    const ok = await verifyPin(user.id, pin);
    setBusy(false);
    if (ok) {
      setUnlocked(area);
      setUnlockedState(true);
      setPin("");
      toast.success("Unlocked");
    } else {
      toast.error("Incorrect PIN");
      setPin("");
    }
  };

  const handleCreatePin = async () => {
    if (!user) return;
    if (pin.length < 4) {
      toast.error("PIN must be at least 4 digits");
      return;
    }
    if (pin !== confirmPin) {
      toast.error("PINs do not match");
      return;
    }
    setBusy(true);
    try {
      await savePin(user.id, pin);
      setUnlocked(area);
      setUnlockedState(true);
      toast.success("PIN created");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save PIN");
    } finally {
      setBusy(false);
    }
  };

  const handleEnrollBiometric = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await registerBiometric(user.id, user.email || "user");
      setHasBiometric(true);
      toast.success("Fingerprint enabled");
    } catch (e: any) {
      toast.error(e?.message || "Could not enable fingerprint");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm border-primary/20 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-lg">
            {mode === "setup" ? "Secure your dashboard" : "Enter your PIN"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {mode === "setup"
              ? "Create a PIN to protect access to this dashboard."
              : "This dashboard is locked. Verify to continue."}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {mode === "setup" ? (
            <>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">New PIN</p>
                <div className="flex justify-center">
                  <InputOTP maxLength={4} value={pin} onChange={setPin}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Confirm PIN</p>
                <div className="flex justify-center">
                  <InputOTP maxLength={4} value={confirmPin} onChange={setConfirmPin}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              <Button className="w-full" onClick={handleCreatePin} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Create PIN & Unlock
              </Button>
              {bioAvailable && (
                <Button variant="outline" className="w-full" onClick={handleEnrollBiometric} disabled={busy}>
                  <Fingerprint className="h-4 w-4 mr-2" />
                  {hasBiometric ? "Fingerprint enabled" : "Enable fingerprint (optional)"}
                </Button>
              )}
            </>
          ) : (
            <>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={4}
                  value={pin}
                  onChange={(v) => {
                    setPin(v);
                  }}
                  onComplete={handleUnlock}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button className="w-full" onClick={handleUnlock} disabled={busy || pin.length < 4}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
                Unlock
              </Button>
              {biometricSupported() && hasBiometric && (
                <Button variant="outline" className="w-full" onClick={tryBiometric} disabled={busy}>
                  <Fingerprint className="h-4 w-4 mr-2" />
                  Use fingerprint
                </Button>
              )}
              {biometricSupported() && !hasBiometric && (
                <Button variant="ghost" size="sm" className="w-full" onClick={handleEnrollBiometric} disabled={busy}>
                  <Fingerprint className="h-4 w-4 mr-2" />
                  Set up fingerprint unlock
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
