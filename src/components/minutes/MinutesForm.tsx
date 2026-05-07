import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface MinutesFormProps {
  form: any;
  setForm: (form: any) => void;
  selectedAttendees: string[];
  setSelectedAttendees: (attendees: string[]) => void;
  attendeeSearch: string;
  setAttendeeSearch: (search: string) => void;
  members: any[];
  executiveMembers: any[];
  absenceSearch: string;
  setAbsenceSearch: (search: string) => void;
  absenceWithApologySearch: string;
  setAbsenceWithApologySearch: (search: string) => void;
  visibilitySearch: string;
  setVisibilitySearch: (search: string) => void;
  /** Hide the status select (e.g. for vice-secretary submission flow) */
  hideStatus?: boolean;
}

export function MinutesForm({
  form,
  setForm,
  selectedAttendees,
  setSelectedAttendees,
  attendeeSearch,
  setAttendeeSearch,
  members,
  executiveMembers,
  absenceSearch,
  setAbsenceSearch,
  absenceWithApologySearch,
  setAbsenceWithApologySearch,
  visibilitySearch,
  setVisibilitySearch,
  hideStatus,
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

  const baseList = form.meeting_type === "executive" ? executiveMembers.map((m: any) => ({
    id: m.user_id,
    name: m.members?.name,
    phone: m.members?.phone,
  })) : members;

  const filteredMembers = baseList.filter((m: any) =>
    !form.absent_with_apology.includes(m.name) &&
    !form.absent_without_apology.includes(m.name) &&
    (m.name?.toLowerCase().includes(attendeeSearch.toLowerCase()) || m.phone?.includes(attendeeSearch))
  );

  const filteredAbsentWithoutApologyMembers = baseList.filter((m: any) =>
    !selectedAttendees.includes(m.name) &&
    !form.absent_with_apology.includes(m.name) &&
    (m.name?.toLowerCase().includes(absenceSearch.toLowerCase()) || m.phone?.includes(absenceSearch))
  );

  const filteredAbsentWithApologyMembers = baseList.filter((m: any) =>
    !selectedAttendees.includes(m.name) &&
    !form.absent_without_apology.includes(m.name) &&
    (m.name?.toLowerCase().includes(absenceWithApologySearch.toLowerCase()) || m.phone?.includes(absenceWithApologySearch))
  );

  const filteredVisibilityMembers = (form.meeting_type === "executive" ? executiveMembers : members).filter((m: any) =>
    (m.members?.name?.toLowerCase().includes(visibilitySearch.toLowerCase()) ||
     m.members?.phone?.includes(visibilitySearch))
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
                  <button onClick={() => toggleAttendee(name)} className="ml-1 hover:text-destructive">×</button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Absence Tracking */}
        <div className="col-span-2 border-t border-border pt-4 mt-2">
          <h4 className="font-semibold text-sm mb-3">Absence Tracking</h4>
          <div className="grid grid-cols-2 gap-4">
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
                      <label key={member.id} className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer transition">
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
                      <button onClick={() => toggleAbsentWithApology(name)} className="ml-1 hover:text-destructive">×</button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

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
                      <label key={member.id} className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer transition">
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
                      <button onClick={() => toggleAbsentWithoutApology(name)} className="ml-1 hover:text-white">×</button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Executive Visibility */}
        {form.meeting_type === "executive" && (
          <div className="col-span-2 border-t border-border pt-4 mt-2">
            <h4 className="font-semibold text-sm mb-3">Executive Members Who Can View ({form.visible_to_members.length} selected)</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Select which office bearers can view these executive meeting minutes.
              If none are selected, all office bearers will be able to view.
            </p>
            <Input
              value={visibilitySearch}
              onChange={e => setVisibilitySearch(e.target.value)}
              placeholder="Search office bearers..."
              className="mb-2"
            />
            <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
              {filteredVisibilityMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No office bearers found</p>
              ) : (
                <div className="divide-y divide-border">
                  {filteredVisibilityMembers.map((member: any) => (
                    <label key={member.id} className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer transition">
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
          </div>
        )}

        <div className="col-span-2">
          <Label>Agenda</Label>
          <Textarea value={form.agenda} onChange={e => setForm({ ...form, agenda: e.target.value })} rows={3} />
        </div>
        <div className="col-span-2">
          <Label>Discussions</Label>
          <Textarea value={form.discussions} onChange={e => setForm({ ...form, discussions: e.target.value })} rows={3} />
        </div>
        <div className="col-span-2">
          <Label>Decisions Made</Label>
          <Textarea value={form.decisions} onChange={e => setForm({ ...form, decisions: e.target.value })} rows={3} />
        </div>
        <div className="col-span-2">
          <Label>Action Items</Label>
          <Textarea value={form.action_items} onChange={e => setForm({ ...form, action_items: e.target.value })} rows={3} />
        </div>
        <div>
          <Label>Next Meeting Date</Label>
          <Input
            type="date"
            value={form.next_meeting_date}
            onChange={e => setForm({ ...form, next_meeting_date: e.target.value })}
          />
        </div>
        {!hideStatus && (
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={value => setForm({ ...form, status: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
