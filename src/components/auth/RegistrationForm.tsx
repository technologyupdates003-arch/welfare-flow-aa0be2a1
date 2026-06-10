import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  getRegistrationConfig,
  submitRegistration,
  initiateRegistrationPayment,
  formatPhoneNumber,
  validatePhoneNumber,
} from "@/lib/member-registration";

interface RegistrationFormProps {
  onSuccess?: () => void;
}

export default function RegistrationForm({ onSuccess }: RegistrationFormProps) {
  const [step, setStep] = useState<"form" | "payment" | "success">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registrationId, setRegistrationId] = useState("");
  const [fee, setFee] = useState(0);
  const [config, setConfig] = useState<any>(null);

  const [formData, setFormData] = useState({
    full_name: "",
    phone_number: "",
    department: "",
    working_location: "",
  });

  const [paymentData, setPaymentData] = useState({
    phone_number: "",
  });

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      const cfg = await getRegistrationConfig();
      setConfig(cfg);
      setFee(cfg.registration_fee || 1000);
    };
    loadConfig();
  }, []);

  const handleFormChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validate
    if (!formData.full_name.trim() || formData.full_name.length < 3) {
      setError("Full name must be at least 3 characters");
      setLoading(false);
      return;
    }

    if (!validatePhoneNumber(formData.phone_number)) {
      setError("Invalid phone number format (use 0712345678 or +254712345678)");
      setLoading(false);
      return;
    }

    if (!formData.department.trim()) {
      setError("Department is required");
      setLoading(false);
      return;
    }

    if (!formData.working_location.trim()) {
      setError("Working location is required");
      setLoading(false);
      return;
    }

    // Submit registration
    const result = await submitRegistration({
      full_name: formData.full_name.trim(),
      phone_number: formatPhoneNumber(formData.phone_number),
      department: formData.department.trim(),
      working_location: formData.working_location.trim(),
    });

    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    setRegistrationId(result.registration_id || "");
    setPaymentData({ phone_number: formData.phone_number });
    setStep("payment");
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!validatePhoneNumber(paymentData.phone_number)) {
      setError("Invalid phone number format");
      setLoading(false);
      return;
    }

    const result = await initiateRegistrationPayment(
      registrationId,
      formatPhoneNumber(paymentData.phone_number)
    );

    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    // Move to success step
    setStep("success");
  };

  return (
    <div className="w-full max-w-md">
      {step === "form" && (
        <Card className="animate-fade-in">
          <CardHeader className="space-y-2">
            <CardTitle>Join Our Welfare Group</CardTitle>
            <CardDescription>
              Complete your registration to become a member
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Requirements Info */}
              {config && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Requirements:</p>
                    <p>• Registration Fee: KES {config.registration_fee}</p>
                    <p>• Must join by: {new Date(config.retiring_date).toLocaleDateString()}</p>
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  placeholder="John Doe"
                  value={formData.full_name}
                  onChange={(e) => handleFormChange("full_name", e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone_number">Phone Number *</Label>
                <Input
                  id="phone_number"
                  placeholder="0712345678"
                  value={formData.phone_number}
                  onChange={(e) => handleFormChange("phone_number", e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">Format: 0712345678 or +254712345678</p>
              </div>

              {/* Department */}
              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Input
                  id="department"
                  placeholder="e.g., IT, HR, Finance"
                  value={formData.department}
                  onChange={(e) => handleFormChange("department", e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Working Location */}
              <div className="space-y-2">
                <Label htmlFor="working_location">Working Location *</Label>
                <Input
                  id="working_location"
                  placeholder="e.g., Nairobi, Mombasa"
                  value={formData.working_location}
                  onChange={(e) => handleFormChange("working_location", e.target.value)}
                  disabled={loading}
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Continue to Payment"
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Secure registration. Your information is encrypted.
              </p>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "payment" && (
        <Card className="animate-fade-in">
          <CardHeader className="space-y-2">
            <CardTitle>Complete Payment</CardTitle>
            <CardDescription>
              Pay registration fee via M-Pesa to activate your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Payment Summary */}
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Member Name:</span>
                  <span className="font-semibold">{formData.full_name}</span>
                </div>
                <div className="flex justify-between pb-2 border-b">
                  <span className="text-muted-foreground">Department:</span>
                  <span className="font-semibold">{formData.department}</span>
                </div>
                <div className="flex justify-between text-lg pt-2">
                  <span className="font-semibold">Amount:</span>
                  <span className="font-bold text-primary">KES {fee.toLocaleString()}</span>
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="payment_phone">M-Pesa Phone Number *</Label>
                <Input
                  id="payment_phone"
                  placeholder="0712345678"
                  value={paymentData.phone_number}
                  onChange={(e) => setPaymentData({ ...paymentData, phone_number: e.target.value })}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Where you'll receive the M-Pesa payment prompt
                </p>
              </div>

              {/* Payment Instructions */}
              <Alert className="bg-green-50 border-green-200">
                <AlertCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-sm text-green-900">
                  <p className="font-semibold mb-1">📱 Payment Instructions:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Click "Send Payment Prompt"</li>
                    <li>You'll receive M-Pesa prompt on your phone</li>
                    <li>Enter your M-Pesa PIN to complete payment</li>
                    <li>Wait for confirmation SMS</li>
                  </ol>
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("form")}
                  disabled={loading}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Payment Prompt"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "success" && (
        <Card className="animate-fade-in">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <CardTitle>Payment Initiated!</CardTitle>
              <CardDescription>
                Your registration is being processed
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-900">
                <p className="font-semibold mb-2">✓ What happens next:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Check your phone for M-Pesa prompt (if not received, retry in 30 seconds)</li>
                  <li>Complete the payment</li>
                  <li>You'll receive SMS confirming payment</li>
                  <li>Admin will review and approve your registration</li>
                  <li>You'll receive system access link via SMS</li>
                </ol>
              </AlertDescription>
            </Alert>

            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm text-amber-900">
                <p className="font-semibold mb-1">⏱️ Timeline:</p>
                <p>Registration expires in 7 days if not completed</p>
              </AlertDescription>
            </Alert>

            <Button
              onClick={() => {
                setStep("form");
                setFormData({
                  full_name: "",
                  phone_number: "",
                  department: "",
                  working_location: "",
                });
                setRegistrationId("");
                onSuccess?.();
              }}
              className="w-full"
            >
              Start New Registration
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Registration ID: {registrationId?.slice(0, 8)}... (save this for reference)
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
