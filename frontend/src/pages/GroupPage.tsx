import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useAuth } from '../hooks/useAuth';
import { useBalances } from '../hooks/useBalances';
import {
  Users,
  Plus,
  Trash2,
  Settings,
  Mail,
  UserMinus,
  ArrowRight,
  MessageSquare,
  AlertTriangle,
  Receipt,
  PiggyBank,
  FileText,
} from 'lucide-react';
import Spinner from '../components/shared/Spinner';
import Modal from '../components/shared/Modal';
import Toast from '../components/shared/Toast';
import Avatar from '../components/shared/Avatar';
import SplitEditor from '../components/expenses/SplitEditor';

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

export const GroupPage: React.FC = () => {
  const { id: groupId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const {
    currentGroup,
    fetchGroupDetails,
    addMember,
    removeMember,
    deleteGroup,
    loadingGroups,
    errorGroups,
    expenses,
    fetchExpenses,
    createExpense,
    deleteExpense,
    loadingExpenses,
    createRazorpayOrder,
    verifyRazorpayPayment,
  } = useStore();

  const {
    groupBalances,
    fetchBalances,
    recordSettlement,
    loading: loadingBalances,
  } = useBalances();

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);


  // Tabs
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'members'>('expenses');

  // Modal States
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Form Fields
  const [inviteEmail, setInviteEmail] = useState('');
  
  // Expense Form
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expPayer, setExpPayer] = useState('');
  const [expSplitType, setExpSplitType] = useState<'equal' | 'unequal' | 'percentage' | 'share'>('equal');
  const [expDate, setExpDate] = useState(new Date().toISOString().substring(0, 10));
  const [expCategory, setExpCategory] = useState('General');
  const [expParticipants, setExpParticipants] = useState<string[]>([]);
  const [expRawValues, setExpRawValues] = useState<Record<string, number>>({});

  // Settle Form
  const [settleTo, setSettleTo] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNote, setSettleNote] = useState('Settled up');

  // Notifications
  const [toastMsg, setToastMsg] = useState('');

  // Initial Load
  useEffect(() => {
    if (groupId) {
      fetchGroupDetails(groupId);
      fetchExpenses(groupId);
      fetchBalances(groupId);
    }
  }, [groupId, fetchGroupDetails, fetchExpenses, fetchBalances]);

  // Load fields for forms
  useEffect(() => {
    if (currentGroup) {
      if (currentGroup.members && currentGroup.members.length > 0) {
        // Default paidBy to current user
        setExpPayer(user?.id || currentGroup.members[0].id);
        setExpParticipants(currentGroup.members.map((m) => m.id));
      }
    }
  }, [currentGroup, user]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !groupId) return;

    try {
      await addMember(groupId, inviteEmail.trim().toLowerCase());
      setInviteEmail('');
      setIsInviteOpen(false);
      setToastMsg('Member added successfully!');
    } catch (err: any) {
      setToastMsg(err.response?.data?.error || 'Failed to add member');
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId) return;

    const amount = parseFloat(expAmount);
    if (isNaN(amount) || amount <= 0) {
      setToastMsg('Please enter a valid amount');
      return;
    }

    if (expParticipants.length === 0) {
      setToastMsg('Please select at least one participant');
      return;
    }

    try {
      await createExpense(groupId, {
        title: expTitle.trim(),
        totalAmount: amount,
        paidBy: expPayer,
        splitType: expSplitType,
        date: expDate,
        category: expCategory,
        participants: expParticipants,
        rawValues: expRawValues,
      });

      // Reset
      setExpTitle('');
      setExpAmount('');
      setExpSplitType('equal');
      setExpRawValues({});
      setIsExpenseOpen(false);
      setToastMsg('Expense added successfully!');
    } catch (err: any) {
      setToastMsg(err.response?.data?.error || 'Failed to add expense');
    }
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !settleTo || !settleAmount) return;

    const amount = parseFloat(settleAmount);
    if (isNaN(amount) || amount <= 0) {
      setToastMsg('Please enter a valid amount');
      return;
    }

    try {
      await recordSettlement(groupId, {
        paidTo: settleTo,
        amount,
        note: settleNote.trim(),
      });

      setSettleTo('');
      setSettleAmount('');
      setSettleNote('Settled up');
      setIsSettleOpen(false);
      setToastMsg('Payment recorded successfully!');
    } catch (err: any) {
      setToastMsg(err.response?.data?.error || 'Failed to record settlement');
    }
  };

  const handleRazorpaySettle = async () => {
    if (!groupId || !settleTo || !settleAmount) return;

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
      const order = await createRazorpayOrder(groupId, amount);

      // Find recipient details
      const recipient = currentGroup?.members?.find((m) => m.id === settleTo);

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
            await verifyRazorpayPayment(groupId, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              paidTo: settleTo,
              amount,
              note: settleNote.trim() || 'Settled via Razorpay',
            });

            setSettleTo('');
            setSettleAmount('');
            setSettleNote('Settled up');
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


  const handleRemoveMember = async (userId: string) => {
    if (!groupId) return;
    if (!window.confirm('Are you sure you want to remove this member?')) return;

    try {
      await removeMember(groupId, userId);
      setToastMsg('Member removed successfully!');
    } catch (err: any) {
      setToastMsg(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupId) return;
    if (
      !window.confirm(
        'Are you sure you want to delete this group? This action is permanent and deletes all expenses.'
      )
    ) {
      return;
    }

    try {
      await deleteGroup(groupId);
      setToastMsg('Group deleted successfully!');
      navigate('/dashboard');
    } catch (err: any) {
      setToastMsg(err.response?.data?.error || 'Failed to delete group');
    }
  };

  const openSettleModalWithDetails = (creditorId: string, amount: number) => {
    setSettleTo(creditorId);
    setSettleAmount(amount.toString());
    setIsSettleOpen(true);
  };

  if (loadingGroups && !currentGroup) {
    return <Spinner fullPage />;
  }

  if (errorGroups && !currentGroup) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <AlertTriangle size={48} style={{ color: 'var(--danger)', marginBottom: '1rem' }} />
        <h3>Error loading group details</h3>
        <p style={{ color: 'var(--text-muted)' }}>{errorGroups}</p>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ marginTop: '1rem' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!currentGroup) return null;

  const isAdmin = currentGroup.currentUserRole === 'admin';

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%', paddingBottom: '4rem' }}>
      {/* Group Header Info */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginBottom: '2rem',
          textAlign: 'left',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: 0 }}>{currentGroup.name}</h1>
            {currentGroup.description && (
              <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>{currentGroup.description}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => navigate(`/groups/${currentGroup.id}/import`)}>
              <FileText size={16} />
              <span>Import CSV</span>
            </button>
            <button className="btn btn-secondary" onClick={() => setIsInviteOpen(true)}>
              <Mail size={16} />
              <span>Invite</span>
            </button>
            <button className="btn btn-primary" onClick={() => setIsExpenseOpen(true)}>
              <Plus size={16} />
              <span>Add Expense</span>
            </button>
            {isAdmin && (
              <button
                className="btn btn-secondary"
                onClick={() => setIsSettingsOpen(true)}
                style={{ padding: '0.625rem' }}
              >
                <Settings size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Info badges */}
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          <span>
            Members: <strong>{currentGroup.members?.length || 0}</strong>
          </span>
          <span>•</span>
          <span>
            Role: <strong>{currentGroup.currentUserRole}</strong>
          </span>
        </div>
      </div>

      {/* Tabs Menu */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          marginBottom: '1.5rem',
          fontSize: '0.95rem',
        }}
      >
        <button
          onClick={() => setActiveTab('expenses')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'expenses' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'expenses' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'expenses' ? 600 : 500,
            cursor: 'pointer',
            transition: 'var(--transition)',
          }}
        >
          Expenses
        </button>
        <button
          onClick={() => setActiveTab('balances')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'balances' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'balances' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'balances' ? 600 : 500,
            cursor: 'pointer',
            transition: 'var(--transition)',
          }}
        >
          Balances & Settlements
        </button>
        <button
          onClick={() => setActiveTab('members')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'members' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'members' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'members' ? 600 : 500,
            cursor: 'pointer',
            transition: 'var(--transition)',
          }}
        >
          Group Members
        </button>
      </div>

      {/* TABS CONTENT */}

      {/* 1. EXPENSES TAB */}
      {activeTab === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
          {loadingExpenses && expenses.length === 0 ? (
            <Spinner />
          ) : expenses.length === 0 ? (
            <div
              className="card"
              style={{
                textAlign: 'center',
                padding: '3rem',
                border: '1px dashed var(--border)',
                backgroundColor: 'var(--bg-card)',
              }}
            >
              <Receipt size={36} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
              <p style={{ fontWeight: 600, color: 'var(--text-heading)' }}>No expenses recorded yet</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                All splits are currently settled. Add a new bill to start.
              </p>
              <button className="btn btn-primary" onClick={() => setIsExpenseOpen(true)}>
                Add First Expense
              </button>
            </div>
          ) : (
            expenses.map((expense) => {
              const isCreatorOrAdmin = expense.createdBy === user?.id || isAdmin;
              return (
                <div
                  key={expense.id}
                  className="card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem 1.25rem',
                    cursor: 'pointer',
                    border: '1px solid var(--border)',
                  }}
                  onClick={() => navigate(`/expenses/${expense.id}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        padding: '0.5rem',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--primary)',
                      }}
                    >
                      <Receipt size={24} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-heading)' }}>
                        {expense.title}
                      </h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Paid by <strong>{expense.payerName || 'Unknown'}</strong> on {expense.date} • Created by{' '}
                        {expense.creatorName || 'Unknown'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                        ₹{parseFloat(expense.totalAmount as any).toFixed(2)}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
                        Split: {expense.splitType}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/expenses/${expense.id}`);
                        }}
                        style={{ padding: '0.5rem' }}
                      >
                        <MessageSquare size={16} />
                      </button>

                      {isCreatorOrAdmin && (
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.5rem' }}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm('Delete this expense? This cannot be undone.')) {
                              try {
                                await deleteExpense(expense.id);
                                setToastMsg('Expense deleted successfully!');
                              } catch (err: any) {
                                setToastMsg(err.response?.data?.error || 'Failed to delete expense');
                              }
                            }
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 2. BALANCES TAB */}
      {activeTab === 'balances' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
          <div className="card" style={{ border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PiggyBank size={18} style={{ color: 'var(--primary)' }} />
              <span>Simplified Debts</span>
            </h3>

            {loadingBalances ? (
              <Spinner />
            ) : groupBalances.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
                🎉 Everyone is settled up! No transactions needed.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {groupBalances.map((bal, idx) => {
                  const weOwe = bal.fromUserId === user?.id;
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: weOwe ? 'var(--danger-bg)' : 'var(--success-bg)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Avatar name={bal.fromUser.name || 'Unknown'} url={bal.fromUser.avatarUrl} size="sm" />
                        <span style={{ fontSize: '0.9375rem' }}>
                          <strong>{bal.fromUser.name || 'Unknown'}</strong> owes <strong>{bal.toUser.name || 'Unknown'}</strong>
                        </span>
                        <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                        <span
                          style={{
                            fontWeight: 700,
                            color: weOwe ? 'var(--danger)' : 'var(--primary)',
                            fontSize: '1.05rem',
                          }}
                        >
                          ₹{bal.amount.toFixed(2)}
                        </span>
                      </div>

                      {weOwe && (
                        <button
                          className="btn btn-primary"
                          onClick={() => openSettleModalWithDetails(bal.toUserId, bal.amount)}
                          style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
                        >
                          Settle up
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. MEMBERS TAB */}
      {activeTab === 'members' && (
        <div className="card" style={{ border: '1px solid var(--border)', textAlign: 'left' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
            }}
          >
            <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={18} />
              <span>Roster ({currentGroup.members?.length || 0})</span>
            </h3>
            <button className="btn btn-secondary" onClick={() => setIsInviteOpen(true)}>
              <Plus size={16} />
              <span>Add Member</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {currentGroup.members?.map((member) => {
              const isMemberAdmin = member.role === 'admin';
              const canRemove = isAdmin && member.id !== user?.id;

              return (
                <div
                  key={member.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.625rem 0.875rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-main)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Avatar name={member.name} url={member.avatarUrl} size="sm" />
                    <div>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: '0.9375rem',
                          color: 'var(--text-heading)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                        }}
                      >
                        {member.name}
                        {isMemberAdmin && (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              padding: '0.1rem 0.35rem',
                              backgroundColor: 'var(--primary)',
                              color: '#ffffff',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 700,
                            }}
                          >
                            ADMIN
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                        {member.email}
                      </span>
                    </div>
                  </div>

                  {canRemove && (
                    <button
                      className="btn btn-secondary"
                      style={{ color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}
                      onClick={() => handleRemoveMember(member.id)}
                    >
                      <UserMinus size={14} />
                      <span style={{ fontSize: '0.8rem' }}>Remove</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODALS */}

      {/* 1. Invite Modal */}
      <Modal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} title="Invite User to Group">
        <form onSubmit={handleInviteSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="e.g. friend@example.com"
              required
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsInviteOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!inviteEmail.trim()}>
              Invite Member
            </button>
          </div>
        </form>
      </Modal>

      {/* 2. Settle Up Modal */}
      <Modal isOpen={isSettleOpen} onClose={() => setIsSettleOpen(false)} title="Record a Payment">
        <form onSubmit={handleSettleSubmit}>
          <div className="form-group">
            <label className="form-label">Pay To</label>
            <select
              className="form-input"
              value={settleTo}
              onChange={(e) => setSettleTo(e.target.value)}
              required
            >
              <option value="">Select a member...</option>
              {currentGroup.members
                ?.filter((m) => m.id !== user?.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="form-group">
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

          <div className="form-group">
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
            <button type="submit" className="btn btn-secondary" disabled={!settleTo || !settleAmount || isProcessingPayment}>
              Record Cash Settle
            </button>
            <button type="button" className="btn btn-primary" onClick={handleRazorpaySettle} disabled={!settleTo || !settleAmount || isProcessingPayment}>
              {isProcessingPayment ? 'Processing...' : 'Pay via Razorpay'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 3. Add Expense Modal */}
      <Modal isOpen={isExpenseOpen} onClose={() => setIsExpenseOpen(false)} title="Add New Expense">
        <form onSubmit={handleExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Description / Title</label>
            <input
              type="text"
              className="form-input"
              value={expTitle}
              onChange={(e) => setExpTitle(e.target.value)}
              placeholder="e.g. Dinner, Rent, Gas"
              required
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
            }}
          >
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Total Amount (₹)</label>
              <input
                type="number"
                step="any"
                className="form-input"
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-input"
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
            }}
          >
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Paid By</label>
              <select
                className="form-input"
                value={expPayer}
                onChange={(e) => setExpPayer(e.target.value)}
                required
              >
                {currentGroup.members?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id === user?.id ? 'You' : m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Split Method</label>
              <select
                className="form-input"
                value={expSplitType}
                onChange={(e) =>
                  setExpSplitType(e.target.value as 'equal' | 'unequal' | 'percentage' | 'share')
                }
                required
              >
                <option value="equal">Split Equally</option>
                <option value="unequal">Split Unequally (₹)</option>
                <option value="percentage">Split by Percentage (%)</option>
                <option value="share">Split by Shares</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Category</label>
            <select
              className="form-input"
              value={expCategory}
              onChange={(e) => setExpCategory(e.target.value)}
            >
              <option value="General">General</option>
              <option value="Groceries">Groceries</option>
              <option value="Food & Drinks">Food & Drinks</option>
              <option value="Housing">Housing</option>
              <option value="Transportation">Transportation</option>
              <option value="Entertainment">Entertainment</option>
            </select>
          </div>

          {/* Dynamic Weight Split Editor */}
          {currentGroup.members && (
            <SplitEditor
              members={currentGroup.members}
              splitType={expSplitType}
              totalAmount={parseFloat(expAmount) || 0}
              participants={expParticipants}
              rawValues={expRawValues}
              onChange={(parts, raws) => {
                setExpParticipants(parts);
                setExpRawValues(raws);
              }}
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsExpenseOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!expTitle.trim() || !expAmount}>
              Save Expense
            </button>
          </div>
        </form>
      </Modal>

      {/* 4. Group Settings Modal */}
      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Group Settings">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Delete Danger Section */}
          <div
            style={{
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              backgroundColor: 'var(--danger-bg)',
            }}
          >
            <h4 style={{ color: 'var(--danger)', margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <AlertTriangle size={16} /> Danger Zone
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0.75rem 0' }}>
              Deleting a group is permanent and will wipe out all expense data.
            </p>
            <button className="btn btn-danger" onClick={handleDeleteGroup} style={{ width: '100%', fontSize: '0.875rem' }}>
              Delete This Group
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setIsSettingsOpen(false)}>
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Toasts alerts */}
      {toastMsg && (
        <Toast message={toastMsg} type={toastMsg.includes('Failed') || toastMsg.includes('Cannot') ? 'error' : 'success'} onClose={() => setToastMsg('')} />
      )}
    </div>
  );
};

export default GroupPage;
