import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, Loader2, CheckCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface SignatorySignature {
  id: string;
  user_id: string;
  signatory_role: string;
  signature_url: string | null;
  full_name: string | null;
  updated_at: string;
}

export default function SignatorySignatureUpload() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signatureUrl, setSignatureUrl] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [signatoryRole, setSignatoryRole] = useState<string>('');
  const [userRoles, setUserRoles] = useState<string[]>([]);

  // Fetch user roles and existing signature
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Get user roles
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        const roles = rolesData?.map((r) => r.role) || [];
        setUserRoles(roles);

        // Get signatory role (chairperson, secretary, or treasurer)
        const signatoryRoles = roles.filter((r) =>
          ['chairperson', 'secretary', 'treasurer'].includes(r)
        );

        if (signatoryRoles.length > 0) {
          setSignatoryRole(signatoryRoles[0]);

          // Fetch existing signature
          const { data: sigData } = await supabase
            .from('signatory_signatures')
            .select('*')
            .eq('user_id', user.id)
            .eq('signatory_role', signatoryRoles[0])
            .single();

          if (sigData) {
            setSignatureUrl(sigData.signature_url || '');
            setFullName(sigData.full_name || user.email?.split('@')[0] || '');
          } else {
            setFullName(user.email?.split('@')[0] || '');
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const uploadSignature = async (file: File) => {
    try {
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image size should be less than 2MB');
        return;
      }

      if (!signatoryRole) {
        toast.error('You do not have a signatory role');
        return;
      }

      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${signatoryRole}-signature-${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = `signatory-signatures/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('signatures')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('signatures')
        .getPublicUrl(filePath);

      // Save to database
      const { data: existingRecord } = await supabase
        .from('signatory_signatures')
        .select('id')
        .eq('user_id', user?.id)
        .eq('signatory_role', signatoryRole)
        .single();

      let dbError;
      if (existingRecord?.id) {
        // Update existing record
        const { error } = await supabase
          .from('signatory_signatures')
          .update({
            signature_url: publicUrl,
            full_name: fullName,
            updated_by: user?.id,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user?.id)
          .eq('signatory_role', signatoryRole);
        dbError = error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('signatory_signatures')
          .insert({
            user_id: user?.id,
            signatory_role: signatoryRole,
            signature_url: publicUrl,
            full_name: fullName,
            updated_by: user?.id,
            updated_at: new Date().toISOString(),
          });
        dbError = error;
      }

      if (dbError) throw dbError;

      setSignatureUrl(publicUrl);
      toast.success('Signature uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading signature:', error);
      toast.error(`Failed to upload signature: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadSignature(file);
    }
  };

  const handleDeleteSignature = async () => {
    try {
      if (!signatoryRole) return;

      setUploading(true);

      // Update database to remove signature
      const { error } = await supabase
        .from('signatory_signatures')
        .update({
          signature_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user?.id)
        .eq('signatory_role', signatoryRole);

      if (error) throw error;

      setSignatureUrl('');
      toast.success('Signature deleted successfully');
    } catch (error: any) {
      toast.error(`Failed to delete signature: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!signatoryRole) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Signature Upload</h1>
        </div>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <p className="text-sm text-yellow-800">
              You do not have a signatory role (chairperson, secretary, or treasurer). 
              Contact your administrator to assign a role.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Signature Upload</h1>
          <p className="text-gray-600 mt-2">
            Upload your digital signature for withdrawal approvals
          </p>
        </div>
        <Badge variant="outline" className="text-sm capitalize">
          {signatoryRole}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Signature</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload your digital signature. This will be automatically added to withdrawal receipts when you approve them.
          </p>

          {/* Full Name Input */}
          <div className="space-y-2">
            <Label htmlFor="full-name">Full Name (for receipt)</Label>
            <Input
              id="full-name"
              type="text"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={uploading}
            />
            <p className="text-xs text-muted-foreground">
              This name will appear on withdrawal receipts next to your signature
            </p>
          </div>

          {/* Signature Upload */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="signature-upload">Select Signature Image</Label>
              <Input
                id="signature-upload"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground mt-2">
                PNG, JPG, or JPEG • Max 2MB
              </p>
            </div>

            {uploading && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <p className="text-sm text-blue-600">Uploading signature...</p>
              </div>
            )}

            {signatureUrl && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-green-600">Signature uploaded successfully</p>
                </div>
                <div className="border border-border rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                    <img
                      src={signatureUrl}
                      alt="Your signature"
                      className="h-24 object-contain bg-white rounded border border-border"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Name on receipt:</p>
                    <p className="text-sm font-medium">{fullName}</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteSignature}
                    disabled={uploading}
                    className="w-full"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Signature
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-sm mb-2">How it works:</h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Upload your signature image above</li>
            <li>Enter your full name as it should appear on receipts</li>
            <li>When you approve a withdrawal, your signature is automatically added to the receipt</li>
            <li>The receipt will show your signature with your name</li>
            <li>You can update your signature anytime</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
