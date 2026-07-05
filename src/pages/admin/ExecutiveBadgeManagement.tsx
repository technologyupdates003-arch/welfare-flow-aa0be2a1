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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Award, Upload, Trash2, Edit2, Plus, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ExecutiveBadge {
  id: string;
  role_name: string;
  badge_url: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export default function ExecutiveBadgeManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingBadge, setEditingBadge] = useState<ExecutiveBadge | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    role_name: "",
    description: "",
    badge_file: null as File | null,
  });

  const executiveRoles = [
    { id: "chairperson", label: "Chairperson" },
    { id: "vice_chairperson", label: "Vice Chairperson" },
    { id: "secretary", label: "Secretary" },
    { id: "vice_secretary", label: "Vice Secretary" },
  ];

  // Fetch all badges
  const { data: badges = [] } = useQuery({
    queryKey: ["executive-badges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("executive_badges")
        .select("*")
        .order("role_name");
      return data || [];
    },
  });

  // Create/Update mutation
  const upsertMutation = useMutation({
    mutationFn: async (data: {
      role_name: string;
      description: string;
      badge_url?: string;
    }) => {
      if (editingBadge?.id) {
        // Update
        const { error } = await supabase
          .from("executive_badges")
          .update({
            role_name: data.role_name,
            description: data.description,
            badge_url: data.badge_url || editingBadge.badge_url,
            updated_by: user?.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingBadge.id);
        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from("executive_badges")
          .insert({
            role_name: data.role_name,
            description: data.description,
            badge_url: data.badge_url || "",
            created_by: user?.id,
            updated_by: user?.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(
        editingBadge ? "Badge updated successfully" : "Badge created successfully"
      );
      queryClient.invalidateQueries({ queryKey: ["executive-badges"] });
      setDialogOpen(false);
      setEditingBadge(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save badge");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (badgeId: string) => {
      const { error } = await supabase
        .from("executive_badges")
        .delete()
        .eq("id", badgeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Badge deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["executive-badges"] });
      setDeleteConfirm(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete badge");
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    setFormData({ ...formData, badge_file: file });
  };

  const uploadBadgeImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `badge-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("badges")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from("badges")
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSaveBadge = async () => {
    if (!formData.role_name.trim()) {
      toast.error("Please select a role");
      return;
    }

    setUploading(true);
    try {
      let badgeUrl = editingBadge?.badge_url || "";

      if (formData.badge_file) {
        badgeUrl = await uploadBadgeImage(formData.badge_file);
      }

      if (!badgeUrl && !editingBadge) {
        toast.error("Please upload a badge image");
        setUploading(false);
        return;
      }

      await upsertMutation.mutateAsync({
        role_name: formData.role_name,
        description: formData.description,
        badge_url: badgeUrl,
      });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      role_name: "",
      description: "",
      badge_file: null,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openEditDialog = (badge: ExecutiveBadge) => {
    setEditingBadge(badge);
    setFormData({
      role_name: badge.role_name,
      description: badge.description,
      badge_file: null,
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingBadge(null);
    resetForm();
    setDialogOpen(true);
  };

  const getRoleLabel = (roleId: string) => {
    return executiveRoles.find(r => r.id === roleId)?.label || roleId;
  };

  const usedRoles = badges.map(b => b.role_name);
  const availableRoles = executiveRoles.filter(r => !usedRoles.includes(r.id) || (editingBadge?.role_name === r.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Award className="h-8 w-8" />
            Executive Role Badges
          </h1>
          <p className="text-muted-foreground mt-1">
            Upload and manage badges for executive roles
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Badge
        </Button>
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {badges.map((badge: ExecutiveBadge) => (
          <Card key={badge.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {getRoleLabel(badge.role_name)}
                  </CardTitle>
                  <Badge variant="outline" className="mt-2">
                    {badge.role_name}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Badge Image */}
              {badge.badge_url && (
                <div className="flex justify-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                  <img
                    src={badge.badge_url}
                    alt={badge.role_name}
                    className="h-32 w-32 object-contain"
                  />
                </div>
              )}

              {/* Description */}
              {badge.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p className="text-sm line-clamp-2">{badge.description}</p>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-2 border-t">
                <div>
                  <p className="font-medium">Created</p>
                  <p>{new Date(badge.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="font-medium">Updated</p>
                  <p>{new Date(badge.updated_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openEditDialog(badge)}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteConfirm(badge.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {badges.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-8 text-center">
            <Award className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No badges created yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a new badge for each executive role
            </p>
            <Button onClick={openCreateDialog} className="mt-4">
              Create First Badge
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6 flex gap-3">
          <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">How it works:</p>
            <ul className="mt-2 space-y-1 text-xs list-disc list-inside">
              <li>Upload a badge image for each executive role (Chairperson, Vice Chairperson, Secretary, Vice Secretary)</li>
              <li>Members with these roles will see the badges on their executive dashboards</li>
              <li>Badges are displayed when members click on their assigned executive roles</li>
              <li>You can update badge images anytime</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingBadge ? "Edit Executive Badge" : "Create Executive Badge"}
            </DialogTitle>
            <DialogDescription>
              {editingBadge
                ? "Update the badge image and details"
                : "Upload a badge image for an executive role"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Role Selection */}
            <div>
              <Label>Executive Role *</Label>
              <Select
                value={formData.role_name}
                onValueChange={(value) =>
                  setFormData({ ...formData, role_name: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="e.g., Badge for the Chairperson role..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="min-h-[80px]"
              />
            </div>

            {/* Badge Image Upload */}
            <div>
              <Label htmlFor="badge-upload">Badge Image {!editingBadge && "*"}</Label>
              <Input
                ref={fileInputRef}
                id="badge-upload"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={uploading}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG or JPEG • Max 5MB
              </p>
            </div>

            {/* Current Badge Preview */}
            {editingBadge?.badge_url && !formData.badge_file && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Current Badge:</p>
                <div className="flex justify-center p-3 bg-gray-50 dark:bg-gray-900 rounded border">
                  <img
                    src={editingBadge.badge_url}
                    alt="Current badge"
                    className="h-24 w-24 object-contain"
                  />
                </div>
              </div>
            )}

            {/* New Badge Preview */}
            {formData.badge_file && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">New Badge Preview:</p>
                <div className="flex justify-center p-3 bg-gray-50 dark:bg-gray-900 rounded border">
                  <img
                    src={URL.createObjectURL(formData.badge_file)}
                    alt="New badge"
                    className="h-24 w-24 object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveBadge} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {editingBadge ? "Update" : "Create"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Badge?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. Members will no longer see this badge.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm) {
                  deleteMutation.mutate(deleteConfirm);
                }
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
