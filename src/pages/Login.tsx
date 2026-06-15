 import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import logoImage from "@/assets/WhatsApp Image 2026-04-13 at 12.35.07.jpeg";
import RegistrationForm from "@/components/auth/RegistrationForm";

export default function Login() {
  const { signIn } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);

  // Check if registration is enabled (fetch from public backend config)
  useEffect(() => {
    const checkRegistration = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/member-registration/config`
        );
        if (res.ok) {
          const json = await res.json();
          const cfg = json?.data || {};
          setRegistrationEnabled(Boolean(cfg.active) && cfg.show_on_login !== false);
          return;
        }
      } catch {
        // fall back to localStorage below
      }
      const settings = localStorage.getItem("registration_display_settings");
      if (settings) {
        try {
          const parsed = JSON.parse(settings);
          // Only show when registration is active AND set to display on login
          const isActive = parsed.active ?? false;
          setRegistrationEnabled(isActive && (parsed.show_on_login ?? false));
        } catch {
          setRegistrationEnabled(false);
        }
      }
    };
    checkRegistration();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const formatted = phone.startsWith("+254") ? phone : `+254${phone.replace(/^0/, "")}`;
    const { error } = await signIn(formatted, password);
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo and Title */}
        <div className="text-center space-y-2 mb-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center">
            <img 
              src={logoImage} 
              alt="Kirinyaga Health Care Workers Welfare" 
              className="h-full w-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold">KIRINYAGA HCWW</h1>
        </div>

        {/* Tabs for Login and Registration */}
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Sign In</TabsTrigger>
            {registrationEnabled && (
              <TabsTrigger value="register">Register</TabsTrigger>
            )}
          </TabsList>

          {/* Login Tab */}
          <TabsContent value="login">
            <Card>
              <CardHeader className="text-center space-y-2">
                <CardTitle>Sign In</CardTitle>
                <CardDescription>Sign in with your phone number</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      placeholder="+254XXXXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
                    <Checkbox
                      id="terms"
                      checked={agreedToTerms}
                      onCheckedChange={(v) => setAgreedToTerms(v === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="terms" className="text-xs font-normal leading-relaxed text-muted-foreground">
                      By ticking this box, you confirm that you are an active member of KHCW
                      Welfare Group and agree to honor all statutory obligations, including
                      contributions, platform maintenance fees, and the Statutory Lifetime
                      Onboarding Fee. You also consent to the secure processing of your personal
                      data under the Kenya Data Protection Act (2019). Read the full{" "}
                      <TermsAndConditionsDialog />.
                    </Label>
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading || !agreedToTerms}>
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Registration Tab */}
          {registrationEnabled && (
            <TabsContent value="register">
              <RegistrationForm onSuccess={() => {
                // Reset to login tab after successful registration
                setTimeout(() => {
                  setPhone("");
                  setPassword("");
                }, 1000);
              }} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
