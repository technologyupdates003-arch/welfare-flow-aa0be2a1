import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { initiatePenaltySTKPush, formatPhoneNumber } from '@/lib/stkpush';

interface Penalty {
  id: string;
  amount: number;
  reason: string;
  is_paid: boolean;
  created_at: string;
  contribution_id?: string;
}

interface Member {
  id: string;
  phone: string;
  name: string;
}

export default function PayPenalty() {
  const { user } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedPenalties, setSelectedPenalties] = useState<string[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'error'>(
    'idle'
  );
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch member and penalties
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Get member info
        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .select('id, phone, name')
          .eq('user_id', user.id)
          .single();

        if (memberError) throw memberError;

        setMember(memberData);
        setPhoneNumber(memberData.phone);

        // Get unpaid penalties
        const { data: penaltiesData, error: penaltiesError } = await supabase
          .from('penalties')
          .select('*')
          .eq('member_id', memberData.id)
          .eq('is_paid', false)
          .order('created_at', { ascending: false });

        if (penaltiesError) throw penaltiesError;

        setPenalties(penaltiesData || []);

        // Auto-select all penalties
        if (penaltiesData && penaltiesData.length > 0) {
          setSelectedPenalties(penaltiesData.map((p) => p.id));
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load penalty information');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Calculate total amount
  const totalAmount = penalties
    .filter((p) => selectedPenalties.includes(p.id))
    .reduce((sum, p) => sum + p.amount, 0);

  // Handle penalty selection
  const togglePenalty = (penaltyId: string) => {
    setSelectedPenalties((prev) =>
      prev.includes(penaltyId) ? prev.filter((id) => id !== penaltyId) : [...prev, penaltyId]
    );
  };

  // Handle select all
  const selectAll = () => {
    if (selectedPenalties.length === penalties.length) {
      setSelectedPenalties([]);
    } else {
      setSelectedPenalties(penalties.map((p) => p.id));
    }
  };

  // Handle STK Push payment
  const handleSTKPush = async () => {
    if (!member || selectedPenalties.length === 0) {
      toast.error('Please select at least one penalty to pay');
      return;
    }

    if (!phoneNumber.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    try {
      setProcessing(true);
      setPaymentStatus('pending');
      setErrorMessage('');

      const result = await initiatePenaltySTKPush(
        member.id,
        phoneNumber,
        totalAmount,
        selectedPenalties
      );

      if (result.success) {
        setPaymentStatus('success');
        toast.success('Payment prompt sent to your phone. Please enter your M-Pesa PIN.');

        // Poll for payment status
        const checkoutRequestId = result.checkoutRequestId;
        if (checkoutRequestId) {
          pollPaymentStatus(checkoutRequestId);
        }
      } else {
        setPaymentStatus('error');
        setErrorMessage(result.error || 'Failed to initiate payment');
        toast.error(result.error || 'Failed to initiate payment');
      }
    } catch (error) {
      setPaymentStatus('error');
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  // Poll for payment status
  const pollPaymentStatus = (checkoutRequestId: string) => {
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes with 10-second intervals

    const poll = async () => {
      attempts++;

      const { data } = await supabase
        .from('penalty_payment_records')
        .select('status')
        .eq('mpesa_transaction_id', checkoutRequestId)
        .single();

      if (data?.status === 'verified') {
        setPaymentStatus('success');
        toast.success('Payment verified successfully!');
        // Refresh penalties
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else if (data?.status === 'failed' || attempts >= maxAttempts) {
        setPaymentStatus('error');
        setErrorMessage('Payment failed or timed out');
      } else {
        setTimeout(poll, 10000); // Poll every 10 seconds
      }
    };

    poll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Unable to load member information</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (penalties.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>No Penalties</CardTitle>
            <CardDescription>You have no outstanding penalties to pay</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <p className="text-center text-gray-600">Your account is in good standing!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pay Penalties</h1>
        <p className="text-gray-600 mt-2">
          You have {penalties.length} outstanding penalty/penalties to pay
        </p>
      </div>

      {/* Payment Status Alert */}
      {paymentStatus === 'success' && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Payment prompt sent successfully! Check your phone for the M-Pesa prompt.
          </AlertDescription>
        </Alert>
      )}

      {paymentStatus === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Penalties List */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Outstanding Penalties</CardTitle>
                  <CardDescription>Select penalties to pay</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAll}
                >
                  {selectedPenalties.length === penalties.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {penalties.map((penalty) => (
                <div
                  key={penalty.id}
                  className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => togglePenalty(penalty.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedPenalties.includes(penalty.id)}
                    onChange={() => togglePenalty(penalty.id)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{penalty.reason}</p>
                    <p className="text-sm text-gray-600">
                      Created: {new Date(penalty.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">KES {penalty.amount.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Payment Summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Penalties Count */}
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-600">Penalties Selected:</span>
                <span className="font-semibold">{selectedPenalties.length}</span>
              </div>

              {/* Total Amount */}
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-600">Total Amount:</span>
                <span className="text-2xl font-bold text-primary">
                  KES {totalAmount.toLocaleString()}
                </span>
              </div>

              {/* Phone Number Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">M-Pesa Phone Number</label>
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <Input
                    type="tel"
                    placeholder="0712345678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={processing}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Format: 0712345678 or +254712345678
                </p>
              </div>

              {/* Payment Method Info */}
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Payment Method:</strong> M-Pesa STK Push
                </p>
                <p className="text-xs text-blue-800 mt-1">
                  You will receive a payment prompt on your phone. Enter your M-Pesa PIN to
                  complete the payment.
                </p>
              </div>

              {/* Pay Button */}
              <Button
                onClick={handleSTKPush}
                disabled={processing || selectedPenalties.length === 0 || totalAmount === 0}
                className="w-full"
                size="lg"
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Pay KES ${totalAmount.toLocaleString()}`
                )}
              </Button>

              {/* Info Box */}
              <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600 space-y-1">
                <p>✓ Secure M-Pesa payment</p>
                <p>✓ Instant verification</p>
                <p>✓ Receipt will be sent to your email</p>
              </div>
            </CardContent>
          </Card>

          {/* Member Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Member Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <p className="text-gray-600">Name</p>
                <p className="font-medium">{member.name}</p>
              </div>
              <div>
                <p className="text-gray-600">Phone</p>
                <p className="font-medium">{member.phone}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
