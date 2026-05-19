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
} from 'lucide-react';
import { toast } from 'sonner';

interface Campaign {
  id: string;
  title: string;
  description?: string;
  amount: number;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export default function DonationCampaigns() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Fetch campaigns
  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('donation_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching campaigns:', error);
        throw error;
      }
      setCampaigns((data as any) || []);
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

  // Create or update campaign
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!campaignTitle.trim() || !campaignDescription.trim() || !targetAmount) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      if (editingId) {
        // Update campaign
        const { error } = await supabase
          .from('donation_campaigns')
          .update({
            title: campaignTitle.trim(),
            description: campaignDescription.trim(),
            amount: parseFloat(targetAmount),
            active: isActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (error) {
          console.error('Campaign update error:', error);
          throw error;
        }
        toast.success('Campaign updated successfully');
      } else {
        // Create new campaign
        if (!user?.id) {
          throw new Error('You must be logged in to create a campaign');
        }

        const { error } = await supabase
          .from('donation_campaigns')
          .insert([{
            title: campaignTitle.trim(),
            description: campaignDescription.trim(),
            amount: parseFloat(targetAmount),
            active: isActive,
            created_by: user.id,
          }]);

        if (error) {
          console.error('Campaign creation error:', error);
          throw new Error(error.message || 'Failed to create campaign');
        }
        
        toast.success('Campaign created successfully');
      }

      // Reset form and refresh
      resetForm();
      await fetchCampaigns();
      setShowDialog(false);
    } catch (error: any) {
      console.error('Error saving campaign:', error);
      const errorMessage = error?.message || 'Failed to save campaign';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete campaign
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this campaign?')) return;

    try {
      const { error } = await supabase
        .from('donation_campaigns')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Campaign deletion error:', error);
        throw error;
      }
      toast.success('Campaign deleted successfully');
      await fetchCampaigns();
    } catch (error: any) {
      console.error('Error deleting campaign:', error);
      const errorMessage = error?.message || 'Failed to delete campaign';
      toast.error(errorMessage);
    }
  };

  // Edit campaign
  const handleEdit = (campaign: Campaign) => {
    setCampaignTitle(campaign.title);
    setCampaignDescription(campaign.description || '');
    setTargetAmount(campaign.amount.toString());
    setIsActive(campaign.active);
    setEditingId(campaign.id);
    setShowDialog(true);
  };

  // Reset form
  const resetForm = () => {
    setCampaignTitle('');
    setCampaignDescription('');
    setTargetAmount('');
    setIsActive(true);
    setEditingId(null);
  };

  // Close dialog
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
          <p className="text-gray-600 mt-1">Manage funds drives and track contributions</p>
        </div>
        
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} className="gap-2">
              <Plus className="h-4 w-4" />
              New Campaign
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Edit Funds Drive' : 'Create New Funds Drive'}
              </DialogTitle>
              <DialogDescription>
                {editingId 
                  ? 'Update funds drive details'
                  : 'Create a new funds drive'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Campaign Title */}
              <div>
                <label className="text-sm font-medium">Funds Drive Title *</label>
                <Input
                  placeholder="e.g., Building Fund 2026"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  disabled={submitting}
                />
              </div>

              {/* Description */}
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

              {/* Target Amount */}
              <div>
                <label className="text-sm font-medium">Target Amount (KES) *</label>
                <Input
                  type="number"
                  placeholder="50000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  disabled={submitting}
                  min="0"
                />
              </div>

              {/* Active Status */}
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

              {/* Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
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

      {/* Empty State */}
      {campaigns.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No funds drives yet. Create one to start collecting contributions for a specific cause.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Campaigns Table */}
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
                  <th>Target Amount</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </TableRow>
              </TableHead>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.title}</TableCell>
                    <TableCell>
                      KES {campaign.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={campaign.active ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                        {campaign.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(campaign.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(campaign)}
                      >
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
