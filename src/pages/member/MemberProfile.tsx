import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2, Save, Lock } from "lucide-react";
import { toast } from "sonner";

export default function MemberProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: member, isLoading } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("members").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const [name, setName] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (member && !initialized) {
      setName(member.name || "");
      setStatusMsg(member.status_message || "");
      setInitialized(true);
    }
  }, [member, initialized]);

  const changePassword = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error("Passwords don't match");
      if (newPassword.length < 6) throw new Error("Password must be at least 6 characters");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password changed successfully!");
      setShowPasswordChange(false);
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("members").update({ name, status_message: statusMsg }).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Profile updated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !member) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/profile.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("profile-images").upload(path, file, { upsert: true });
    if (uploadErr) { toast.error("Upload failed: " + uploadErr.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("profile-images").getPublicUrl(path);
    await supabase.from("members").update({ profile_picture_url: urlData.publicUrl + "?t=" + Date.now() }).eq("user_id", user!.id);
    queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    toast.success("Photo updated!");
    setUploading(false);
  };

  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="max-w-md mx-auto space-y-4">
      <Card>
        <CardHeader><CardTitle>My Profile</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={member?.profile_picture_url || ""} />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">{member?.name?.charAt(0)?.toUpperCase() || "?"}</AvatarFallback>
              </Avatar>
              <label className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-lg">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                <input type="file" accept="image/*" className="hidden" onChange={handleUploadPhoto} disabled={uploading} />
              </label>
            </div>
          </div>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={member?.phone || ""} disabled className="opacity-60" /></div>
            <div><Label>Member ID</Label><Input value={member?.member_id || "Not assigned"} disabled className="opacity-60" /></div>
            <div><Label>Status Message</Label><Input value={statusMsg} onChange={e => setStatusMsg(e.target.value)} placeholder="Hey there!" /></div>
            <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending} className="w-full">
              <Save className="h-4 w-4 mr-2" /> Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Security</CardTitle></CardHeader>
        <CardContent>
          {!showPasswordChange ? (
            <Button variant="outline" onClick={() => setShowPasswordChange(true)} className="w-full">Change Password</Button>
          ) : (
            <div className="space-y-3">
              <div><Label>New Password</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" /></div>
              <div><Label>Confirm Password</Label><Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></div>
              <div className="flex gap-2">
                <Button onClick={() => changePassword.mutate()} disabled={changePassword.isPending || !newPassword || !confirmPassword} className="flex-1">
                  {changePassword.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                  Update
                </Button>
                <Button variant="outline" onClick={() => { setShowPasswordChange(false); setNewPassword(""); setConfirmPassword(""); }}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
