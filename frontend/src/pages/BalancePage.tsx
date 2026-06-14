import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { useAuth } from '../hooks/useAuth';
import { useBalances } from '../hooks/useBalances';
import {
  Wallet,
  CheckCircle2,
  Landmark,
} from 'lucide-react';
import Spinner from '../components/shared/Spinner';
import Modal from '../components/shared/Modal';
import Toast from '../components/shared/Toast';
import Avatar from '../components/shared/Avatar';

const loadRazorpayScript = () => {
  return new Promise<boolean>((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const BalancePage: React.FC = () => {
  const { user } = useAuth();
  const { groups, fetchGroups, createRazorpayOrder, verifyRazorpayPayment } = useStore();
  const {
    userBalanceSummary,
    fetchUserBalanceSummary,
    recordSettlement,
  } = useBalances();

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);


  const [filter, setFilter] = useState<'all' | 'owes' | 'owedBy'>('all');
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  
  // Settle Form Fields
  const [settleGroupId, setSettleGroupId] = useState('');
  const [settleTo, setSettleTo] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNote, setSettleNote] = useState('Settling debt');
  
  // Notification Toast
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    fetchGroups();
    fetchUserBalanceSummary();
  }, [fetchGroups, fetchUserBalanceSummary]);

  // Handle Recording Settlement
  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleGroupId || !settleTo || !settleAmount) return;

    const amount = parseFloat(settleAmount);
    if (isNaN(amount) || amount <= 0) {
      setToastMsg('Please enter a valid amount');
      return;
    }

    try {
      await recordSettlement(settleGroupId, {
        paidTo: settleTo,
        amount,
        note: settleNote.trim(),
      });

      setSettleGroupId('');
      setSettleTo('');
      setSettleAmount('');
      setSettleNote('Settling debt');
      setIsSettleOpen(false);
      setToastMsg('Payment recorded successfully!');
    } catch (err: any) {
      setToastMsg(err.response?.data?.error || 'Failed to record settlement');
    }
  };

  const handleRazorpaySettle = async () => {
    if (!settleGroupId || !settleTo || !settleAmount) return;

    const amount = parseFloat(settleAmount);
    if (isNaN(amount) || amount <= 0) {
      setToastMsg('Please enter a valid amount');
      return;
    }

    setIsProcessingPayment(true);

    try {
      // 1. Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setToastMsg('Failed to load Razorpay SDK. Check your internet connection.');
        setIsProcessingPayment(false);
        return;
      }

      // 2. Create Order in backend
      const order = await createRazorpayOrder(settleGroupId, amount);

      // Find recipient details
      const selectedGroup = groups.find((g) => g.id === settleGroupId);
      const recipient = selectedGroup?.members?.find((m) => m.id === settleTo);

      // 3. Configure Razorpay checkout options
      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Splitwise Clone',
        description: `Settle debt to ${recipient?.name || 'Group Member'}`,
        order_id: order.orderId,
        handler: async (response: any) => {
          try {
            // 4. Verify payment in backend
            await verifyRazorpayPayment(settleGroupId, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              paidTo: settleTo,
              amount,
              note: settleNote.trim() || 'Settled via Razorpay',
            });

            setSettleGroupId('');
            setSettleTo('');
            setSettleAmount('');
            setSettleNote('Settling debt');
            setIsSettleOpen(false);
            setToastMsg('Payment completed and recorded successfully!');
          } catch (err: any) {
            setToastMsg(err.response?.data?.error || 'Payment verification failed');
          } finally {
            setIsProcessingPayment(false);
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },
        theme: {
          color: '#1cc5a1', // Match our Stitch brand teal!
        },
        modal: {
          ondismiss: () => {
            setIsProcessingPayment(false);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      setToastMsg(err.response?.data?.error || 'Failed to initialize payment');
      setIsProcessingPayment(false);
    }
  };


  // Get list of group members when a group is selected for settlement
  const getSelectedGroupMembers = () => {
    const selectedGroup = groups.find((g) => g.id === settleGroupId);
    return selectedGroup?.members || [];
  };

  if (!userBalanceSummary) {
    return <Spinner fullPage />;
  }

  const netBal = userBalanceSummary.netBalance;
  const owe = userBalanceSummary.totalOwe;
  const owed = userBalanceSummary.totalOwedToUs;

  // Compile list of all debt lines across all groups
  const allOwesLines: { groupId: string; groupName: string; userId: string; name: string; amount: number }[] = [];
  const allOwedByLines: { groupId: string; groupName: string; userId: string; name: string; amount: number }[] = [];

  userBalanceSummary.groupBalances.forEach((gb) => {
    gb.owes.forEach((o) => {
      allOwesLines.push({
        groupId: gb.groupId,
        groupName: gb.groupName,
        userId: o.userId,
        name: o.name,
        amount: o.amount,
      });
    });

    gb.owedBy.forEach((ob) => {
      allOwedByLines.push({
        groupId: gb.groupId,
        groupName: gb.groupName,
        userId: ob.userId,
        name: ob.name,
        amount: ob.amount,
      });
    });
  });

  const showSettleUpForDebt = (groupId: string, toUserId: string, amount: number) => {
    setSettleGroupId(groupId);
    setSettleTo(toUserId);
    setSettleAmount(amount.toString());
    setIsSettleOpen(true);
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%', paddingBottom: '4rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
        }}
      >
        <div style={{ textAlign: 'left' }}>
          <h1 style={{ fontSize: '2rem', margin: 0 }}>Balances & Settlements</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
            Check who owes you and settle your pending debts.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsSettleOpen(true)}>
          <Wallet size={16} />
          <span>Settle Up</span>
        </button>
      </div>

      {/* Net Balance Panel */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginBottom: '2rem',
          textAlign: 'left',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
          <Landmark size={18} />
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Overall Ledger Balance</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2
              style={{
                fontSize: '2.25rem',
                fontWeight: 800,
                color: netBal === 0 ? 'var(--text-heading)' : netBal > 0 ? 'var(--primary)' : 'var(--danger)',
                margin: 0,
              }}
            >
              {netBal >= 0 ? `+₹${netBal.toFixed(2)}` : `-₹${Math.abs(netBal).toFixed(2)}`}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              {netBal === 0
                ? 'All debts are fully settled!'
                : netBal > 0
                ? `You are owed a net total of ₹${netBal.toFixed(2)}`
                : `You owe a net total of ₹${Math.abs(netBal).toFixed(2)}`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', textAlign: 'right' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>You owe</span>
              <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '1.25rem' }}>
                ₹{owe.toFixed(2)}
              </span>
            </div>
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '1.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>You are owed</span>
              <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.25rem' }}>
                ₹{owed.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <button
          className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('all')}
          style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
        >
          All ({allOwesLines.length + allOwedByLines.length})
        </button>
        <button
          className={`btn ${filter === 'owes' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('owes')}
          style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
        >
          You Owe ({allOwesLines.length})
        </button>
        <button
          className={`btn ${filter === 'owedBy' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('owedBy')}
          style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
        >
          You Are Owed ({allOwedByLines.length})
        </button>
      </div>

      {/* Balance Details List */}
      <div className="card" style={{ border: '1px solid var(--border)', textAlign: 'left' }}>
        {filter === 'all' && allOwesLines.length === 0 && allOwedByLines.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <CheckCircle2 size={40} style={{ color: 'var(--primary)' }} />
            <div>
              <p style={{ fontWeight: 600, color: 'var(--text-heading)' }}>No pending balances</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                All transaction shares and settlements are fully closed.
              </p>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {/* You Owe Section */}
          {(filter === 'all' || filter === 'owes') &&
            allOwesLines.map((line, idx) => (
              <div
                key={`owes-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.875rem 1.25rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--danger-bg)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Avatar name={line.name || 'Unknown'} size="sm" />
                  <div>
                    <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-heading)' }}>
                      You owe {line.name || 'Unknown'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                      Group: <strong>{line.groupName}</strong>
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--danger)' }}>
                    ₹{line.amount.toFixed(2)}
                  </span>
                  <button
                    className="btn btn-primary"
                    onClick={() => showSettleUpForDebt(line.groupId, line.userId, line.amount)}
                    style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}
                  >
                    Settle
                  </button>
                </div>
              </div>
            ))}

          {/* You Are Owed Section */}
          {(filter === 'all' || filter === 'owedBy') &&
            allOwedByLines.map((line, idx) => (
              <div
                key={`owedBy-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.875rem 1.25rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--success-bg)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Avatar name={line.name || 'Unknown'} size="sm" />
                  <div>
                    <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-heading)' }}>
                      {line.name || 'Unknown'} owes you
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                      Group: <strong>{line.groupName}</strong>
                    </span>
                  </div>
                </div>

                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)' }}>
                  ₹{line.amount.toFixed(2)}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Settle Up Modal */}
      <Modal isOpen={isSettleOpen} onClose={() => setIsSettleOpen(false)} title="Record a Settlement">
        <form onSubmit={handleSettleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Select Group</label>
            <select
              className="form-input"
              value={settleGroupId}
              onChange={(e) => {
                setSettleGroupId(e.target.value);
                setSettleTo('');
              }}
              required
            >
              <option value="">Select a group...</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Pay To</label>
            <select
              className="form-input"
              value={settleTo}
              onChange={(e) => setSettleTo(e.target.value)}
              disabled={!settleGroupId}
              required
            >
              <option value="">Select a member...</option>
              {getSelectedGroupMembers()
                ?.filter((m) => m.id !== user?.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Amount (₹)</label>
            <input
              type="number"
              step="any"
              className="form-input"
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Note</label>
            <input
              type="text"
              className="form-input"
              value={settleNote}
              onChange={(e) => setSettleNote(e.target.value)}
              placeholder="e.g. Settle grocery bills"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsSettleOpen(false)} disabled={isProcessingPayment}>
              Cancel
            </button>
            <button type="submit" className="btn btn-secondary" disabled={!settleGroupId || !settleTo || !settleAmount || isProcessingPayment}>
              Record Cash Settle
            </button>
            <button type="button" className="btn btn-primary" onClick={handleRazorpaySettle} disabled={!settleGroupId || !settleTo || !settleAmount || isProcessingPayment}>
              {isProcessingPayment ? 'Processing...' : 'Pay via Razorpay'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Toasts */}
      {toastMsg && (
        <Toast message={toastMsg} type={toastMsg.includes('Failed') ? 'error' : 'success'} onClose={() => setToastMsg('')} />
      )}
    </div>
  );
};

export default BalancePage;
