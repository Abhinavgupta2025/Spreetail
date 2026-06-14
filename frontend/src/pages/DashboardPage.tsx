import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { ArrowUpRight, ArrowDownLeft, Landmark, Users, Plus, AlertCircle } from 'lucide-react';
import Spinner from '../components/shared/Spinner';
import Modal from '../components/shared/Modal';
import Toast from '../components/shared/Toast';

export const DashboardPage: React.FC = () => {
  const {
    isAuthenticated,
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
    if (isAuthenticated) {
      fetchGroups();
      fetchUserBalanceSummary();
      
      const queryParams = new URLSearchParams(window.location.search);
      if (queryParams.get('action') === 'create-group') {
        setIsModalOpen(true);
        // Clear query parameters from URL without page reload
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [isAuthenticated, fetchGroups, fetchUserBalanceSummary]);

  // Unauthenticated landing page view
  if (!isAuthenticated) {
    return (
      <div className="landing-page" style={{ width: '100%', minHeight: '100vh', backgroundColor: 'var(--bg-main)', display: 'flex', flexDirection: 'column' }}>
        {/* Landing Navbar */}
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 2rem',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-card)',
          backdropFilter: 'blur(10px)',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: 'white',
              fontSize: '1.2rem'
            }}>S</div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-0.02em' }}>
              Spreetail Splitwise
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={() => navigate('/login')}>Login</button>
            <button className="btn btn-primary" onClick={() => navigate('/register')}>Sign Up</button>
          </div>
        </header>

        {/* Hero Section */}
        <section style={{
          padding: '5rem 2rem',
          textAlign: 'center',
          maxWidth: '900px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '99px',
            backgroundColor: 'rgba(0, 168, 150, 0.1)',
            border: '1px solid rgba(0, 168, 150, 0.2)',
            color: 'var(--primary)',
            fontSize: '0.875rem',
            fontWeight: 600
          }}>
            ✨ Premium Roommate Split Ledger
          </div>
          <h1 style={{
            fontSize: '3.5rem',
            fontWeight: 800,
            lineHeight: 1.15,
            color: 'var(--text-heading)',
            letterSpacing: '-0.03em',
            margin: 0
          }}>
            Split Bills. Settle Debts.<br/>
            <span style={{
              background: 'linear-gradient(135deg, var(--primary) 0%, #00b4d8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>Keep the Peace.</span>
          </h1>
          <p style={{
            fontSize: '1.2rem',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            maxWidth: '650px',
            margin: '0.5rem 0 1.5rem 0'
          }}>
            The easiest way to track and divide household bills, travel costs, and shared expenses. Get simplified net balances, real-time expense chat discussions, and Razorpay settlements.
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-primary btn-lg" style={{ padding: '0.875rem 2rem', fontSize: '1.05rem' }} onClick={() => navigate('/register')}>
              Get Started for Free
            </button>
            <button className="btn btn-secondary btn-lg" style={{ padding: '0.875rem 2rem', fontSize: '1.05rem' }} onClick={() => navigate('/login')}>
              Sign In
            </button>
          </div>
        </section>

        {/* Features Grid */}
        <section style={{
          padding: '4rem 2rem',
          maxWidth: '1100px',
          margin: '0 auto',
          width: '100%'
        }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, textAlign: 'center', marginBottom: '3rem', color: 'var(--text-heading)' }}>
            Engineered for Stress-Free Splitting
          </h2>
          <div className="grid-cols-3" style={{ gap: '1.5rem' }}>
            {/* Feature 1 */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left', padding: '1.75rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(0, 168, 150, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)'
              }}>
                <Users size={20} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-heading)' }}>Dynamic Roster Splitting</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', margin: 0, lineHeight: 1.5 }}>
                Split unequally, by percentages, or arbitrary shares. Handle dynamic roommates moving in/out with historical balance integrity.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left', padding: '1.75rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(0, 168, 150, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)'
              }}>
                <ArrowUpRight size={20} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-heading)' }}>Smart CSV Ingestion</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', margin: 0, lineHeight: 1.5 }}>
                Drop a spreadsheet export and instantly identify duplicate entries, negative refunds, USD-to-INR conversions, and guest re-attributions.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left', padding: '1.75rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(0, 168, 150, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)'
              }}>
                <Landmark size={20} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-heading)' }}>Razorpay Checkout</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', margin: 0, lineHeight: 1.5 }}>
                Settle up directly on the dashboard. Generates instant payment orders and verifies signatures to reconcile balances to zero.
              </p>
            </div>
          </div>
        </section>

        {/* Demo Action Area */}
        <section style={{
          padding: '4rem 2rem 6rem 2rem',
          maxWidth: '700px',
          margin: '0 auto',
          textAlign: 'center'
        }}>
          <div className="card" style={{
            padding: '2.5rem',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem'
          }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Ready to create a group?</h3>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>
              Create a group now to track rent, bills, and utilities. You will be prompted to login or create an account to save it.
            </p>
            <button className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }} onClick={() => navigate('/login?redirect=create-group')}>
              <Plus size={16} />
              <span>Create a Group</span>
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer style={{
          padding: '2rem',
          borderTop: '1px solid var(--border)',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.875rem',
          marginTop: 'auto',
          backgroundColor: 'var(--bg-card)'
        }}>
          © 2026 Spreetail Splitwise Clone Assignment. All rights reserved.
        </footer>
      </div>
    );
  }

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
