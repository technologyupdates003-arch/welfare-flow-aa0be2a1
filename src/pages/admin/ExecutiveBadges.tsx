import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Award, CheckCircle, AlertCircle, Loader2, Trash2, Edit2 } from "lucide-react";

export default function ExecutiveBadges() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    role_name: "",
    description: "",
    badge_url: "",
  });

  const executiveRoles = [
    { id: "chairperson", label: "Chairperson" },
    { id: "vice_chairperson", label: "Vice Chairperson" },
    { id: "secretary", label: "Secretary" },
    { id: "vice_secretary", label: "Vice Secretary" },
    { id: "executive", label: "Executive" },
  ];

  // Fetch all badges
  const { data: badges = [] } = useQuery({
    queryKey: ["executive-badges"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("executive_badges")
          .select("*")
          .order("role_name");
        
        if (error) {
          console.warn("[ExecutiveBadges] Table not found - migration may not be applied yet:", error.message);
          return [];
        }
        
        return data || [];
      } catch (err) {
        console.warn("[ExecutiveBadges] Error fetching badges:", err);
        return [];
      }
    },
  });

  // Save badge mutation
  const saveBadgeMutation = useMutation({
    mutationFn: async () => {
      if (!formData.role_name || !formData.badge_url) {
        throw new Error("Role name and badge image are required");
      }

      if (editingId) {
        const { error } = await supabase
          .from("executive_badges")
          .update({
            role_name: formData.role_name,
            description: formData.description,
            badge_url: formData.badge_url,
            updated_by: user?.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("executive_badges")
          .insert({
            role_name: formData.role_name,
            description: formData.description,
            badge_url: formData.badge_url,
            created_by: user?.id,
            updated_by: user?.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Badge updated successfully" : "Badge created successfully");
      queryClient.invalidateQueries({ queryKey: ["executive-badges"] });
      resetForm();
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save badge");
    },
  });

  // Delete badge mutation
  const deleteBadgeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("executive_badges")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Badge deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["executive-badges"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete badge");
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `badges/badge-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("profile-images")
        .getPublicUrl(fileName);

      setFormData((prev) => ({
        ...prev,
        badge_url: publicUrl,
      }));
      toast.success("Badge image uploaded successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      role_name: "",
      description: "",
      badge_url: "",
    });
    setEditingId(null);
  };

  const handleEdit = (badge: any) => {
    setFormData({
      role_name: badge.role_name,
      description: badge.description || "",
      badge_url: badge.badge_url,
    });
    setEditingId(badge.id);
    setIsOpen(true);
  };

  const handleOpenNew = () => {
    resetForm();
    setIsOpen(true);
  };

  const getRoleLabel = (roleId: string) => {
    return executiveRoles.find((r) => r.id === roleId)?.label || roleId;
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Award className="h-8 w-8" />
            Executive Badges
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage badges for executive roles
          </p>
        </div>
        <Button onClick={handleOpenNew} className="gap-2">
          <Upload className="h-4 w-4" />
          Add New Badge
        </Button>
      </div>

      {/* Badges Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {badges.length === 0 && (
          <Card className="md:col-span-2 border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Migration Required</p>
                  <p className="mt-1">
                    The executive badges feature requires a database migration. Please run the migration script at:
                    <code className="block mt-2 p-2 bg-amber-100 rounded font-mono text-xs">
                      supabase/migrations/20260704_add_executive_badges.sql
                    </code>
                  </p>
                  <p className="mt-2">See APPLY_EXECUTIVE_BADGES_MIGRATION.md for instructions.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {badges.map((badge: any) => (
          <Card key={badge.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {getRoleLabel(badge.role_name)}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Role Badge
                  </p>
                </div>
                <Badge variant="outline">Active</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Badge Preview */}
              <div className="flex justify-center bg-gray-50 dark:bg-gray-900 rounded-lg p-4 min-h-48">
                {badge.badge_url ? (
                  <img
                    src={badge.badge_url}
                    alt={badge.role_name}
                    className="h-40 w-40 object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center text-muted-foreground">
                    No image
                  </div>
                )}
              </div>

              {/* Description */}
              {badge.description && (
                <div>
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="text-sm mt-1">{badge.description}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(badge)}
                  className="flex-1"
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteBadgeMutation.mutate(badge.id)}
                  disabled={deleteBadgeMutation.isPending}
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Empty State */}
        {badges.length === 0 && (
          <Card className="md:col-span-2 border-dashed">
            <CardContent className="pt-6 text-center py-12">
              <Award className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No badges created yet</p>
              <Button onClick={handleOpenNew} variant="outline">
                Create First Badge
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Badge" : "Create New Badge"}
            </DialogTitle>
            <DialogDescription>
              Upload a badge image for an executive role
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Role Selection */}
            <div>
              <Label htmlFor="role-select">Executive Role</Label>
              <select
                id="role-select"
                value={formData.role_name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    role_name: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
              >
                <option value="">Select a role</option>
                {executiveRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Enter a description for this badge..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="min-h-20"
              />
            </div>

            {/* Image Upload */}
            <div>
              <Label htmlFor="badge-file">Badge Image</Label>
              <input
                ref={fileInputRef}
                id="badge-file"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Choose Image (Max 5MB)
                  </>
                )}
              </Button>
            </div>

            {/* Preview */}
            {formData.badge_url && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 flex justify-center min-h-32">
                  <img
                    src={formData.badge_url}
                    alt="Badge preview"
                    className="h-24 w-24 object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={saveBadgeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => saveBadgeMutation.mutate()}
              disabled={saveBadgeMutation.isPending || !formData.role_name || !formData.badge_url}
            >
              {saveBadgeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {editingId ? "Update" : "Create"} Badge
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6 flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">How it works:</p>
            <ul className="mt-2 space-y-1 text-xs">
              <li>• Upload badge images for each executive role</li>
              <li>• Badges are displayed on executive member dashboards</li>
              <li>• Members with these roles can view and download their badges</li>
              <li>• Use high-quality PNG or SVG images for best results</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
