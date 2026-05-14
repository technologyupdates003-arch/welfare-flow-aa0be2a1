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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Loader2, 
  AlertCircle, 
  Plus, 
  Edit2, 
  Trash2,
  Target,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';

interface Campaign {
  id: string;
  name: string;
  description: string;
  target_amount: number;
  collected_amount: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  start_date: string;
  end_date?: string;
  created_by: string;
  created_at: string;
}

export default function DonationCampaigns() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [campaignName, setCampaignName] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [campaignStatus, setCampaignStatus] = useState('active');
  const [endDate, setEndDate] = useState('');

  // Fetch campaigns
  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('donation_campaigns' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
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
    
    if (!campaignName.trim() || !campaignDescription.trim() || !targetAmount) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      if (editingId) {
        // Update campaign
        const { error } = await supabase
          .from('donation_campaigns' as any)
          .update({
            name: campaignName,
            description: campaignDescription,
            target_amount: parseFloat(targetAmount),
            status: campaignStatus,
            end_date: endDate || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Campaign updated successfully');
      } else {
        // Create new campaign
        const { error } = await supabase
          .from('donation_campaigns' as any)
          .insert({
            name: campaignName,
            description: campaignDescription,
            target_amount: parseFloat(targetAmount),
            status: campaignStatus,
            end_date: endDate || null,
            created_by: user?.id,
          });

        if (error) throw error;
        toast.success('Campaign created successfully');
      }

      // Reset form and refresh
      resetForm();
      await fetchCampaigns();
      setShowDialog(false);
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast.error('Failed to save campaign');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete campaign
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this campaign?')) return;

    try {
      const { error } = await supabase
        .from('donation_campaigns' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Campaign deleted successfully');
      await fetchCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast.error('Failed to delete campaign');
    }
  };

  // Edit campaign
  const handleEdit = (campaign: Campaign) => {
    setCampaignName(campaign.name);
    setCampaignDescription(campaign.description);
    setTargetAmount(campaign.target_amount.toString());
    setCampaignStatus(campaign.status);
    setEndDate(campaign.end_date?.split('T')[0] || '');
    setEditingId(campaign.id);
    setShowDialog(true);
  };

  // Reset form
  const resetForm = () => {
    setCampaignName('');
    setCampaignDescription('');
    setTargetAmount('');
    setCampaignStatus('active');
    setEndDate('');
    setEditingId(null);
  };

  // Close dialog
  const handleCloseDialog = () => {
    setShowDialog(false);
    resetForm();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressPercentage = (campaign: Campaign) => {
    return campaign.target_amount > 0 
      ? Math.min((campaign.collected_amount / campaign.target_amount) * 100, 100)
      : 0;
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
            Donation Campaigns
          </h1>
          <p className="text-gray-600 mt-1">Manage donation campaigns and track collections</p>
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
                {editingId ? 'Edit Campaign' : 'Create New Campaign'}
              </DialogTitle>
              <DialogDescription>
                {editingId 
                  ? 'Update campaign details'
                  : 'Create a new donation campaign with a target amount'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Campaign Name */}
              <div>
                <label className="text-sm font-medium">Campaign Name *</label>
                <Input
                  placeholder="e.g., Building Fund 2026"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  disabled={submitting}
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium">Description *</label>
                <Textarea
                  placeholder="e.g., Donations for the new community center construction"
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

              {/* Status */}
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={campaignStatus} onValueChange={setCampaignStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* End Date */}
              <div>
                <label className="text-sm font-medium">End Date (Optional)</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={submitting}
                />
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
            No campaigns yet. Create one to start collecting donations for a specific cause.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Campaigns Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((campaign) => {
          const progressPercentage = getProgressPercentage(campaign);
          
          return (
            <Card key={campaign.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{campaign.name}</CardTitle>
                    <Badge className={`mt-2 ${getStatusColor(campaign.status)}`}>
                      {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(campaign)}
                      className="h-8 w-8"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(campaign.id)}
                      className="h-8 w-8 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Description */}
                <p className="text-sm text-gray-600">{campaign.description}</p>

                {/* Progress */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      Progress
                    </span>
                    <span className="text-sm text-gray-600">
                      KES {campaign.collected_amount.toLocaleString()} / {campaign.target_amount.toLocaleString()}
                    </span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                  <p className="text-xs text-gray-500 mt-1">
                    {progressPercentage.toFixed(1)}% collected
                  </p>
                </div>

                {/* Dates */}
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Started: {new Date(campaign.start_date).toLocaleDateString()}
                    </span>
                  </div>
                  {campaign.end_date && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Ends: {new Date(campaign.end_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Campaigns Table (Alternative View) */}
      {campaigns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All Campaigns</CardTitle>
            <CardDescription>Detailed view of all donation campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHead>Campaign Name</TableHead>
                  <TableHead>Target Amount</TableHead>
                  <TableHead>Collected</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHead>
              <TableBody>
                {campaigns.map((campaign) => {
                  const progressPercentage = getProgressPercentage(campaign);
                  
                  return (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.name}</TableCell>
                      <TableCell>
                        KES {campaign.target_amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        KES {campaign.collected_amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">
                            {progressPercentage.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(campaign.status)}>
                          {campaign.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(campaign.start_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(campaign)}
                          className="mr-1"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(campaign.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
