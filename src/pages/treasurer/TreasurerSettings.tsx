import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
const supabase: any = supabaseClient;
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Save, Image as ImageIcon, FileSignature, Stamp } from "lucide-react";
import { toast } from "sonner";

export default function TreasurerSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  // Fetch organization settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["organization-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("organization_settings")
        .select("*")
        .single();
      return data;
    },
  });

  const [formData, setFormData] = useState({
    organization_name: "KIRINYAGA HEALTHCARE WORKERS' WELFARE",
    organization_address: "P.O.BOX 24-10300 KERUGOYA, LOCATION: KCRH",
    organization_email: "Khcww2020@gmail.com",
    organization_phone: "+254 712 345 678",
    payout_rules: {
      wedding: 25000,
      death_member: 50000,
      death_spouse: 50000,
      death_child: 50000,
      death_parent: 50000,
      retirement: 30000,
      emergency: 15000,
    },
  });

  // Update form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        organization_name: settings.organization_name || "KIRINYAGA HEALTHCARE WORKERS' WELFARE",
        organization_address: settings.organization_address || "P.O.BOX 24-10300 KERUGOYA, LOCATION: KCRH",
        organization_email: settings.organization_email || "Khcww2020@gmail.com",
        organization_phone: settings.organization_phone || "+254 712 345 678",
        payout_rules: {
          wedding: settings.payout_rules?.wedding ?? 25000,
          death_member: settings.payout_rules?.death_member ?? settings.payout_rules?.death ?? 50000,
          death_spouse: settings.payout_rules?.death_spouse ?? settings.payout_rules?.death ?? 50000,
          death_child: settings.payout_rules?.death_child ?? settings.payout_rules?.death ?? 50000,
          death_parent: settings.payout_rules?.death_parent ?? settings.payout_rules?.death ?? 50000,
          retirement: settings.payout_rules?.retirement ?? 30000,
          emergency: settings.payout_rules?.emergency ?? 15000,
        },
      });
    }
  }, [settings]);

  // Handle file upload
  const handleFileUpload = async (file: File, type: "logo" | "signature" | "stamp") => {
    try {
      setUploading(type);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${Date.now()}.${fileExt}`;
      const filePath = `organization/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("signatures")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("signatures")
        .getPublicUrl(filePath);

      // Update organization settings
      const updateField = `${type}_url`;
      const { error: updateError } = await supabase
        .from("organization_settings")
        .update({ [updateField]: publicUrl, updated_by: user?.id })
        .eq("id", settings?.id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["organization-settings"] });
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(null);
    }
  };

  // Save settings mutation
  const saveSettings = useMutation({
    mutationFn: async (data: any) => {
      setSaving(true);
      const { error } = await supabase
        .from("organization_settings")
        .update({
          organization_name: data.organization_name,
          organization_address: data.organization_address,
          organization_email: data.organization_email,
          organization_phone: data.organization_phone,
          payout_rules: data.payout_rules,
          updated_by: user?.id,
        })
        .eq("id", settings?.id);

      if (error) throw error;
      setSaving(false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-settings"] });
      toast.success("Settings saved successfully");
    },
    onError: (error: any) => {
      setSaving(false);
      toast.error(error.message);
    },
  });

  const handleSave = () => {
    saveSettings.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Organization Information */}
      <Card className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB]">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-[#111827]">Organization Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Organization Name *</Label>
              <Input
                value={formData.organization_name}
                onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                placeholder="e.g., KHCWW"
              />
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input
                value={formData.organization_phone}
                onChange={(e) => setFormData({ ...formData, organization_phone: e.target.value })}
                placeholder="e.g., +254 712 345 678"
              />
            </div>
          </div>

          <div>
            <Label>Email Address</Label>
            <Input
              type="email"
              value={formData.organization_email}
              onChange={(e) => setFormData({ ...formData, organization_email: e.target.value })}
              placeholder="e.g., info@khcww.org"
            />
          </div>

          <div>
            <Label>Physical Address</Label>
            <Textarea
              value={formData.organization_address}
              onChange={(e) => setFormData({ ...formData, organization_address: e.target.value })}
              placeholder="Enter organization address..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Payout Rules */}
      <Card className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB]">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-[#111827]">Payout Rules</CardTitle>
          <p className="text-sm text-[#6B7280] mt-1">
            Set default payout amounts for different event types
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Wedding Payout (Ksh)</Label>
              <Input
                type="number"
                value={formData.payout_rules.wedding}
                onChange={(e) => setFormData({
                  ...formData,
                  payout_rules: { ...formData.payout_rules, wedding: parseInt(e.target.value) }
                })}
              />
            </div>
            <div>
              <Label>Death Payout (Member) (Ksh)</Label>
              <Input
                type="number"
                value={formData.payout_rules.death_member}
                onChange={(e) => setFormData({
                  ...formData,
                  payout_rules: { ...formData.payout_rules, death_member: parseInt(e.target.value) }
                })}
              />
            </div>
            <div>
              <Label>Death Payout (Child) (Ksh)</Label>
              <Input
                type="number"
                value={formData.payout_rules.death_child}
                onChange={(e) => setFormData({
                  ...formData,
                  payout_rules: { ...formData.payout_rules, death_child: parseInt(e.target.value) }
                })}
              />
            </div>
            <div>
              <Label>Death Payout (Spouse) (Ksh)</Label>
              <Input
                type="number"
                value={formData.payout_rules.death_spouse}
                onChange={(e) => setFormData({
                  ...formData,
                  payout_rules: { ...formData.payout_rules, death_spouse: parseInt(e.target.value) }
                })}
              />
            </div>
            <div>
              <Label>Death Payout (Parent) (Ksh)</Label>
              <Input
                type="number"
                value={formData.payout_rules.death_parent}
                onChange={(e) => setFormData({
                  ...formData,
                  payout_rules: { ...formData.payout_rules, death_parent: parseInt(e.target.value) }
                })}
              />
            </div>
            <div>
              <Label>Retirement Payout (Ksh)</Label>
              <Input
                type="number"
                value={formData.payout_rules.retirement}
                onChange={(e) => setFormData({
                  ...formData,
                  payout_rules: { ...formData.payout_rules, retirement: parseInt(e.target.value) }
                })}
              />
            </div>
            <div>
              <Label>Emergency Payout (Ksh)</Label>
              <Input
                type="number"
                value={formData.payout_rules.emergency}
                onChange={(e) => setFormData({
                  ...formData,
                  payout_rules: { ...formData.payout_rules, emergency: parseInt(e.target.value) }
                })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Uploads */}
      <Card className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB]">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-[#111827]">Branding & Documents</CardTitle>
          <p className="text-sm text-[#6B7280] mt-1">
            Upload organization logo, signature, and official stamp for documents
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            {/* Logo Upload */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Organization Logo
              </Label>
              {settings?.logo_url && (
                <div className="border border-[#E5E7EB] rounded-lg p-4 bg-[#F9FAFB]">
                  <img
                    src={settings.logo_url}
                    alt="Logo"
                    className="h-24 mx-auto object-contain"
                  />
                </div>
              )}
              <div>
                <input
                  type="file"
                  id="logo-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, "logo");
                  }}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => document.getElementById("logo-upload")?.click()}
                  disabled={uploading === "logo"}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading === "logo" ? "Uploading..." : "Upload Logo"}
                </Button>
              </div>
            </div>

            {/* Signature Upload */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <FileSignature className="h-4 w-4" />
                Treasurer Signature
              </Label>
              {settings?.signature_url && (
                <div className="border border-[#E5E7EB] rounded-lg p-4 bg-[#F9FAFB]">
                  <img
                    src={settings.signature_url}
                    alt="Signature"
                    className="h-24 mx-auto object-contain"
                  />
                </div>
              )}
              <div>
                <input
                  type="file"
                  id="signature-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, "signature");
                  }}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => document.getElementById("signature-upload")?.click()}
                  disabled={uploading === "signature"}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading === "signature" ? "Uploading..." : "Upload Signature"}
                </Button>
              </div>
            </div>

            {/* Stamp Upload */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Stamp className="h-4 w-4" />
                Official Stamp
              </Label>
              {settings?.stamp_url && (
                <div className="border border-[#E5E7EB] rounded-lg p-4 bg-[#F9FAFB]">
                  <img
                    src={settings.stamp_url}
                    alt="Stamp"
                    className="h-24 mx-auto object-contain"
                  />
                </div>
              )}
              <div>
                <input
                  type="file"
                  id="stamp-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, "stamp");
                  }}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => document.getElementById("stamp-upload")?.click()}
                  disabled={uploading === "stamp"}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading === "stamp" ? "Uploading..." : "Upload Stamp"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-8"
          disabled={saving}
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
