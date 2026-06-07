import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  Target,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

interface Campaign {
  id: string;
  title: string;
  description?: string;
  amount: number;
  goal_type: 'fixed' | 'shared';
  target_total?: number | null;
  allow_partial: boolean;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export default function DonationCampaigns() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [goalType, setGoalType] = useState<'fixed' | 'shared'>('fixed');
  const [perMemberAmount, setPerMemberAmount] = useState('');
  const [targetTotal, setTargetTotal] = useState('');
  const [allowPartial, setAllowPartial] = useState(true);
  const [isActive, setIsActive] = useState(true);

  // Computed per-member share when using a shared total target
  const computedShare =
    goalType === 'shared' && targetTotal && memberCount > 0
      ? Math.ceil(parseFloat(targetTotal) / memberCount)
      : 0;

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const [{ data, error }, { count }] = await Promise.all([
        supabase
          .from('donation_campaigns')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('members')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),
      ]);

      if (error) throw error;
      setCampaigns((data as any) || []);
      setMemberCount(count || 0);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast.error('Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!campaignTitle.trim() || !campaignDescription.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Determine the per-member amount to store
    let amountPerMember = 0;
    let totalTargetValue: number | null = null;

    if (goalType === 'shared') {
      const total = parseFloat(targetTotal);
      if (!total || total <= 0) {
        toast.error('Enter a valid total target amount');
        return;
      }
      if (memberCount <= 0) {
        toast.error('No active members to split the target across');
        return;
      }
      totalTargetValue = total;
      amountPerMember = Math.ceil(total / memberCount);
    } else {
      const perMember = parseFloat(perMemberAmount);
      if (!perMember || perMember <= 0) {
        toast.error('Enter a valid per-member amount');
        return;
      }
      amountPerMember = perMember;
    }

    try {
      setSubmitting(true);

      const payload = {
        title: campaignTitle.trim(),
        description: campaignDescription.trim(),
        amount: amountPerMember,
        goal_type: goalType,
        target_total: totalTargetValue,
        allow_partial: allowPartial,
        active: isActive,
      };

      if (editingId) {
        const { error } = await supabase
          .from('donation_campaigns')
          .update({ ...payload, updated_at: new Date().toISOString() } as any)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Funds drive updated successfully');
      } else {
        if (!user?.id) throw new Error('You must be logged in to create a funds drive');
        const { error } = await supabase
          .from('donation_campaigns')
          .insert([{ ...payload, created_by: user.id }] as any);
        if (error) throw new Error(error.message || 'Failed to create funds drive');
        toast.success('Funds drive created successfully');
      }

      resetForm();
      await fetchCampaigns();
      setShowDialog(false);
    } catch (error: any) {
      console.error('Error saving campaign:', error);
      toast.error(error?.message || 'Failed to save funds drive');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this funds drive?')) return;
    try {
      const { error } = await supabase.from('donation_campaigns').delete().eq('id', id);
      if (error) throw error;
      toast.success('Funds drive deleted successfully');
      await fetchCampaigns();
    } catch (error: any) {
      console.error('Error deleting campaign:', error);
      toast.error(error?.message || 'Failed to delete funds drive');
    }
  };

  const handleEdit = (campaign: Campaign) => {
    setCampaignTitle(campaign.title);
    setCampaignDescription(campaign.description || '');
    setGoalType(campaign.goal_type || 'fixed');
    setPerMemberAmount(campaign.amount?.toString() || '');
    setTargetTotal(campaign.target_total?.toString() || '');
    setAllowPartial(campaign.allow_partial ?? true);
    setIsActive(campaign.active);
    setEditingId(campaign.id);
    setShowDialog(true);
  };

  const resetForm = () => {
    setCampaignTitle('');
    setCampaignDescription('');
    setGoalType('fixed');
    setPerMemberAmount('');
    setTargetTotal('');
    setAllowPartial(true);
    setIsActive(true);
    setEditingId(null);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    resetForm();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Target className="h-8 w-8" />
            Funds Drives
          </h1>
          <p className="text-gray-600 mt-1 flex items-center gap-1">
            <Users className="h-4 w-4" /> {memberCount} active members
          </p>
        </div>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} className="gap-2">
              <Plus className="h-4 w-4" />
              New Funds Drive
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Edit Funds Drive' : 'Create New Funds Drive'}
              </DialogTitle>
              <DialogDescription>
                {editingId ? 'Update funds drive details' : 'Create a new funds drive'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Funds Drive Title *</label>
                <Input
                  placeholder="e.g., Building Fund 2026"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Description *</label>
                <Textarea
                  placeholder="e.g., Contributions for the new community center construction"
                  value={campaignDescription}
                  onChange={(e) => setCampaignDescription(e.target.value)}
                  disabled={submitting}
                  rows={3}
                />
              </div>

              {/* Goal type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Goal Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGoalType('fixed')}
                    className={`rounded-lg border p-3 text-left text-sm transition ${
                      goalType === 'fixed' ? 'border-primary bg-primary/5' : 'border-slate-200'
                    }`}
                  >
                    <p className="font-semibold">Fixed amount</p>
                    <p className="text-xs text-slate-500">Each member pays the same set amount</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGoalType('shared')}
                    className={`rounded-lg border p-3 text-left text-sm transition ${
                      goalType === 'shared' ? 'border-primary bg-primary/5' : 'border-slate-200'
                    }`}
                  >
                    <p className="font-semibold">Shared target</p>
                    <p className="text-xs text-slate-500">Split a total goal across members</p>
                  </button>
                </div>
              </div>

              {goalType === 'fixed' ? (
                <div>
                  <label className="text-sm font-medium">Amount Per Member (KES) *</label>
                  <Input
                    type="number"
                    placeholder="600"
                    value={perMemberAmount}
                    onChange={(e) => setPerMemberAmount(e.target.value)}
                    disabled={submitting}
                    min="0"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Total Target Amount (KES) *</label>
                  <Input
                    type="number"
                    placeholder="20000"
                    value={targetTotal}
                    onChange={(e) => setTargetTotal(e.target.value)}
                    disabled={submitting}
                    min="0"
                  />
                  <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                    Split across <strong>{memberCount}</strong> active members ={' '}
                    <strong>KES {computedShare.toLocaleString()}</strong> per member.
                  </div>
                </div>
              )}

              {/* Lipa Mdogo Mdogo */}
              <div className="flex items-start gap-2 rounded-lg border border-slate-200 p-3">
                <input
                  type="checkbox"
                  id="allowPartial"
                  checked={allowPartial}
                  onChange={(e) => setAllowPartial(e.target.checked)}
                  disabled={submitting}
                  className="mt-1 rounded"
                />
                <label htmlFor="allowPartial" className="text-sm">
                  <span className="font-medium">Allow Lipa Mdogo Mdogo</span>
                  <span className="block text-xs text-slate-500">
                    Members can pay in bits (any amount they can afford) until they reach their share.
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={submitting}
                  className="rounded"
                />
                <label htmlFor="active" className="text-sm font-medium">
                  Active Funds Drive
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleCloseDialog}
                  disabled={submitting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1 gap-2">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingId ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {campaigns.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No funds drives yet. Create one to start collecting contributions for a specific cause.
          </AlertDescription>
        </Alert>
      ) : null}

      {campaigns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All Funds Drives</CardTitle>
            <CardDescription>Manage your funds drives</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHead>
                <TableRow>
                  <th>Funds Drive Title</th>
                  <th>Per Member</th>
                  <th>Target</th>
                  <th>Lipa Mdogo</th>
                  <th>Status</th>
                  <th>Actions</th>
                </TableRow>
              </TableHead>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.title}</TableCell>
                    <TableCell>KES {Number(campaign.amount).toLocaleString()}</TableCell>
                    <TableCell>
                      {campaign.goal_type === 'shared' && campaign.target_total
                        ? `KES ${Number(campaign.target_total).toLocaleString()}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={campaign.allow_partial ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'}>
                        {campaign.allow_partial ? 'Enabled' : 'Off'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={campaign.active ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                        {campaign.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(campaign)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(campaign.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
