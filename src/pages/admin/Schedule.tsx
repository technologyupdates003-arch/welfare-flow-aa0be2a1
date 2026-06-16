import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Calendar, Clock, AlertCircle, Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface ScheduledItem {
  id: string;
  type: 'event' | 'news';
  title: string;
  description?: string;
  scheduled_date: string;
  rescheduled_date?: string | null;
  reschedule_reason?: string | null;
  status: string;
  created_at: string;
  is_visible: boolean;
  days_until: number;
  is_passed: boolean;
}

export default function Schedule() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    scheduled_date: '',
    rescheduled_date: '',
    reschedule_reason: '',
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    type: 'event' as 'event' | 'news',
    title: '',
    description: '',
    scheduled_date: '',
    contribution_amount: '',
  });

  // Real-time update interval
  useEffect(() => {
    fetchSchedules();
    const interval = setInterval(fetchSchedules, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const fetchSchedules = async () => {
    try {
      setLoading(true);

      // Fetch scheduled events
      const { data: events } = await supabase
        .from('events')
        .select('id, title, description, scheduled_date, rescheduled_date, reschedule_reason, status, created_at')
        .not('scheduled_date', 'is', null)
        .order('scheduled_date', { ascending: true });

      // Fetch scheduled news
      const { data: news } = await supabase
        .from('news')
        .select('id, title, content, scheduled_date, rescheduled_date, reschedule_reason, status, created_at')
        .not('scheduled_date', 'is', null)
        .order('scheduled_date', { ascending: true });

      const now = new Date();

      // Process events
      const processedEvents = (events || []).map((e: any) => {
        const schedDate = new Date(e.rescheduled_date || e.scheduled_date);
        const daysUntil = Math.ceil((schedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const isPassed = schedDate < now;

        return {
          id: e.id,
          type: 'event' as const,
          title: e.title,
          description: e.description,
          scheduled_date: e.scheduled_date,
          rescheduled_date: e.rescheduled_date,
          reschedule_reason: e.reschedule_reason,
          status: e.status,
          created_at: e.created_at,
          is_visible: !isPassed,
          days_until: daysUntil,
          is_passed: isPassed,
        };
      });

      // Process news
      const processedNews = (news || []).map((n: any) => {
        const schedDate = new Date(n.rescheduled_date || n.scheduled_date);
        const daysUntil = Math.ceil((schedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const isPassed = schedDate < now;

        return {
          id: n.id,
          type: 'news' as const,
          title: n.title,
          description: n.content,
          scheduled_date: n.scheduled_date,
          rescheduled_date: n.rescheduled_date,
          reschedule_reason: n.reschedule_reason,
          status: n.status,
          created_at: n.created_at,
          is_visible: !isPassed,
          days_until: daysUntil,
          is_passed: isPassed,
        };
      });

      // Combine and sort by scheduled date
      const all = [...processedEvents, ...processedNews].sort(
        (a, b) => new Date(a.rescheduled_date || a.scheduled_date).getTime() - new Date(b.rescheduled_date || b.scheduled_date).getTime()
      );

      setItems(all);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      toast.error('Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!editingId || !form.rescheduled_date) {
      toast.error('Please select a new date');
      return;
    }

    const item = items.find(i => i.id === editingId);
    if (!item) return;

    try {
      const table = item.type === 'event' ? 'events' : 'news';
      const { error } = await supabase
        .from(table)
        .update({
          rescheduled_date: new Date(form.rescheduled_date).toISOString(),
          reschedule_reason: form.reschedule_reason || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);

      if (error) throw error;

      toast.success('Schedule updated successfully');
      setOpen(false);
      setEditingId(null);
      setForm({ title: '', description: '', scheduled_date: '', rescheduled_date: '', reschedule_reason: '' });
      fetchSchedules();
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast.error('Failed to update schedule');
    }
  };

  const handleDelete = async (id: string, type: 'event' | 'news') => {
    if (!confirm('Are you sure you want to delete this scheduled item?')) return;

    try {
      const table = type === 'event' ? 'events' : 'news';
      const { error } = await supabase
        .from(table)
        .update({ scheduled_date: null, rescheduled_date: null })
        .eq('id', id);

      if (error) throw error;

      toast.success('Schedule removed');
      fetchSchedules();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error('Failed to remove schedule');
    }
  };

  const openRescheduleDialog = (item: ScheduledItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description || '',
      scheduled_date: item.scheduled_date,
      rescheduled_date: item.rescheduled_date || '',
      reschedule_reason: item.reschedule_reason || '',
    });
    setOpen(true);
  };

  const getStatusBadge = (item: ScheduledItem) => {
    if (item.is_passed) {
      return <Badge variant="destructive">Passed</Badge>;
    }
    if (item.days_until <= 1) {
      return <Badge variant="default" className="bg-red-600">Today/Tomorrow</Badge>;
    }
    if (item.days_until <= 7) {
      return <Badge variant="secondary" className="bg-yellow-600 text-white">This Week</Badge>;
    }
    return <Badge variant="outline">Upcoming</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const upcomingItems = items.filter(i => !i.is_passed);
  const passedItems = items.filter(i => i.is_passed);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Calendar className="h-8 w-8" /> Event & News Schedule
        </h1>
        <p className="text-gray-600 mt-2">
          Manage scheduled events and news. Items automatically disappear when their date arrives or passes.
        </p>
      </div>

      {/* Real-time Status Alert */}
      <Alert className="border-blue-200 bg-blue-50">
        <Clock className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900">
          ⏱️ Real-time updates every minute. Items disappear automatically when scheduled date arrives.
        </AlertDescription>
      </Alert>

      {/* Upcoming Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-green-600" />
            Upcoming Schedules ({upcomingItems.length})
          </CardTitle>
          <CardDescription>
            These items are currently visible to members
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingItems.length === 0 ? (
            <p className="text-center text-gray-600 py-8">No upcoming schedules</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Scheduled Date</TableHead>
                    <TableHead>Days Until</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingItems.map((item) => (
                    <TableRow key={`${item.type}-${item.id}`}>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {item.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell>
                        {new Date(item.rescheduled_date || item.scheduled_date).toLocaleString()}
                        {item.rescheduled_date && (
                          <div className="text-xs text-orange-600 mt-1">
                            Rescheduled from {new Date(item.scheduled_date).toLocaleDateString()}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">
                          {item.days_until === 0 ? 'Today' : item.days_until === 1 ? 'Tomorrow' : `${item.days_until} days`}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(item)}</TableCell>
                      <TableCell className="space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRescheduleDialog(item)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(item.id, item.type)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Passed Items */}
      {passedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <EyeOff className="h-5 w-5 text-gray-600" />
              Hidden Schedules ({passedItems.length})
            </CardTitle>
            <CardDescription>
              These items have passed and are hidden from members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Was Scheduled</TableHead>
                    <TableHead>Days Ago</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {passedItems.map((item) => (
                    <TableRow key={`${item.type}-${item.id}`} className="opacity-60">
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {item.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell>
                        {new Date(item.rescheduled_date || item.scheduled_date).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600">
                          {Math.abs(item.days_until)} days ago
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(item.id, item.type)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reschedule Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule {editingId ? items.find(i => i.id === editingId)?.type : ''}</DialogTitle>
            <DialogDescription>
              Change the scheduled date for this item
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input value={form.title} disabled className="mt-1" />
            </div>

            <div>
              <label className="text-sm font-medium">Current Scheduled Date</label>
              <Input
                value={new Date(form.scheduled_date).toLocaleString()}
                disabled
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">New Scheduled Date *</label>
              <Input
                type="datetime-local"
                value={form.rescheduled_date}
                onChange={(e) => setForm({ ...form, rescheduled_date: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Reason for Rescheduling</label>
              <Textarea
                placeholder="Why is this being rescheduled?"
                value={form.reschedule_reason}
                onChange={(e) => setForm({ ...form, reschedule_reason: e.target.value })}
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleReschedule} className="flex-1">
                Update Schedule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
