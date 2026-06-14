import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { importApi } from '../api';
import {
  ArrowLeft,
  FileText,
  AlertTriangle,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import Spinner from '../components/shared/Spinner';
import Toast from '../components/shared/Toast';

interface CSVRow {
  rowIndex: number;
  date: string;
  dateRaw: string;
  description: string;
  paidByRaw: string;
  targetPayer: string;
  amount: number;
  amountRaw: string;
  currency: string;
  currencyRaw: string;
  splitType: string;
  splitTypeRaw: string;
  splitWith: string[];
  splitWithRaw: string;
  splitDetailsRaw: string;
  notes: string;
  anomalies: string[];
  isDuplicate: boolean;
  duplicateOfIndex: number;
  isSettlement: boolean;
  splits: { name: string; amount: number; rawValue?: number }[];
}

export const ImportPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { currentGroup, fetchGroupDetails, fetchExpenses, fetchBalances } = useStore();

  const [csvText, setCsvText] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [previewRows, setPreviewRows] = useState<CSVRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Record<number, boolean>>({});
  const [resolvedPayers, setResolvedPayers] = useState<Record<number, string>>({});
  
  const [loading, setLoading] = useState(false);
  const [importReport, setImportReport] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    if (groupId) {
      fetchGroupDetails(groupId);
    }
  }, [groupId, fetchGroupDetails]);

  // Handle file load
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      setFileLoading(false);
      setToastMsg('CSV File loaded. Click "Analyze CSV" to preview data.');
    };
    reader.onerror = () => {
      setToastMsg('Failed to read CSV file.');
      setFileLoading(false);
    };
    reader.readAsText(file);
  };

  // Run preview check
  const handleAnalyze = async () => {
    if (!csvText.trim() || !groupId) {
      setToastMsg('Please upload a CSV file or paste CSV text first.');
      return;
    }

    setLoading(true);
    try {
      const data = await importApi.getPreview(groupId, csvText);
      setPreviewRows(data.rows);
      
      // Select all rows by default unless they are zero-value or suspected duplicates
      const initialSelected: Record<number, boolean> = {};
      const initialPayers: Record<number, string> = {};
      
      data.rows.forEach((row: CSVRow) => {
        const hasCriticalError = row.amount === 0;
        initialSelected[row.rowIndex] = !row.isDuplicate && !hasCriticalError;
        initialPayers[row.rowIndex] = row.targetPayer || '';
      });
      
      setSelectedRows(initialSelected);
      setResolvedPayers(initialPayers);
      setToastMsg('Analysis complete. Resolve anomalies below.');
    } catch (err: any) {
      setToastMsg(err.response?.data?.error || 'Failed to analyze CSV');
    } finally {
      setLoading(false);
    }
  };

  // Toggle row selection
  const handleToggleRow = (rowIndex: number) => {
    setSelectedRows(prev => ({
      ...prev,
      [rowIndex]: !prev[rowIndex]
    }));
  };

  // Change resolved payer for a row
  const handlePayerChange = (rowIndex: number, payerName: string) => {
    setResolvedPayers(prev => ({
      ...prev,
      [rowIndex]: payerName
    }));
  };

  // Commit approved rows to database
  const handleImportCommit = async () => {
    if (!groupId) return;

    const rowsToCommit = previewRows
      .filter(row => selectedRows[row.rowIndex])
      .map(row => {
        // Overlay resolved payer if edited
        const updatedPayer = resolvedPayers[row.rowIndex] || row.targetPayer;
        
        // If splits contains the old payer name, and we normalized or resolved it, keep names aligned
        const updatedSplits = row.splits.map(s => {
          if (s.name === row.targetPayer) {
            return { ...s, name: updatedPayer };
          }
          return s;
        });

        return {
          ...row,
          targetPayer: updatedPayer,
          splits: updatedSplits
        };
      });

    if (rowsToCommit.length === 0) {
      setToastMsg('No rows selected for import.');
      return;
    }

    // Validate that all selected rows have resolved payers
    const missingPayerRow = rowsToCommit.find(row => !row.targetPayer || !row.targetPayer.trim());
    if (missingPayerRow) {
      setToastMsg(`Please select a payer for Row ${missingPayerRow.rowIndex} ("${missingPayerRow.description}") before importing.`);
      return;
    }

    setLoading(true);
    try {
      const result = await importApi.commit(groupId, rowsToCommit);
      setImportReport(result.report);
      setToastMsg('Import completed successfully!');
      
      // Refresh group data
      await fetchGroupDetails(groupId);
      await fetchExpenses(groupId);
      await fetchBalances(groupId);
    } catch (err: any) {
      setToastMsg(err.response?.data?.error || 'Failed to commit import');
    } finally {
      setLoading(false);
    }
  };

  if (!currentGroup) {
    return <Spinner fullPage />;
  }

  // Count metrics
  const totalRows = previewRows.length;
  const duplicateCount = previewRows.filter(r => r.isDuplicate).length;
  const anomalyCount = previewRows.reduce((acc, r) => acc + r.anomalies.length, 0);
  const selectedCount = Object.values(selectedRows).filter(Boolean).length;

  // Dynamically collect current group members and all unique names appearing in the CSV
  const getCandidateNames = () => {
    const namesSet = new Set<string>();
    
    // Add current group members
    if (currentGroup.members) {
      currentGroup.members.forEach(m => {
        if (m.name) namesSet.add(m.name);
      });
    }
    
    // Add all names parsed from the CSV preview rows (paid_by and split_with)
    previewRows.forEach(row => {
      if (row.paidByRaw && row.paidByRaw.trim()) {
        namesSet.add(row.targetPayer || row.paidByRaw.trim());
      }
      if (row.splitWith) {
        row.splitWith.forEach(name => {
          if (name && name.trim()) namesSet.add(name);
        });
      }
      if (row.splits) {
        row.splits.forEach(s => {
          if (s.name && s.name.trim()) namesSet.add(s.name);
        });
      }
    });
    
    return Array.from(namesSet).sort();
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', paddingBottom: '4rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button className="btn btn-secondary" onClick={() => navigate(`/groups/${groupId}`)} style={{ padding: '0.5rem' }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ textAlign: 'left' }}>
          <h1 style={{ fontSize: '2rem', margin: 0 }}>Import Expenses CSV</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
            Ingest and resolve anomalies for <strong>{currentGroup.name}</strong>.
          </p>
        </div>
      </div>

      {/* Paste / Upload Section (Only show if not imported yet) */}
      {!importReport && previewRows.length === 0 && (
        <div className="card" style={{ border: '1px solid var(--border)', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Select CSV File</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Upload the spreadsheet export `expenses_export.csv` containing raw flatmates spending records.
            </p>
          </div>

          <div
            style={{
              border: '2px dashed var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '3rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-main)',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer'
              }}
            />
            <FileText size={48} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
            <p style={{ fontWeight: 600, margin: '0 0 0.25rem 0' }}>Click to browse or drag file here</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>CSV files up to 10MB</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label className="form-label" style={{ fontWeight: 600 }}>Or Paste CSV Text Content</label>
            <textarea
              className="form-input"
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="date,description,paid_by,amount,currency,split_type,split_with,split_details,notes&#10;01-02-2026,February rent,Aisha,48000,INR,equal,Aisha;Rohan;Priya;Meera"
              style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              className="btn btn-primary"
              onClick={handleAnalyze}
              disabled={loading || fileLoading || !csvText.trim()}
              style={{ padding: '0.75rem 1.5rem' }}
            >
              {loading ? 'Analyzing...' : 'Analyze CSV'}
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && <Spinner fullPage />}

      {/* Preview Grid with Anomaly Resolvers */}
      {!importReport && previewRows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Summary Banner */}
          <div
            className="card glass"
            style={{
              border: '1px solid var(--border)',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.25rem 2rem',
              backgroundColor: 'var(--primary-glow)',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Total CSV Rows</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>{totalRows}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Anomalies Logged</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger)' }}>
                  <AlertTriangle size={18} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                  {anomalyCount}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Suspected Duplicates</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--warning)' }}>{duplicateCount}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Approved for Import</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>{selectedCount}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => { setPreviewRows([]); setCsvText(''); }}>
                Reset File
              </button>
              <button className="btn btn-primary" onClick={handleImportCommit} disabled={selectedCount === 0}>
                Import Approved ({selectedCount})
              </button>
            </div>
          </div>

          {/* List of Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            <h3 style={{ fontSize: '1.25rem' }}>Transaction Preview & Resolution</h3>
            
            {previewRows.map((row) => {
              const isSelected = !!selectedRows[row.rowIndex];
              const resolvedPayer = resolvedPayers[row.rowIndex] || '';
              const hasCriticalError = row.amount === 0;

              return (
                <div
                  key={row.rowIndex}
                  className="card"
                  style={{
                    border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                    opacity: isSelected ? 1 : 0.6,
                    padding: '1.25rem',
                    transition: 'all 0.2s',
                    backgroundColor: row.isDuplicate ? 'var(--bg-main)' : 'var(--card-bg)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                    
                    {/* Left: Checkbox and title */}
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleRow(row.rowIndex)}
                        disabled={hasCriticalError}
                        style={{ width: '18px', height: '18px', marginTop: '0.25rem', cursor: 'pointer' }}
                      />
                      
                      <div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                            ROW {row.rowIndex}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {row.date || row.dateRaw}
                          </span>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '0.1rem 0.5rem',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 700,
                              backgroundColor: row.isSettlement ? 'var(--success-bg)' : 'var(--primary-glow)',
                              color: row.isSettlement ? 'var(--success)' : 'var(--primary)'
                            }}
                          >
                            {row.isSettlement ? 'Settlement' : `Expense: ${row.splitType}`}
                          </span>
                          {row.isDuplicate && (
                            <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: 'var(--radius-sm)', fontWeight: 700, backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}>
                              Duplicate
                            </span>
                          )}
                        </div>

                        <h4 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-heading)' }}>
                          {row.description}
                        </h4>

                        <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
                          Raw Payer: <strong>{row.paidByRaw || 'None'}</strong> • Split list: {row.splitWith.join(', ')}
                        </p>
                        
                        {row.notes && (
                          <p style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
                            CSV Note: "{row.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Amount and Payer selector */}
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '200px' }}>
                      <span
                        style={{
                          fontSize: '1.35rem',
                          fontWeight: 800,
                          color: row.amount < 0 ? 'var(--danger)' : 'var(--text-heading)'
                        }}
                      >
                        ₹{row.amount.toFixed(2)}
                      </span>

                      {/* Interactive Payer resolution */}
                      <div>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                          Resolved Payer:
                        </label>
                        <select
                          className="form-input"
                          value={resolvedPayer}
                          onChange={(e) => handlePayerChange(row.rowIndex, e.target.value)}
                          style={{ 
                            padding: '0.25rem 0.5rem', 
                            fontSize: '0.8rem', 
                            width: '100%',
                            border: isSelected && !resolvedPayer ? '1px solid var(--danger)' : '1px solid var(--border)'
                          }}
                        >
                          <option value="">Select Payer...</option>
                          {/* Dynamically parsed unique candidates from CSV and group members */}
                          {getCandidateNames().map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                        {isSelected && !resolvedPayer && (
                          <span style={{ color: 'var(--danger)', fontSize: '0.7rem', display: 'block', marginTop: '0.15rem', fontWeight: 600 }}>
                            ⚠️ Payer required
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Anomalies display */}
                  {row.anomalies.length > 0 && (
                    <div
                      style={{
                        marginTop: '1rem',
                        padding: '0.75rem',
                        backgroundColor: 'var(--bg-main)',
                        borderRadius: 'var(--radius-md)',
                        borderLeft: '3px solid var(--warning)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem'
                      }}
                    >
                      {row.anomalies.map((anom, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          <AlertCircle size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                          <span>{anom}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Split details layout */}
                  {isSelected && row.splits.length > 0 && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                        Calculated splits (₹):
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {row.splits.map((split, sIdx) => (
                          <div
                            key={sIdx}
                            style={{
                              backgroundColor: 'var(--bg-main)',
                              padding: '0.25rem 0.65rem',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '0.75rem',
                              border: '1px solid var(--border)'
                            }}
                          >
                            <strong>{split.name}</strong>: ₹{split.amount.toFixed(2)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Post-Import Report Log View */}
      {importReport && (
        <div className="card" style={{ border: '1px solid var(--border)', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <CheckCircle2 size={56} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
            <h2 style={{ margin: '0 0 0.5rem 0' }}>Import Run Completed!</h2>
            <p style={{ color: 'var(--text-muted)' }}>CSV data has been successfully parsed and ingested into the database.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label className="form-label" style={{ fontWeight: 600 }}>Final Import Anomaly & Actions Report</label>
            <div
              style={{
                backgroundColor: 'var(--bg-main)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'monospace',
                fontSize: '0.825rem',
                maxHeight: '400px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                border: '1px solid var(--border)',
                lineHeight: 1.5,
                color: 'var(--text-main)'
              }}
            >
              {importReport}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={() => setImportReport(null)}>
              Import Another File
            </button>
            <button className="btn btn-primary" onClick={() => navigate(`/groups/${groupId}`)}>
              Back to Group Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Toasts */}
      {toastMsg && (
        <Toast message={toastMsg} type={toastMsg.includes('Failed') ? 'error' : 'success'} onClose={() => setToastMsg('')} />
      )}
    </div>
  );
};

export default ImportPage;
