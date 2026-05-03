import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Loader2, FileText, Calendar, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";

interface MinutesFormProps {
  form: any;
  setForm: (form: any) => void;
  selectedAttendees: string[];
  setSelectedAttendees: (attendees: string[]) => void;
  attendeeSearch: string;
  setAttendeeSearch: (search: string) => void;
  members: any[];
  executiveMembers: any[];
  uploadingChairperson: boolean;
  uploadingSecretary: boolean;
  handleChairpersonSignatureUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSecretarySignatureUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  absenceSearch: string;
  setAbsenceSearch: (search: string) => void;
  absenceWithApologySearch: string;
  setAbsenceWithApologySearch: (search: string) => void;
  visibilitySearch: string;
  setVisibilitySearch: (search: string) => void;
}

function MinutesForm({
  form,
  setForm,
  selectedAttendees,
  setSelectedAttendees,
  attendeeSearch,
  setAttendeeSearch,
  members,
  executiveMembers,
  uploadingChairperson,
  uploadingSecretary,
  handleChairpersonSignatureUpload,
  handleSecretarySignatureUpload,
  absenceSearch,
  setAbsenceSearch,
  absenceWithApologySearch,
  setAbsenceWithApologySearch,
  visibilitySearch,
  setVisibilitySearch,
}: MinutesFormProps) {
  const toggleAttendee = (memberName: string) => {
    setSelectedAttendees(
      selectedAttendees.includes(memberName)
        ? selectedAttendees.filter(name => name !== memberName)
        : [...selectedAttendees, memberName]
    );
  };

  const toggleAbsentWithoutApology = (memberName: string) => {
    setForm({
      ...form,
      absent_without_apology: form.absent_without_apology.includes(memberName)
        ? form.absent_without_apology.filter((name: string) => name !== memberName)
        : [...form.absent_without_apology, memberName]
    });
  };

  const toggleAbsentWithApology = (memberName: string) => {
    setForm({
      ...form,
      absent_with_apology: form.absent_with_apology.includes(memberName)
        ? form.absent_with_apology.filter((name: string) => name !== memberName)
        : [...form.absent_with_apology, memberName]
    });
  };

  const toggleVisibility = (memberName: string) => {
    setForm({
      ...form,
      visible_to_members: form.visible_to_members.includes(memberName)
        ? form.visible_to_members.filter((name: string) => name !== memberName)
        : [...form.visible_to_members, memberName]
    });
  };

  const filteredMembers = (form.meeting_type === "executive" ? executiveMembers.map((m: any) => ({
    id: m.user_id,
    name: m.members?.name,
    phone: m.members?.phone,
  })) : members).filter((m: any) =>
    m.name.toLowerCase().includes(attendeeSearch.toLowerCase()) ||
    m.phone.includes(attendeeSearch)
  );

  const filteredAbsentWithoutApologyMembers = (form.meeting_type === "executive" ? executiveMembers.map((m: any) => ({
    id: m.user_id,
    name: m.members?.name,
    phone: m.members?.phone,
  })) : members).filter((m: any) =>
    m.name.toLowerCase().includes(absenceSearch.toLowerCase()) ||
    m.phone.includes(absenceSearch)
  );

  const filteredAbsentWithApologyMembers = (form.meeting_type === "executive" ? executiveMembers.map((m: any) => ({
    id: m.user_id,
    name: m.members?.name,
    phone: m.members?.phone,
  })) : members).filter((m: any) =>
    m.name.toLowerCase().includes(absenceWithApologySearch.toLowerCase()) ||
    m.phone.includes(absenceWithApologySearch)
  );

  const filteredVisibilityMembers = (form.meeting_type === "executive" ? executiveMembers : members).filter((m: any) =>
    m.members?.name.toLowerCase().includes(visibilitySearch.toLowerCase()) ||
    m.members?.phone?.includes(visibilitySearch)
  ).map((m: any) => ({
    id: m.user_id,
    name: m.members?.name,
    phone: m.members?.phone,
    role: m.role
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Meeting Title</Label>
          <Input
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Monthly General Meeting"
          />
        </div>
        <div>
          <Label>Meeting Date</Label>
          <Input
            type="date"
            value={form.meeting_date}
            onChange={e => setForm({ ...form, meeting_date: e.target.value })}
          />
        </div>
        <div>
          <Label>Meeting Type</Label>
          <Select
            value={form.meeting_type}
            onValueChange={value => setForm({ ...form, meeting_type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General Meeting</SelectItem>
              <SelectItem value="committee">Committee Meeting</SelectItem>
              <SelectItem value="executive">Executive Meeting</SelectItem>
              <SelectItem value="emergency">Emergency Meeting</SelectItem>
              <SelectItem value="annual">Annual Meeting</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Attendees ({selectedAttendees.length} selected)</Label>
          {form.meeting_type === "executive" && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
              📌 Only office bearers (members with roles) are shown for executive meetings
            </p>
          )}
          <Input
            value={attendeeSearch}
            onChange={e => setAttendeeSearch(e.target.value)}
            placeholder="Search members by name or phone..."
            className="mb-2"
          />
          <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
            {filteredMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No members found</p>
            ) : (
              <div className="divide-y divide-border">
                {filteredMembers.map((member: any) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAttendees.includes(member.name)}
                      onChange={() => toggleAttendee(member.name)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.phone}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          {selectedAttendees.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {selectedAttendees.map(name => (
                <Badge key={name} variant="secondary" className="text-xs">
                  {name}
                  <button
                    onClick={() => toggleAttendee(name)}
                    className="ml-1 hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
        
        {/* Absence Tracking Section */}
        <div className="col-span-2 border-t border-border pt-4 mt-2">
          <h4 className="font-semibold text-sm mb-3">Absence Tracking</h4>
          {form.meeting_type === "executive" && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
              📌 Only office bearers (members with roles) are shown for executive meetings
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            {/* Absent with Apology */}
            <div>
              <Label>Absent with Apology ({form.absent_with_apology.length} selected)</Label>
              <Input
                value={absenceWithApologySearch}
                onChange={e => setAbsenceWithApologySearch(e.target.value)}
                placeholder="Search members..."
                className="mb-2"
              />
              <div className="border border-border rounded-lg max-h-40 overflow-y-auto">
                {filteredAbsentWithApologyMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No members found</p>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredAbsentWithApologyMembers.map((member: any) => (
                      <label
                        key={member.id}
                        className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer transition"
                      >
                        <input
                          type="checkbox"
                          checked={form.absent_with_apology.includes(member.name)}
                          onChange={() => toggleAbsentWithApology(member.name)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.phone}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {form.absent_with_apology.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {form.absent_with_apology.map((name: string) => (
                    <Badge key={name} variant="secondary" className="text-xs">
                      {name}
                      <button
                        onClick={() => toggleAbsentWithApology(name)}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Absent without Apology */}
            <div>
              <Label>Absent (No Apology) ({form.absent_without_apology.length} selected)</Label>
              <Input
                value={absenceSearch}
                onChange={e => setAbsenceSearch(e.target.value)}
                placeholder="Search members..."
                className="mb-2"
              />
              <div className="border border-border rounded-lg max-h-40 overflow-y-auto">
                {filteredAbsentWithoutApologyMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No members found</p>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredAbsentWithoutApologyMembers.map((member: any) => (
                      <label
                        key={member.id}
                        className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer transition"
                      >
                        <input
                          type="checkbox"
                          checked={form.absent_without_apology.includes(member.name)}
                          onChange={() => toggleAbsentWithoutApology(member.name)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.phone}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {form.absent_without_apology.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {form.absent_without_apology.map((name: string) => (
                    <Badge key={name} variant="destructive" className="text-xs">
                      {name}
                      <button
                        onClick={() => toggleAbsentWithoutApology(name)}
                        className="ml-1 hover:text-white"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Executive Meeting - Mark Executive Members */}
        {form.meeting_type === "executive" && (
          <div className="col-span-2 border-t border-border pt-4 mt-2">
            <h4 className="font-semibold text-sm mb-3">Executive Members Marked</h4>
            <div className="mb-3">
              <p className="text-sm text-muted-foreground mb-2">
                Select which executive members are marked for this meeting (attendees, absences, etc.)
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Executive Members ({selectedAttendees.length} marked)</Label>
                <div className="border border-border rounded-lg max-h-40 overflow-y-auto">
                  {executiveMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No executive members found</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {executiveMembers.map((member: any) => (
                        <div
                          key={member.user_id}
                          className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer transition"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium">{member.members?.name}</p>
                            <p className="text-xs text-muted-foreground">{member.role} • {member.members?.phone}</p>
                          </div>
                          {selectedAttendees.includes(member.members?.name) && (
                            <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 px-2 py-1 rounded">
                              Marked
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <Label>Quick Stats</Label>
                <div className="space-y-2 text-sm">
                  <div className="p-2 bg-muted rounded">
                    <p className="text-muted-foreground">Total Executive Members</p>
                    <p className="font-semibold">{executiveMembers.length}</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <p className="text-muted-foreground">Marked as Attendees</p>
                    <p className="font-semibold">{selectedAttendees.length}</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <p className="text-muted-foreground">Absent with Apology</p>
                    <p className="font-semibold">{form.absent_with_apology.length}</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <p className="text-muted-foreground">Absent without Apology</p>
                    <p className="font-semibold">{form.absent_without_apology.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Executive Meeting Visibility */}
        {form.meeting_type === "executive" && (
          <div className="col-span-2 border-t border-border pt-4 mt-2">
            <h4 className="font-semibold text-sm mb-3">Executive Members Who Can View ({form.visible_to_members.length} selected)</h4>
            <div className="mb-3">
              <p className="text-sm text-muted-foreground mb-2">
                Select which office bearers can view these executive meeting minutes. 
                If none are selected, all office bearers will be able to view.
              </p>
            </div>
            <Input
              value={visibilitySearch}
              onChange={e => setVisibilitySearch(e.target.value)}
              placeholder="Search office bearers by name or phone..."
              className="mb-2"
            />
            <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
              {filteredVisibilityMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No office bearers found</p>
              ) : (
                <div className="divide-y divide-border">
                  {filteredVisibilityMembers.map((member: any) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer transition"
                    >
                      <input
                        type="checkbox"
                        checked={form.visible_to_members.includes(member.name)}
                        onChange={() => toggleVisibility(member.name)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.phone} • {member.role}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {form.visible_to_members.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {form.visible_to_members.map((name: string) => (
                  <Badge key={name} variant="secondary" className="text-xs">
                    {name}
                    <button
                      onClick={() => toggleVisibility(name)}
                      className="ml-1 hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">
                No specific members selected. All office bearers will be able to view this executive meeting.
              </p>
            )}
          </div>
        )}

        <div className="col-span-2">
          <Label>Agenda</Label>
          <Textarea
            value={form.agenda}
            onChange={e => setForm({ ...form, agenda: e.target.value })}
            placeholder="List the agenda items discussed..."
            rows={3}
          />
        </div>
        <div className="col-span-2">
          <Label>Discussions</Label>
          <Textarea
            value={form.discussions}
            onChange={e => setForm({ ...form, discussions: e.target.value })}
            placeholder="Summary of discussions..."
            rows={3}
          />
        </div>
        <div className="col-span-2">
          <Label>Decisions Made</Label>
          <Textarea
            value={form.decisions}
            onChange={e => setForm({ ...form, decisions: e.target.value })}
            placeholder="Key decisions made during the meeting..."
            rows={3}
          />
        </div>
        <div className="col-span-2">
          <Label>Action Items</Label>
          <Textarea
            value={form.action_items}
            onChange={e => setForm({ ...form, action_items: e.target.value })}
            placeholder="Action items with responsible persons and deadlines..."
            rows={3}
          />
        </div>
        <div>
          <Label>Next Meeting Date</Label>
          <Input
            type="date"
            value={form.next_meeting_date}
            onChange={e => setForm({ ...form, next_meeting_date: e.target.value })}
          />
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={form.status}
            onValueChange={value => setForm({ ...form, status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 border-t border-border pt-4 mt-2">
          <h4 className="font-semibold text-sm mb-3">Signatures</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Chairperson Name</Label>
              <Input
                value={form.chairperson_name}
                onChange={e => setForm({ ...form, chairperson_name: e.target.value })}
                placeholder="Chairperson name"
              />
            </div>
            <div>
              <Label>Chairperson Signature</Label>
              <div className="space-y-2">
                {form.chairperson_signature_url ? (
                  <div className="relative">
                    <img
                      src={form.chairperson_signature_url}
                      alt="Chairperson signature"
                      className="h-16 border border-border rounded object-contain bg-white"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Signature prefilled from chairperson's upload</p>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                    <p>Chairperson signature will be added when they approve the minutes.</p>
                    <p className="text-xs mt-1">The chairperson uploads their signature separately.</p>
                  </div>
                )}
              </div>
            </div>
            <div>
              <Label>Secretary Name</Label>
              <Input
                value={form.secretary_name}
                onChange={e => setForm({ ...form, secretary_name: e.target.value })}
                placeholder="Secretary name"
              />
            </div>
            <div>
              <Label>Secretary Signature</Label>
              <div className="space-y-2">
                {form.secretary_signature_url ? (
                  <div className="relative">
                    <img
                      src={form.secretary_signature_url}
                      alt="Secretary signature"
                      className="h-16 border border-border rounded object-contain bg-white"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Your signature prefilled from your upload</p>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                    <p>Please upload your signature in the Secretary Signature page first.</p>
                    <p className="text-xs mt-1">Go to Secretary Dashboard → Upload Signature</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Signatures are prefilled from office bearer signature uploads. Secretary signature must be uploaded separately.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function MeetingMinutes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [minutesOpen, setMinutesOpen] = useState(false);
  const [editMinutesOpen, setEditMinutesOpen] = useState(false);
  const [selectedMinutes, setSelectedMinutes] = useState<any>(null);
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [absenceSearch, setAbsenceSearch] = useState("");
  const [absenceWithApologySearch, setAbsenceWithApologySearch] = useState("");
  const [visibilitySearch, setVisibilitySearch] = useState("");
  const [uploadingChairperson, setUploadingChairperson] = useState(false);
  const [uploadingSecretary, setUploadingSecretary] = useState(false);
  const [form, setForm] = useState({
    title: "",
    meeting_date: new Date().toISOString().split("T")[0],
    meeting_type: "general",
    agenda: "",
    discussions: "",
    decisions: "",
    action_items: "",
    next_meeting_date: "",
    status: "draft",
    chairperson_name: "",
    chairperson_signature_url: "",
    secretary_name: "",
    secretary_signature_url: "",
    absent_with_apology: [] as string[],
    absent_without_apology: [] as string[],
    visible_to_members: [] as string[],
  });

  const [formInitialized, setFormInitialized] = useState(false);

  const { data: minutes, isLoading } = useQuery({
    queryKey: ["meeting-minutes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("meeting_minutes")
        .select("*")
        .order("meeting_date", { ascending: false });
      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members-for-attendance"],
    queryFn: async () => {
      const { data } = await supabase
        .from("members")
        .select("id, name, phone")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const { data: officeBearers = [] } = useQuery({
    queryKey: ["office-bearers"],
    queryFn: async () => {
      // Get all user_roles with the specified roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["chairperson", "vice_chairperson", "secretary", "vice_secretary"])
        .order("role");
      
      if (rolesError) {
        console.error("Error fetching office bearers:", rolesError);
        throw rolesError;
      }

      if (!rolesData || rolesData.length === 0) {
        return [];
      }

      // Get member info for these users
      const userIds = rolesData.map(r => r.user_id);
      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select("id, user_id, name, phone")
        .in("user_id", userIds);
      
      if (membersError) {
        console.error("Error fetching members:", membersError);
        throw membersError;
      }

      // Create a map of user_id -> member info
      const memberMap = new Map(membersData?.map(m => [m.user_id, m]) || []);

      // Combine roles with member info
      return rolesData.map(role => ({
        user_id: role.user_id,
        role: role.role,
        members: memberMap.get(role.user_id) || { name: "Unknown", phone: "" }
      }));
    },
  });

  const { data: executiveMembers = [] } = useQuery({
    queryKey: ["executive-members"],
    queryFn: async () => {
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["chairperson", "vice_chairperson", "secretary", "vice_secretary", "patron", "treasurer", "admin", "super_admin"])
        .order("role");
      
      if (rolesError) throw rolesError;
      if (!rolesData || rolesData.length === 0) return [];

      const userIds = rolesData.map(r => r.user_id);
      const { data: membersData } = await supabase
        .from("members")
        .select("id, user_id, name, phone")
        .in("user_id", userIds);

      const memberMap = new Map(membersData?.map(m => [m.user_id, m]) || []);

      // Deduplicate by user_id (a user might have multiple roles)
      const seen = new Set<string>();
      return rolesData
        .filter(r => {
          if (seen.has(r.user_id)) return false;
          seen.add(r.user_id);
          return true;
        })
        .map(role => ({
          user_id: role.user_id,
          role: role.role,
          members: memberMap.get(role.user_id) || { name: "Unknown", phone: "" }
        }))
        .filter(r => r.members?.name && r.members.name !== "Unknown");
    },
  });

  const { data: chairpersonSignature } = useQuery({
    queryKey: ["chairperson-signature"],
    queryFn: async () => {
      const { data } = await supabase
        .from("office_bearer_signatures")
        .select("*")
        .eq("role", "chairperson")
        .single();
      return data;
    },
    refetchOnWindowFocus: true, // Refetch when window/tab gets focus
  });

  const { data: secretarySignature } = useQuery({
    queryKey: ["secretary-signature"],
    queryFn: async () => {
      const { data } = await supabase
        .from("office_bearer_signatures")
        .select("*")
        .eq("role", "secretary")
        .single();
      return data;
    },
    refetchOnWindowFocus: true, // Refetch when window/tab gets focus
  });

  // Initialize form with secretary and chairperson names on mount (only once)
  useEffect(() => {
    if (formInitialized) return; // Only run once

    const initializeForm = async () => {
      // Get current user's member info (secretary)
      if (user) {
        const { data: memberData } = await supabase
          .from("members")
          .select("name")
          .eq("user_id", user.id)
          .single();
        
        if (memberData?.name) {
          // Sanitize the name - remove any problematic characters
          const sanitizedName = memberData.name.trim();
          setForm((prevForm: any) => ({
            ...prevForm,
            secretary_name: sanitizedName,
          }));
        }
      }

      // Get chairperson info directly from user_roles and members
      const { data: chairpersonRole } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "chairperson")
        .single();
      
      if (chairpersonRole?.user_id) {
        const { data: chairpersonMember } = await supabase
          .from("members")
          .select("name")
          .eq("user_id", chairpersonRole.user_id)
          .single();
        
        if (chairpersonMember?.name) {
          // Sanitize the name - remove any problematic characters
          const sanitizedName = chairpersonMember.name.trim();
          setForm((prevForm: any) => ({
            ...prevForm,
            chairperson_name: sanitizedName,
          }));
        }
      }

      setFormInitialized(true);
    };

    initializeForm();
  }, []); // Empty dependency array - run only once on mount

  // Update signatures when they change
  useEffect(() => {
    if (secretarySignature?.signature_url) {
      setForm((prevForm: any) => ({
        ...prevForm,
        secretary_signature_url: secretarySignature.signature_url,
      }));
    }
  }, [secretarySignature]);

  useEffect(() => {
    if (chairpersonSignature?.signature_url) {
      setForm((prevForm: any) => ({
        ...prevForm,
        chairperson_signature_url: chairpersonSignature.signature_url,
      }));
    }
  }, [chairpersonSignature]);

  const createMinutes = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      // Sanitize - only allow word chars, spaces, dots, hyphens
      const sanitize = (text: string | null | undefined) => {
        if (!text) return null;
        return text.trim().replace(/[^\w\s\.\-]/g, '').substring(0, 255);
      };

      const sanitizedAttendees = selectedAttendees
        .map(name => sanitize(name))
        .filter(name => name !== null) as string[];

      const { error } = await supabase.from("meeting_minutes").insert({
        created_by: user.id,
        title: form.title,
        meeting_date: form.meeting_date,
        meeting_type: form.meeting_type,
        attendees: sanitizedAttendees,
        agenda: form.agenda || null,
        discussions: form.discussions || null,
        decisions: form.decisions || null,
        action_items: form.action_items || null,
        next_meeting_date: form.next_meeting_date || null,
        status: form.status,
        chairperson_name: sanitize(form.chairperson_name),
        chairperson_signature_url: form.chairperson_signature_url || null,
        secretary_name: sanitize(form.secretary_name),
        secretary_signature_url: form.secretary_signature_url || null,
        absent_with_apology: form.absent_with_apology.map(n => sanitize(n)).filter(Boolean) as string[],
        absent_without_apology: form.absent_without_apology.map(n => sanitize(n)).filter(Boolean) as string[],
        visible_to_members: form.visible_to_members.map(n => sanitize(n)).filter(Boolean) as string[],
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-minutes"] });
      setMinutesOpen(false);
      resetForm();
      toast.success("Meeting minutes created successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMinutes = useMutation({
    mutationFn: async () => {
      // Sanitize - only allow word chars, spaces, dots, hyphens
      const sanitize = (text: string | null | undefined) => {
        if (!text) return null;
        return text.trim().replace(/[^\w\s\.\-]/g, '').substring(0, 255);
      };

      const sanitizedAttendees = selectedAttendees
        .map(name => sanitize(name))
        .filter(name => name !== null) as string[];

      const { error } = await supabase
        .from("meeting_minutes")
        .update({
          title: form.title,
          meeting_date: form.meeting_date,
          meeting_type: form.meeting_type,
          attendees: sanitizedAttendees,
          agenda: form.agenda || null,
          discussions: form.discussions || null,
          decisions: form.decisions || null,
          action_items: form.action_items || null,
          next_meeting_date: form.next_meeting_date || null,
          status: form.status,
          chairperson_name: sanitize(form.chairperson_name),
          chairperson_signature_url: form.chairperson_signature_url || null,
          secretary_name: sanitize(form.secretary_name),
          secretary_signature_url: form.secretary_signature_url || null,
          absent_with_apology: form.absent_with_apology.map(n => sanitize(n)).filter(Boolean) as string[],
          absent_without_apology: form.absent_without_apology.map(n => sanitize(n)).filter(Boolean) as string[],
          visible_to_members: form.visible_to_members.map(n => sanitize(n)).filter(Boolean) as string[],
          rejection_notes: null,
          reviewed_by: null,
          reviewed_at: null
        })
        .eq("id", selectedMinutes.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-minutes"] });
      setEditMinutesOpen(false);
      setSelectedMinutes(null);
      resetForm();
      toast.success("Meeting minutes updated successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMinutes = useMutation({
    mutationFn: async (minutesId: string) => {
      const { error } = await supabase
        .from("meeting_minutes")
        .delete()
        .eq("id", minutesId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-minutes"] });
      toast.success("Meeting minutes deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitForApprovalMutation = useMutation({
    mutationFn: async (minutesId: string) => {
      const { error } = await supabase
        .from("meeting_minutes")
        .update({
          status: "submitted",
          submitted_by: user?.id,
          submitted_at: new Date().toISOString()
        })
        .eq("id", minutesId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-minutes"] });
      toast.success("Minutes submitted for chairperson approval");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setForm({
      title: "",
      meeting_date: new Date().toISOString().split("T")[0],
      meeting_type: "general",
      agenda: "",
      discussions: "",
      decisions: "",
      action_items: "",
      next_meeting_date: "",
      status: "draft",
      chairperson_name: "",
      chairperson_signature_url: "",
      secretary_name: "",
      secretary_signature_url: secretarySignature?.signature_url || "", // Keep signature if available
      absent_with_apology: [],
      absent_without_apology: [],
      visible_to_members: [],
    });
    setSelectedAttendees([]);
    setAttendeeSearch("");
    setFormInitialized(false); // Reset so names get refilled on next form
  };

  const handleEditMinutes = (m: any) => {
    setSelectedMinutes(m);
    setForm({
      title: m.title,
      meeting_date: m.meeting_date,
      meeting_type: m.meeting_type,
      agenda: m.agenda || "",
      discussions: m.discussions || "",
      decisions: m.decisions || "",
      action_items: m.action_items || "",
      next_meeting_date: m.next_meeting_date || "",
      status: "draft", // Reset to draft when editing rejected minutes
      chairperson_name: m.chairperson_name || "",
      chairperson_signature_url: m.chairperson_signature_url || "",
      secretary_name: m.secretary_name || "",
      secretary_signature_url: m.secretary_signature_url || "",
      absent_with_apology: m.absent_with_apology || [],
      absent_without_apology: m.absent_without_apology || [],
      visible_to_members: m.visible_to_members || [],
    });
    setSelectedAttendees(m.attendees || []);
    setAttendeeSearch("");
    setEditMinutesOpen(true);
  };

  const uploadSignature = async (file: File, type: 'chairperson' | 'secretary') => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('signatures')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('signatures')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      toast.error(`Failed to upload signature: ${error.message}`);
      return null;
    }
  };

  const handleChairpersonSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    toast.error("Chairperson signature must be uploaded separately by the chairperson");
  };

  const handleSecretarySignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    toast.error("Please upload your signature in the Secretary Signature page first");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Meeting Minutes
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0 hover:opacity-90">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Writing Assistant
          </Button>
          <Dialog open={minutesOpen} onOpenChange={setMinutesOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Minutes
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Meeting Minutes</DialogTitle>
                <DialogDescription>Record the details of your meeting</DialogDescription>
              </DialogHeader>
              <MinutesForm
                form={form}
                setForm={setForm}
                selectedAttendees={selectedAttendees}
                setSelectedAttendees={setSelectedAttendees}
                attendeeSearch={attendeeSearch}
                setAttendeeSearch={setAttendeeSearch}
                members={members}
                executiveMembers={executiveMembers}
                uploadingChairperson={uploadingChairperson}
                uploadingSecretary={uploadingSecretary}
                handleChairpersonSignatureUpload={handleChairpersonSignatureUpload}
                handleSecretarySignatureUpload={handleSecretarySignatureUpload}
                absenceSearch={absenceSearch}
                setAbsenceSearch={setAbsenceSearch}
                absenceWithApologySearch={absenceWithApologySearch}
                setAbsenceWithApologySearch={setAbsenceWithApologySearch}
                visibilitySearch={visibilitySearch}
                setVisibilitySearch={setVisibilitySearch}
              />
              <Button
                onClick={() => createMinutes.mutate()}
                disabled={createMinutes.isPending || !form.title || !form.meeting_date}
                className="w-full"
              >
                {createMinutes.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                ) : (
                  "Create Minutes"
                )}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* AI Assistant Info Card */}
      <Card className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border-violet-200 dark:border-violet-800">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-1">AI Writing Assistant Available</h3>
              <p className="text-xs text-muted-foreground">
                Click the AI button in the bottom right corner to get help writing your meeting minutes. 
                Just paste your notes or describe the meeting, and I'll help you format professional minutes!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Minutes List */}
      <Card>
        <CardHeader>
          <CardTitle>Meeting Records</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading minutes...</div>
          ) : minutes?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No meeting minutes recorded yet
            </div>
          ) : (
            <div className="space-y-3">
              {minutes?.map((m) => (
                <div key={m.id} className="border rounded-lg p-4 hover:bg-accent/50 transition">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{m.title}</h3>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(m.meeting_date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        m.status === "approved" ? "default" : 
                        m.status === "submitted" ? "warning" : 
                        m.status === "rejected" ? "destructive" : 
                        "secondary"
                      }>
                        {m.status}
                      </Badge>
                      <Badge variant="outline">{m.meeting_type}</Badge>
                    </div>
                  </div>
                  
                  {m.attendees && m.attendees.length > 0 && (
                    <div className="text-sm mb-2">
                      <span className="font-medium">Attendees:</span> {m.attendees.join(", ")}
                    </div>
                  )}
                  
                  {m.agenda && (
                    <div className="text-sm mb-2">
                      <span className="font-medium">Agenda:</span> {m.agenda.substring(0, 100)}...
                    </div>
                  )}
                  
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditMinutes(m)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    
                    {m.status === "draft" && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => submitForApprovalMutation.mutate(m.id)}
                        disabled={submitForApprovalMutation.isPending}
                      >
                        {submitForApprovalMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4 mr-1" />
                        )}
                        Submit for Approval
                      </Button>
                    )}
                    
                    {m.status === "rejected" && (
                      <div className="text-xs text-muted-foreground">
                        <p>Rejected with notes: {m.rejection_notes || "No notes provided"}</p>
                      </div>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm(`Delete minutes for "${m.title}"?`)) {
                          deleteMinutes.mutate(m.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editMinutesOpen} onOpenChange={setEditMinutesOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Meeting Minutes</DialogTitle>
            <DialogDescription>Update the meeting details</DialogDescription>
          </DialogHeader>
          
          {selectedMinutes?.rejection_notes && (
            <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 mb-4">
              <CardContent className="pt-4">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-yellow-600" />
                  Chairperson Feedback
                </h4>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {selectedMinutes.rejection_notes}
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
                  Please address these issues before resubmitting for approval
                </p>
              </CardContent>
            </Card>
          )}
          
          <MinutesForm
            form={form}
            setForm={setForm}
            selectedAttendees={selectedAttendees}
            setSelectedAttendees={setSelectedAttendees}
            attendeeSearch={attendeeSearch}
            setAttendeeSearch={setAttendeeSearch}
            members={members}
            executiveMembers={executiveMembers}
            uploadingChairperson={uploadingChairperson}
            uploadingSecretary={uploadingSecretary}
            handleChairpersonSignatureUpload={handleChairpersonSignatureUpload}
            handleSecretarySignatureUpload={handleSecretarySignatureUpload}
            absenceSearch={absenceSearch}
            setAbsenceSearch={setAbsenceSearch}
            absenceWithApologySearch={absenceWithApologySearch}
            setAbsenceWithApologySearch={setAbsenceWithApologySearch}
            visibilitySearch={visibilitySearch}
            setVisibilitySearch={setVisibilitySearch}
          />
          <Button
            onClick={() => updateMinutes.mutate()}
            disabled={updateMinutes.isPending || !form.title || !form.meeting_date}
            className="w-full"
          >
            {updateMinutes.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating...</>
            ) : (
              "Update Minutes"
            )}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}