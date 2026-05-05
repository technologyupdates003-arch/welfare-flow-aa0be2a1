import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
const supabase: any = supabaseClient;
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Plus, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import logoImage from "@/assets/WhatsApp Image 2026-04-13 at 12.35.07.jpeg";

export default function TreasurerDocuments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: "",
    recipient: "",
    content: "",
    documentType: "letter",
  });

  // Fetch organization settings for letterhead
  const { data: orgSettings } = useQuery({
    queryKey: ["organization-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("organization_settings")
        .select("*")
        .single();
      return data;
    },
  });

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ["treasurer-documents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handlePreview = (doc: any) => {
    setSelectedDoc(doc);
    setPreviewOpen(true);
  };

  const renderLetterhead = (content: string) => {
    const orgName = orgSettings?.organization_name || "KIRINYAGA HEALTHCARE WORKERS' WELFARE";
    const orgAddress = orgSettings?.organization_address || "P.O.BOX 24-10300 KERUGOYA, LOCATION: KCRH";
    const orgEmail = orgSettings?.organization_email || "Khcww2020@gmail.com";
    const orgPhone = orgSettings?.organization_phone || "+254 712 345 678";

    return (
      <div className="bg-white shadow-lg rounded-lg" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
        {/* Header with Logo and Contact Info */}
        <div className="border-b-4 border-orange-500 pb-4 mb-6">
          <div className="flex items-start justify-between mb-4">
            {/* Logo */}
            <div className="flex-shrink-0">
              <img
                src={orgSettings?.logo_url || logoImage}
                alt="Organization Logo"
                className="h-24 w-24 object-contain"
              />
            </div>

            {/* Organization Details */}
            <div className="flex-1 text-right ml-4">
              <h1 className="text-xl font-bold text-[#111827] mb-2">
                {orgName}
              </h1>
              <div className="text-sm text-[#6B7280] space-y-1">
                <p>{orgAddress}</p>
                <p className="text-orange-600 font-medium">Email: {orgEmail}</p>
                <p>Tel: {orgPhone}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Document Date */}
        <div className="text-right mb-6 text-sm text-[#6B7280]">
          Date: {new Date().toLocaleDateString('en-GB', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
          })}
        </div>

        {/* Document Content */}
        <div className="mb-12 text-[#111827] leading-relaxed whitespace-pre-wrap text-justify px-2">
          {content || "Your document content will appear here..."}
        </div>

        {/* Footer with Signature and Stamp */}
        <div className="mt-16 pt-6 border-t-2 border-[#E5E7EB]">
          <div className="flex justify-between items-end">
            {/* Signature Section */}
            <div className="flex-1">
              {orgSettings?.signature_url && (
                <div className="mb-2">
                  <img
                    src={orgSettings.signature_url}
                    alt="Treasurer Signature"
                    className="h-20 object-contain"
                  />
                </div>
              )}
              <div className="border-t-2 border-[#111827] pt-1 w-64">
                <p className="text-sm font-bold">Treasurer</p>
                <p className="text-xs text-[#6B7280] mt-1">
                  {orgName}
                </p>
              </div>
            </div>

            {/* Official Stamp */}
            {orgSettings?.stamp_url && (
              <div className="flex-shrink-0 ml-4">
                <img
                  src={orgSettings.stamp_url}
                  alt="Official Stamp"
                  className="h-28 w-28 object-contain opacity-90"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer Contact Info */}
        <div className="mt-8 pt-4 border-t border-[#E5E7EB] text-center">
          <div className="text-xs text-[#6B7280] space-y-1">
            <p className="font-semibold">{orgName}</p>
            <p>{orgAddress}</p>
            <p>Email: {orgEmail} | Tel: {orgPhone}</p>
          </div>
        </div>
      </div>
    );
  };

  const createDocument = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("documents")
        .insert({
          title: data.title,
          content: data.content,
          document_type: data.documentType,
          created_by: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasurer-documents"] });
      setDialogOpen(false);
      setFormData({ title: "", recipient: "", content: "", documentType: "letter" });
      toast.success("Document created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = () => {
    if (!formData.title || !formData.content) {
      toast.error("Please fill in all required fields");
      return;
    }
    createDocument.mutate(formData);
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-[#111827]">Official Documents</h2>
          <p className="text-sm text-[#6B7280] mt-1">
            Create and manage official letters with organization letterhead
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Create Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Document</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-6">
              {/* Left: Form */}
              <div className="space-y-4">
                <div>
                  <Label>Document Title *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Contribution Reminder Letter"
                  />
                </div>

                <div>
                  <Label>Recipient</Label>
                  <Input
                    value={formData.recipient}
                    onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                    placeholder="e.g., All Members"
                  />
                </div>

                <div>
                  <Label>Document Content *</Label>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Enter the document content here..."
                    rows={15}
                    className="font-['Times_New_Roman',_serif]"
                  />
                  <p className="text-xs text-[#6B7280] mt-1">
                    This will appear in the body of the document with official letterhead
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                    disabled={createDocument.isPending}
                  >
                    {createDocument.isPending ? "Creating..." : "Create Document"}
                  </Button>
                </div>
              </div>

              {/* Right: Live Preview */}
              <div className="border-l border-[#E5E7EB] pl-6">
                <h3 className="text-sm font-semibold text-[#111827] mb-4">Live Preview</h3>
                <div className="bg-[#F9FAFB] p-6 rounded-lg overflow-auto max-h-[600px]">
                  <div className="bg-white p-8 rounded shadow-sm">
                    {renderLetterhead(formData.content || "Your document content will appear here...")}
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc: any) => (
          <Card key={doc.id} className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <FileText className="h-10 w-10 text-[#2563EB]" />
                <span className="text-xs text-[#6B7280]">
                  {new Date(doc.created_at).toLocaleDateString()}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <h3 className="font-semibold text-[#111827] mb-2 line-clamp-2">
                {doc.title}
              </h3>
              <p className="text-sm text-[#6B7280] mb-4 line-clamp-3">
                {doc.content?.substring(0, 100)}...
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePreview(doc)}
                  className="flex-1"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Preview
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDoc?.title}</DialogTitle>
          </DialogHeader>
          <div className="bg-[#F9FAFB] p-6 rounded-lg">
            <div className="bg-white p-12 rounded shadow-lg max-w-4xl mx-auto">
              {selectedDoc && renderLetterhead(selectedDoc.content)}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
            <Button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
