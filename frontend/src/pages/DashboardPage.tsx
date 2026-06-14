import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { ArrowUpRight, ArrowDownLeft, Landmark, Users, Plus, AlertCircle } from 'lucide-react';
import Spinner from '../components/shared/Spinner';
import Modal from '../components/shared/Modal';
import Toast from '../components/shared/Toast';

export const DashboardPage: React.FC = () => {
  const {
    user,
    groups,
    userBalanceSummary,
    fetchGroups,
    fetchUserBalanceSummary,
    createGroup,
    loadingGroups,
  } = useStore();

  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    fetchGroups();
    fetchUserBalanceSummary();
  }, [fetchGroups, fetchUserBalanceSummary]);

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    try {
      const newGroup = await createGroup(groupName.trim(), groupDesc.trim());
      setGroupName('');
      setGroupDesc('');
      setIsModalOpen(false);
      setToastMsg('Group created successfully!');
      navigate(`/groups/${newGroup.id}`);
    } catch (err: any) {
      setToastMsg(err.response?.data?.error || 'Failed to create group');
    }
  };

  if (loadingGroups && groups.length === 0) {
    return <Spinner fullPage />;
  }

  // Find balance for a group
  const getGroupBalanceText = (groupId: string) => {
    if (!userBalanceSummary) return { text: 'Settled up', class: 'text-gray' };
    const groupBal = userBalanceSummary.groupBalances.find((gb) => gb.groupId === groupId);
    if (!groupBal || Math.abs(groupBal.netBalance) < 0.009) {
      return { text: 'Settled up', class: 'text-gray' };
    }
    if (groupBal.netBalance > 0) {
      return { text: `You are owed ₹${groupBal.netBalance.toFixed(2)}`, class: 'text-success' };
    }
    return { text: `You owe ₹${Math.abs(groupBal.netBalance).toFixed(2)}`, class: 'text-danger' };
  };

  const netBal = userBalanceSummary?.netBalance || 0;
  const owe = userBalanceSummary?.totalOwe || 0;
  const owed = userBalanceSummary?.totalOwedToUs || 0;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%', paddingBottom: '3rem' }}>
      {/* Dashboard Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0, textAlign: 'left' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', textAlign: 'left' }}>
            Welcome back, <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{user?.name}</span>!
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          <span>New Group</span>
        </button>
      </div>

      {/* Balance Summary Header Cards */}
      <div
        className="grid-cols-3"
        style={{
          marginBottom: '2rem',
        }}
      >
        {/* Card 1: Net Balance */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
            <Landmark size={18} />
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Total Net Balance</span>
          </div>
          <h2
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: netBal === 0 ? 'var(--text-heading)' : netBal > 0 ? 'var(--primary)' : 'var(--danger)',
              margin: 0,
            }}
          >
            {netBal >= 0 ? `+₹${netBal.toFixed(2)}` : `-₹${Math.abs(netBal).toFixed(2)}`}
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {netBal === 0 ? 'All settled up!' : netBal > 0 ? 'You are owed in net' : 'You owe in net'}
          </span>
        </div>

        {/* Card 2: You Owe */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
            <ArrowDownLeft size={18} className="text-danger" style={{ color: 'var(--danger)' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>You Owe</span>
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--danger)', margin: 0 }}>
            ₹{owe.toFixed(2)}
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total amount owed to others</span>
        </div>

        {/* Card 3: You Are Owed */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
            <ArrowUpRight size={18} className="text-success" style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>You Are Owed</span>
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
            ₹{owed.toFixed(2)}
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total amount others owe to you</span>
        </div>
      </div>

      {/* Main Groups List Section */}
      <div className="card" style={{ textAlign: 'left' }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={20} />
          <span>Active Groups ({groups.length})</span>
        </h3>

        {groups.length === 0 ? (
          <div
            style={{
              padding: '3rem 1.5rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              backgroundColor: 'var(--bg-main)',
              borderRadius: 'var(--radius-lg)',
              border: '1px dashed var(--border)',
            }}
          >
            <AlertCircle size={40} style={{ color: 'var(--text-muted)' }} />
            <div>
              <p style={{ fontWeight: 600, color: 'var(--text-heading)' }}>No groups created yet</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Create a group and invite your friends to start sharing expenses!
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={16} />
              <span>Create a Group</span>
            </button>
          </div>
        ) : (
          <div className="grid-cols-2">
            {groups.map((group) => {
              const balInfo = getGroupBalanceText(group.id);
              return (
                <div
                  key={group.id}
                  className="card"
                  onClick={() => navigate(`/groups/${group.id}`)}
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    border: '1px solid var(--border)',
                    padding: '1.25rem',
                  }}
                >
                  <div>
                    <h4
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        marginBottom: '0.25rem',
                        color: 'var(--text-heading)',
                      }}
                    >
                      {group.name}
                    </h4>
                    {group.description && (
                      <p
                        style={{
                          fontSize: '0.875rem',
                          color: 'var(--text-muted)',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {group.description}
                      </p>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid var(--border)',
                      paddingTop: '0.75rem',
                      fontSize: '0.875rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)' }}>Status</span>
                    <span
                      style={{
                        fontWeight: 600,
                        color:
                          balInfo.class === 'text-success'
                            ? 'var(--primary)'
                            : balInfo.class === 'text-danger'
                            ? 'var(--danger)'
                            : 'var(--text-muted)',
                      }}
                    >
                      {balInfo.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Group">
        <form onSubmit={handleCreateGroupSubmit}>
          <div className="form-group">
            <label className="form-label">Group Name</label>
            <input
              type="text"
              className="form-input"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Ski Trip 2026, Groceries"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description (Optional)</label>
            <input
              type="text"
              className="form-input"
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
              placeholder="e.g. Shared costs for vacation lodgings and dinners"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!groupName.trim()}>
              Create Group
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

export default DashboardPage;
