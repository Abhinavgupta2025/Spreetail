import React, { useEffect } from 'react';
import type { GroupMemberDetails } from '../../types';

interface SplitEditorProps {
  members: GroupMemberDetails[];
  splitType: 'equal' | 'unequal' | 'percentage' | 'share';
  totalAmount: number;
  participants: string[];
  rawValues: Record<string, number>;
  onChange: (participants: string[], rawValues: Record<string, number>) => void;
}

export const SplitEditor: React.FC<SplitEditorProps> = ({
  members,
  splitType,
  totalAmount,
  participants,
  rawValues,
  onChange,
}) => {
  // Select/unselect a member
  const handleToggleParticipant = (userId: string) => {
    let newParticipants = [...participants];
    const index = newParticipants.indexOf(userId);

    if (index > -1) {
      // Remove
      newParticipants.splice(index, 1);
    } else {
      // Add
      newParticipants.push(userId);
    }

    // Clean up raw value for unselected member
    const newRawValues = { ...rawValues };
    if (index > -1) {
      delete newRawValues[userId];
    } else {
      // Set default value based on split type
      if (splitType === 'equal') {
        newRawValues[userId] = 0;
      } else if (splitType === 'percentage') {
        newRawValues[userId] = Math.round((100 / newParticipants.length) * 100) / 100;
      } else if (splitType === 'share') {
        newRawValues[userId] = 1;
      } else if (splitType === 'unequal') {
        newRawValues[userId] = Math.round((totalAmount / newParticipants.length) * 100) / 100;
      }
    }

    onChange(newParticipants, newRawValues);
  };

  const handleRawValueChange = (userId: string, val: number) => {
    const newRawValues = {
      ...rawValues,
      [userId]: val,
    };
    onChange(participants, newRawValues);
  };

  // Adjust default percentages/shares when participants list changes
  useEffect(() => {
    if (participants.length === 0) {
      // Enforce selecting all by default if empty
      const allIds = members.map((m) => m.id);
      const defaults: Record<string, number> = {};
      allIds.forEach((id) => {
        if (splitType === 'share') defaults[id] = 1;
        else if (splitType === 'percentage') defaults[id] = Math.round((100 / allIds.length) * 100) / 100;
        else if (splitType === 'unequal') defaults[id] = Math.round((totalAmount / allIds.length) * 100) / 100;
        else defaults[id] = 0;
      });
      onChange(allIds, defaults);
    }
  }, [splitType, members, onChange]);

  // Validation display messages
  const getValidationWarning = () => {
    if (participants.length === 0) return 'Please select at least one participant';

    if (splitType === 'unequal') {
      const sum = participants.reduce((acc, id) => acc + (rawValues[id] || 0), 0);
      const diff = totalAmount - sum;
      if (Math.abs(diff) > 0.01) {
        return `Amounts sum to ₹${sum.toFixed(2)}. Remaining: ₹${diff.toFixed(2)}`;
      }
    }

    if (splitType === 'percentage') {
      const sum = participants.reduce((acc, id) => acc + (rawValues[id] || 0), 0);
      const diff = 100 - sum;
      if (Math.abs(diff) > 0.01) {
        return `Percentages sum to ${sum.toFixed(2)}%. Remaining: ${diff.toFixed(2)}%`;
      }
    }

    if (splitType === 'share') {
      const sum = participants.reduce((acc, id) => acc + (rawValues[id] || 0), 0);
      if (sum <= 0) {
        return 'Total shares must be greater than zero';
      }
    }

    return null;
  };

  const warning = getValidationWarning();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-heading)' }}>
        Split Details ({splitType.toUpperCase()})
      </span>

      {/* Participants Checkbox List */}
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '0.5rem 0.75rem',
          backgroundColor: 'var(--bg-main)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          maxHeight: '180px',
          overflowY: 'auto',
        }}
      >
        {members.map((member) => {
          const isSelected = participants.includes(member.id);
          const currentVal = rawValues[member.id] || 0;

          return (
            <div
              key={member.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.25rem 0',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggleParticipant(member.id)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                />
                <span>{member.name}</span>
              </label>

              {/* Dynamic input field depending on SplitType */}
              {isSelected && splitType !== 'equal' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  {splitType === 'unequal' && <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>₹</span>}
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={currentVal || ''}
                    onChange={(e) => handleRawValueChange(member.id, parseFloat(e.target.value) || 0)}
                    style={{
                      width: '80px',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.875rem',
                      textAlign: 'right',
                    }}
                  />
                  {splitType === 'percentage' && <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>%</span>}
                  {splitType === 'share' && <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>share(s)</span>}
                </div>
              )}

              {isSelected && splitType === 'equal' && (
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  ₹{(totalAmount / participants.length || 0).toFixed(2)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Validation warning */}
      {warning && (
        <div style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span>⚠️</span> <span>{warning}</span>
        </div>
      )}
    </div>
  );
};

export default SplitEditor;
