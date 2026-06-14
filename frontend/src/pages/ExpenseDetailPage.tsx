import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import {
  ArrowLeft,
  Receipt,
  MessageSquare,
  Send,
  Calendar,
  Layers,
  DollarSign,
} from 'lucide-react';
import Spinner from '../components/shared/Spinner';
import Avatar from '../components/shared/Avatar';

export const ExpenseDetailPage: React.FC = () => {
  const { id: expenseId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const {
    currentExpense,
    fetchExpenseDetails,
    loadingExpenses,
    messages,
    fetchMessages,
  } = useStore();

  const { sendMessage } = useSocket(expenseId);
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load details and messages on mount
  useEffect(() => {
    if (expenseId) {
      fetchExpenseDetails(expenseId);
      fetchMessages(expenseId);
    }
  }, [expenseId, fetchExpenseDetails, fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    sendMessage(chatInput);
    setChatInput('');
  };

  if (loadingExpenses && !currentExpense) {
    return <Spinner fullPage />;
  }

  if (!currentExpense) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <h3>Expense not found</h3>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ marginTop: '1rem' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', paddingBottom: '3rem' }}>
      {/* Back button */}
      <button
        className="btn btn-secondary"
        onClick={() => navigate(`/groups/${currentExpense.groupId}`)}
        style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', padding: '0.5rem 0.75rem' }}
      >
        <ArrowLeft size={16} />
        <span>Back to Group</span>
      </button>

      {/* Main Grid: Details Left, Chat Right */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: '1.5rem',
        }}
      >
        {/* Left Panel: Expense Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ border: '1px solid var(--border)', textAlign: 'left' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '1rem',
                marginBottom: '1rem',
              }}
            >
              <div
                style={{
                  backgroundColor: 'var(--primary-glow)',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-lg)',
                  color: 'var(--primary)',
                }}
              >
                <Receipt size={32} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>{currentExpense.title}</h2>
                <span
                  style={{
                    fontSize: '0.8rem',
                    backgroundColor: 'var(--border)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                  }}
                >
                  {currentExpense.category || 'General'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                <span>
                  Date: <strong>{currentExpense.date}</strong>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                <Layers size={16} style={{ color: 'var(--text-muted)' }} />
                <span>
                  Paid by: <strong>{currentExpense.payerName || 'Unknown'}</strong>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                <DollarSign size={16} style={{ color: 'var(--text-muted)' }} />
                <span>
                  Split Method: <strong>{currentExpense.splitType}</strong>
                </span>
              </div>

              <div
                style={{
                  marginTop: '1rem',
                  borderTop: '1px solid var(--border)',
                  paddingTop: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>Total Bill Amount</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                  ₹{parseFloat(currentExpense.totalAmount as any).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Splits list */}
          <div className="card" style={{ border: '1px solid var(--border)', textAlign: 'left' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Split Breakdown</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {currentExpense.splits?.map((split) => {
                const isPayer = split.userId === currentExpense.paidBy;
                return (
                  <div
                    key={split.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.75rem',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-main)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Avatar name={split.name || 'Unknown'} size="xs" />
                      <span style={{ fontSize: '0.9rem' }}>{split.name || 'Unknown'}</span>
                      {isPayer && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            padding: '0.1rem 0.35rem',
                            backgroundColor: 'var(--primary-glow)',
                            color: 'var(--primary)',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: 700,
                          }}
                        >
                          PAID
                        </span>
                      )}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                      ₹{parseFloat(split.owedAmount as any).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel: Chat Thread */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div
            className="card glass"
            style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              height: '520px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <h3
              style={{
                fontSize: '1.1rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '0.75rem',
              }}
            >
              <MessageSquare size={18} style={{ color: 'var(--primary)' }} />
              <span>Discussion Thread</span>
            </h3>

            {/* Message window */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                paddingRight: '0.25rem',
                marginBottom: '1rem',
              }}
            >
              {messages.length === 0 ? (
                <div
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.875rem',
                    textAlign: 'center',
                    padding: '3rem 1rem',
                  }}
                >
                  No messages yet. Send a message to start the discussion!
                </div>
              ) : (
                messages.map((msg) => {
                  const isSentByUs = msg.senderId === user?.id;
                  const formattedTime = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isSentByUs ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        alignSelf: isSentByUs ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          marginBottom: '0.15rem',
                          fontSize: '0.7rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {!isSentByUs && <span>{msg.senderName || 'Unknown'}</span>}
                      </div>

                      <div
                        style={{
                          padding: '0.5rem 0.875rem',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.9rem',
                          lineHeight: 1.4,
                          textAlign: 'left',
                          wordBreak: 'break-word',
                          backgroundColor: isSentByUs ? 'var(--primary)' : 'var(--border)',
                          color: isSentByUs ? '#ffffff' : 'var(--text-main)',
                          borderTopRightRadius: isSentByUs ? 0 : 'var(--radius-md)',
                          borderTopLeftRadius: isSentByUs ? 'var(--radius-md)' : 0,
                          boxShadow: 'var(--shadow-sm)',
                        }}
                      >
                        {msg.content}
                      </div>

                      <span
                        style={{
                          fontSize: '0.65rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.15rem',
                        }}
                      >
                        {formattedTime}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input field */}
            <form
              onSubmit={handleSendMessageSubmit}
              style={{
                display: 'flex',
                gap: '0.5rem',
                borderTop: '1px solid var(--border)',
                paddingTop: '0.75rem',
              }}
            >
              <input
                type="text"
                className="form-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
                style={{ borderRadius: 'var(--radius-full)' }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  padding: '0.5rem',
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--radius-full)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                disabled={!chatInput.trim()}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseDetailPage;
