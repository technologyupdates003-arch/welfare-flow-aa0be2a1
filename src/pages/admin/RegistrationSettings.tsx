import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, CheckCircle2, Loader2, Settings } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

export default function RegistrationSettings() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [config, setConfig] = useState({
    retiring_date: "",
    registration_fee: 1000,
    active: true,
  });

  const [displaySettings, setDisplaySettings] = useState({
    show_on_login: true,
    auto_approve: false,
  });

  // Load configuration
  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      try {
        // Get session for auth header
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (!token) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }

        // Fetch config from admin API
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-registration/config`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setConfig(data.data);
          setDisplaySettings({
            show_on_login: data.data.show_on_login ?? true,
            auto_approve: data.data.auto_approve ?? false,
          });
          // Mirror to localStorage for immediate Login page use
          localStorage.setItem(
            "registration_display_settings",
            JSON.stringify({
              show_on_login: data.data.show_on_login ?? true,
              auto_approve: data.data.auto_approve ?? false,
            })
          );
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const handleConfigChange = (field: string, value: any) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setError("");
    setSuccess("");
  };

  const handleDisplayChange = (field: string, value: boolean) => {
    setDisplaySettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        setError("Not authenticated");
        setSaving(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-registration/config`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            retiring_date: config.retiring_date,
            registration_fee: config.registration_fee,
            active: config.active,
            show_on_login: displaySettings.show_on_login,
            auto_approve: displaySettings.auto_approve,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save configuration");
      }

      // Save display settings to localStorage
      localStorage.setItem("registration_display_settings", JSON.stringify(displaySettings));

      setSuccess("Registration configuration updated successfully!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Registration Configuration
          </CardTitle>
          <CardDescription>
            Configure member registration requirements and display settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900">{success}</AlertDescription>
            </Alert>
          )}

          {/* Active Status */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="space-y-1">
              <Label className="text-base font-semibold">Registration Status</Label>
              <p className="text-sm text-muted-foreground">Enable/disable member registration</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={config.active}
                onCheckedChange={(value) => handleConfigChange("active", value)}
                disabled={saving}
              />
              <span className="text-sm font-semibold">
                {config.active ? "🟢 Active" : "🔴 Inactive"}
              </span>
            </div>
          </div>

          {/* Retiring Date */}
          <div className="space-y-2">
            <Label htmlFor="retiring_date">Retiring Date (Deadline to Join)</Label>
            <Input
              id="retiring_date"
              type="date"
              value={config.retiring_date}
              onChange={(e) => handleConfigChange("retiring_date", e.target.value)}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              Members must join before this date to be eligible
            </p>
          </div>

          {/* Registration Fee */}
          <div className="space-y-2">
            <Label htmlFor="registration_fee">Registration Fee (KES)</Label>
            <Input
              id="registration_fee"
              type="number"
              min="1"
              value={config.registration_fee}
              onChange={(e) => handleConfigChange("registration_fee", parseInt(e.target.value))}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              Amount members must pay to complete registration (goes to operations wallet)
            </p>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSaveConfig}
            disabled={saving}
            className="w-full"
            size="lg"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Save Configuration
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Display Settings</CardTitle>
          <CardDescription>Configure how registration appears to users</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Show on Login Page */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="space-y-1">
              <Label className="text-base font-semibold">Show on Login Page</Label>
              <p className="text-sm text-muted-foreground">
                Display registration form on login page when active
              </p>
            </div>
            <Switch
              checked={displaySettings.show_on_login}
              onCheckedChange={(value) => handleDisplayChange("show_on_login", value)}
            />
          </div>

          {/* Auto Approve */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="space-y-1">
              <Label className="text-base font-semibold">Auto Approve</Label>
              <p className="text-sm text-muted-foreground">
                Automatically approve registrations (not recommended)
              </p>
            </div>
            <Switch
              checked={displaySettings.auto_approve}
              onCheckedChange={(value) => handleDisplayChange("auto_approve", value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Display settings are saved locally and apply immediately
          </p>
        </CardContent>
      </Card>

      {/* Info Box */}
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900">
          <p className="font-semibold mb-2">📋 Registration Flow:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>User submits registration form with details</li>
            <li>User initiates M-Pesa payment for registration fee</li>
            <li>Payment is verified automatically</li>
            <li>Admin reviews registration</li>
            <li>Admin approves or rejects</li>
            <li>If approved, member receives system access link via SMS</li>
            <li>Member completes account setup</li>
          </ol>
        </AlertDescription>
      </Alert>
    </div>
  );
}
