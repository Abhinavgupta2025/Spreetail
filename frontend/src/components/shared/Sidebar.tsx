import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store';
import { LayoutDashboard, Wallet, Users, Plus, Folder, X } from 'lucide-react';
import Modal from './Modal';
import Toast from './Toast';

export const Sidebar: React.FC = () => {
  const { groups, fetchGroups, createGroup, isAuthenticated, isSidebarOpen, toggleSidebar } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      fetchGroups();
    }
  }, [isAuthenticated, fetchGroups]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    try {
      const newGroup = await createGroup(groupName.trim(), groupDesc.trim());
      setGroupName('');
      setGroupDesc('');
      setIsModalOpen(false);
      setToastMsg('Group created successfully!');
      toggleSidebar(false); // Close sidebar on mobile
      navigate(`/groups/${newGroup.id}`);
    } catch (err: any) {
      setToastMsg(err.response?.data?.error || 'Failed to create group');
    }
  };

  if (!isAuthenticated) return null;

  return (
    <>
      {/* Backdrop for mobile screen overlay */}
      {isSidebarOpen && (
        <div
          onClick={() => toggleSidebar(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(3px)',
            zIndex: 998,
            transition: 'var(--transition)',
          }}
          className="sidebar-backdrop"
        />
      )}

      {/* Responsive Sidebar Drawer */}
      <div
        className={`app-sidebar ${isSidebarOpen ? 'open' : ''}`}
        style={{
          width: '260px',
          backgroundColor: 'var(--bg-sidebar)',
          color: '#f8fafc',
          height: '100vh',
          position: 'fixed',
          top: 0,
          left: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
          zIndex: 999,
          padding: '1.5rem 1rem',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Brand Header */}
        <div style={{ marginBottom: '2rem', padding: '0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ color: '#ffffff', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Folder size={20} style={{ color: 'var(--primary-container)' }} /> Workspace
          </h2>
          {/* Close button only visible on mobile */}
          <button
            className="mobile-close-btn"
            onClick={() => toggleSidebar(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'none', // Overridden in CSS media queries
              alignItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Primary Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
          <NavLink
            to="/dashboard"
            onClick={() => toggleSidebar(false)}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              color: isActive ? '#ffffff' : '#94a3b8',
              backgroundColor: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
              fontWeight: 500,
            })}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/balances"
            onClick={() => toggleSidebar(false)}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              color: isActive ? '#ffffff' : '#94a3b8',
              backgroundColor: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
              fontWeight: 500,
            })}
          >
            <Wallet size={18} />
            <span>Balances</span>
          </NavLink>
        </div>

        {/* Group List Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#64748b',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '0 0.5rem 0.5rem 0.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            marginBottom: '1rem',
          }}
        >
          <span>My Groups</span>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Create Group"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Groups List container */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {groups.length === 0 ? (
            <div style={{ color: '#64748b', padding: '1rem', fontSize: '0.875rem', textAlign: 'center' }}>
              No groups yet
            </div>
          ) : (
            groups.map((group) => {
              const isActive = location.pathname.startsWith(`/groups/${group.id}`);
              return (
                <NavLink
                  key={group.id}
                  to={`/groups/${group.id}`}
                  onClick={() => toggleSidebar(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.625rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    color: isActive ? '#ffffff' : '#94a3b8',
                    backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                    borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                    fontSize: '0.9375rem',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  <Users size={16} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {group.name}
                  </span>
                </NavLink>
              );
            })
          )}
        </div>

        {/* Create Group Modal */}
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Group">
          <form onSubmit={handleCreateGroup}>
            <div className="form-group">
              <label className="form-label">Group Name</label>
              <input
                type="text"
                className="form-input"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Apartment, Vacation"
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
                placeholder="e.g. Monthly rent and groceries"
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

        {/* Notification Toast */}
        {toastMsg && (
          <Toast message={toastMsg} type={toastMsg.includes('Failed') ? 'error' : 'success'} onClose={() => setToastMsg('')} />
        )}
      </div>
    </>
  );
};

export default Sidebar;
