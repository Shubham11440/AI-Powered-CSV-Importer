'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Sparkles, 
  Trash2, 
  Play, 
  ArrowRight, 
  Settings, 
  Clock, 
  User, 
  Mail, 
  Phone, 
  Database,
  Building,
  MapPin,
  RefreshCw,
  FileCheck,
  FileWarning,
  ListFilter
} from 'lucide-react';

interface CRMRecord {
  created_at: string;
  name: string;
  email: string;
  country_code: string;
  mobile_without_country_code: string;
  company: string;
  city: string;
  state: string;
  country: string;
  lead_owner: string;
  crm_status: 'GOOD_LEAD_FOLLOW_UP' | 'DID_NOT_CONNECT' | 'BAD_LEAD' | 'SALE_DONE' | '';
  crm_note: string;
  data_source: 'leads_on_demand' | 'meridian_tower' | 'eden_park' | 'varah_swamy' | 'sarjapur_plots' | '';
  possession_time: string;
  description: string;
}

interface SkippedRecord {
  record: Record<string, any>;
  reason: string;
}

interface ImportResponse {
  success: boolean;
  imported: CRMRecord[];
  skipped: SkippedRecord[];
  stats: {
    total: number;
    imported: number;
    skipped: number;
  };
}

export default function Home() {
  // App States
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Upload, 2: Preview, 3: Processing, 4: Results
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Results State
  const [importedLeads, setImportedLeads] = useState<CRMRecord[]>([]);
  const [skippedLeads, setSkippedLeads] = useState<SkippedRecord[]>([]);
  const [importStats, setImportStats] = useState<ImportResponse['stats']>({ total: 0, imported: 0, skipped: 0 });
  const [resultTab, setResultTab] = useState<'success' | 'skipped'>('success');
  
  // Filter & Search States
  const [previewSearch, setPreviewSearch] = useState('');
  const [successSearch, setSuccessSearch] = useState('');
  const [skippedSearch, setSkippedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');

  // Config States (Stored locally)
  const [showConfig, setShowConfig] = useState(false);
  const [apiUrl, setApiUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('groweasy_api_url') || 'http://localhost:5000/api/import';
    }
    return 'http://localhost:5000/api/import';
  });
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('groweasy_gemini_key') || '';
    }
    return '';
  });
  const [batchSize, setBatchSize] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('groweasy_batch_size') || '20', 10);
    }
    return 20;
  });

  // Save config changes
  const saveConfig = () => {
    localStorage.setItem('groweasy_api_url', apiUrl);
    localStorage.setItem('groweasy_gemini_key', geminiApiKey);
    localStorage.setItem('groweasy_batch_size', batchSize.toString());
    setShowConfig(false);
  };

  // Drag & Drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = (fileToProcess: File) => {
    if (!fileToProcess.name.endsWith('.csv')) {
      alert('Please upload a valid CSV file.');
      return;
    }
    setFile(fileToProcess);
    
    Papa.parse(fileToProcess, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          setRawRows(results.data as Record<string, any>[]);
          if (results.meta && results.meta.fields) {
            setHeaders(results.meta.fields);
          } else {
            // Fallback headers
            setHeaders(Object.keys(results.data[0] as object));
          }
          setStep(2);
        } else {
          alert('The CSV file is empty or could not be parsed.');
        }
      },
      error: (error) => {
        alert(`Error parsing CSV: ${error.message}`);
      }
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setRawRows([]);
    setHeaders([]);
    setStep(1);
    setProgress(0);
  };

  // Run AI Import (Step 3 to 4)
  const handleConfirmImport = async () => {
    setStep(3);
    setProgress(10);
    
    // Simulate incremental progress during upload/batch phase
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + 5;
      });
    }, 1000);

    try {
      // Send raw records to backend
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-key': geminiApiKey,
        },
        body: JSON.stringify({
          records: rawRows,
          batchSize: batchSize,
        }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to process leads.');
      }

      setImportedLeads(data.imported);
      setSkippedLeads(data.skipped);
      setImportStats(data.stats);
      setStep(4);
    } catch (error: any) {
      clearInterval(progressInterval);
      setStep(2);
      alert(`AI Import Failed: ${error.message || 'Unknown network error'}`);
    }
  };

  // Preview filtering
  const filteredPreviewRows = useMemo(() => {
    if (!previewSearch) return rawRows;
    return rawRows.filter(row => 
      Object.values(row).some(val => 
        String(val).toLowerCase().includes(previewSearch.toLowerCase())
      )
    );
  }, [rawRows, previewSearch]);

  // Success filtering
  const filteredSuccessRows = useMemo(() => {
    return importedLeads.filter(lead => {
      // Search text match
      const matchesSearch = successSearch === '' || 
        [lead.name, lead.email, lead.mobile_without_country_code, lead.company, lead.city, lead.state, lead.country, lead.crm_note, lead.description]
          .some(field => String(field || '').toLowerCase().includes(successSearch.toLowerCase()));
      
      // Status enum match
      const matchesStatus = statusFilter === 'ALL' || lead.crm_status === statusFilter;
      
      // Source enum match
      const matchesSource = sourceFilter === 'ALL' || lead.data_source === sourceFilter;

      return matchesSearch && matchesStatus && matchesSource;
    });
  }, [importedLeads, successSearch, statusFilter, sourceFilter]);

  // Skipped filtering
  const filteredSkippedRows = useMemo(() => {
    if (!skippedSearch) return skippedLeads;
    return skippedLeads.filter(item => 
      item.reason.toLowerCase().includes(skippedSearch.toLowerCase()) ||
      Object.values(item.record).some(val => 
        String(val).toLowerCase().includes(skippedSearch.toLowerCase())
      )
    );
  }, [skippedLeads, skippedSearch]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'GOOD_LEAD_FOLLOW_UP': return 'badge-success';
      case 'DID_NOT_CONNECT': return 'badge-info';
      case 'BAD_LEAD': return 'badge-danger';
      case 'SALE_DONE': return 'badge-success'; // both closed/follow up are green
      default: return 'badge-warning';
    }
  };

  const getStatusLabel = (status: string) => {
    if (!status) return 'UNMAPPED';
    return status.replace(/_/g, ' ');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER SECTION */}
      <header style={{
        background: 'rgba(17, 20, 32, 0.8)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: 'linear-gradient(135deg, var(--primary), #8b5cf6)',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', lineHeight: 1.2 }}>GrowEasy</h1>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>AI CSV IMPORTER</span>
            </div>
          </div>
          
          <button 
            onClick={() => setShowConfig(true)}
            className="btn btn-secondary" 
            style={{ padding: '8px 14px', borderRadius: '6px', fontSize: '0.85rem' }}
          >
            <Settings size={16} />
            Configure
          </button>
        </div>
      </header>

      {/* CONFIG MODAL */}
      {showConfig && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-panel" style={{
            padding: '30px',
            maxWidth: '500px',
            width: '90%',
            backgroundColor: '#111420',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            position: 'relative'
          }}>
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={20} color="var(--primary-hover)" />
              Importer Configuration
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Backend API URL
                </label>
                <input 
                  type="text" 
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '10px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                  placeholder="http://localhost:5000/api/import"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Gemini API Key (Optional Override)
                </label>
                <input 
                  type="password" 
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '10px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                  placeholder="AI key from your system if server is empty"
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  If left blank, the server will use its configured environment variable.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  AI Batch Processing Size: {batchSize}
                </label>
                <input 
                  type="range" 
                  min="5" 
                  max="50" 
                  step="5"
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value, 10))}
                  style={{
                    width: '100%',
                    cursor: 'pointer',
                    accentColor: 'var(--primary)'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <span>5 (Safest/Slowest)</span>
                  <span>50 (Fastest/Large CSVs)</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowConfig(false)}
                className="btn btn-secondary" 
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button 
                onClick={saveConfig}
                className="btn btn-primary" 
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Save Config
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main style={{ flex: 1, padding: '40px 0' }}>
        <div className="container">
          
          {/* STEP 1: UPLOAD SCREEN */}
          {step === 1 && (
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
              <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.75rem', marginBottom: '8px' }}>Import Your Leads</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.95rem' }}>
                  Upload raw spreadsheets from Facebook, Google Ads, agency exports, or custom sheets. Our AI extracts and maps details automatically.
                </p>

                <div 
                  className={`dropzone ${isDragging ? 'active' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  style={{ minHeight: '220px' }}
                >
                  <div style={{
                    background: 'rgba(79, 70, 229, 0.08)',
                    borderRadius: '50%',
                    padding: '16px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '8px',
                    border: '1px solid rgba(79, 70, 229, 0.2)'
                  }}>
                    <Upload size={32} color="var(--primary-hover)" />
                  </div>
                  
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '4px' }}>Drag & drop your CSV file here</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>or click to browse from device</p>
                  </div>
                  
                  <input 
                    type="file" 
                    id="csv-file-picker" 
                    accept=".csv" 
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <button 
                    onClick={() => document.getElementById('csv-file-picker')?.click()}
                    className="btn btn-secondary" 
                    style={{ fontSize: '0.85rem', padding: '8px 16px' }}
                  >
                    Choose File
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--primary-hover)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    1. Any CSV Layout
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    No fixed template needed. The AI dynamically matches headers, parses messy data formats, and infers status fields.
                  </p>
                </div>
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--success)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    2. Lead Rules
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Rows missing BOTH email and phone are filtered out. Multiple emails or mobiles are cleanly appended to lead remarks.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW SCREEN */}
          {step === 2 && (
            <div>
              <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      color: '#3b82f6',
                      borderRadius: '8px',
                      padding: '8px',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <FileSpreadsheet size={24} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {file?.name}
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                          {(file!.size / 1024).toFixed(1)} KB
                        </span>
                      </h2>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Parsed {rawRows.length} records. Showing preview before AI processing.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={handleRemoveFile} className="btn btn-secondary" style={{ padding: '10px 16px' }}>
                      <Trash2 size={16} />
                      Remove
                    </button>
                    <button onClick={handleConfirmImport} className="btn btn-primary" style={{ padding: '10px 24px' }}>
                      <Play size={16} />
                      Confirm & Process
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', maxWidth: '400px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input 
                      type="text"
                      placeholder="Search preview rows..."
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        padding: '10px 10px 10px 36px',
                        color: '#fff',
                        fontSize: '0.875rem',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div className="table-container">
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '60px' }}>Row</th>
                          {headers.map((h, i) => (
                            <th key={i}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPreviewRows.slice(0, 50).map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            <td style={{ fontWeight: 600 }}>{rowIndex + 1}</td>
                            {headers.map((h, colIndex) => (
                              <td key={colIndex} title={String(row[h] || '')}>
                                {String(row[h] || '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {rawRows.length > 50 && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '10px', textAlign: 'center' }}>
                    Showing first 50 rows. Click &apos;Confirm &amp; Process&apos; to map all {rawRows.length} records.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: PROCESSING / LOADING SCREEN */}
          {step === 3 && (
            <div style={{ maxWidth: '500px', margin: '60px auto', textAlign: 'center' }}>
              <div className="glass-panel" style={{ padding: '40px' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(79, 70, 229, 0.1)',
                  marginBottom: '24px',
                  border: '1px solid rgba(79, 70, 229, 0.2)'
                }}>
                  <RefreshCw size={32} color="var(--primary-hover)" className="animate-spin" />
                </div>

                <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>AI Field Mapping in Progress...</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '30px' }}>
                  Intelligently structuring rows into GrowEasy CRM format in batches.
                </p>

                {/* Progress bar container */}
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--primary), var(--primary-hover))',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease-out'
                  }} />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>Batching records (Size: {batchSize})</span>
                  <span>{progress}%</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: RESULTS SCREEN */}
          {step === 4 && (
            <div>
              
              {/* Stats Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                <div className="glass-panel" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>TOTAL RECORDS</span>
                  <h3 style={{ fontSize: '2rem', marginTop: '4px', color: '#fff' }}>{importStats.total}</h3>
                  <Database size={40} style={{ position: 'absolute', right: '16px', bottom: '12px', opacity: 0.05 }} />
                </div>
                
                <div className="glass-panel" style={{ padding: '20px', position: 'relative', overflow: 'hidden', borderLeft: '4px solid var(--success)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>MAPPED CRM LEADS</span>
                  <h3 style={{ fontSize: '2rem', marginTop: '4px', color: '#10b981' }}>{importStats.imported}</h3>
                  <FileCheck size={40} style={{ position: 'absolute', right: '16px', bottom: '12px', opacity: 0.05 }} />
                </div>
                
                <div className="glass-panel" style={{ padding: '20px', position: 'relative', overflow: 'hidden', borderLeft: '4px solid var(--danger)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>SKIPPED LEADS</span>
                  <h3 style={{ fontSize: '2rem', marginTop: '4px', color: '#f87171' }}>{importStats.skipped}</h3>
                  <FileWarning size={40} style={{ position: 'absolute', right: '16px', bottom: '12px', opacity: 0.05 }} />
                </div>

                <div className="glass-panel" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>CONVERSION RATE</span>
                  <h3 style={{ fontSize: '2rem', marginTop: '4px', color: 'var(--primary-hover)' }}>
                    {importStats.total > 0 ? ((importStats.imported / importStats.total) * 100).toFixed(0) : 0}%
                  </h3>
                  <CheckCircle2 size={40} style={{ position: 'absolute', right: '16px', bottom: '12px', opacity: 0.05 }} />
                </div>
              </div>

              {/* Result Area */}
              <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                  
                  {/* Tabs */}
                  <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <button 
                      onClick={() => setResultTab('success')}
                      className={`btn ${resultTab === 'success' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ 
                        padding: '8px 16px', 
                        borderRadius: '6px', 
                        fontSize: '0.85rem',
                        boxShadow: resultTab === 'success' ? undefined : 'none',
                        border: 'none',
                        background: resultTab === 'success' ? undefined : 'transparent'
                      }}
                    >
                      <CheckCircle2 size={16} />
                      Mapped Leads ({importStats.imported})
                    </button>
                    
                    <button 
                      onClick={() => setResultTab('skipped')}
                      className={`btn ${resultTab === 'skipped' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ 
                        padding: '8px 16px', 
                        borderRadius: '6px', 
                        fontSize: '0.85rem',
                        boxShadow: resultTab === 'skipped' ? undefined : 'none',
                        border: 'none',
                        background: resultTab === 'skipped' ? undefined : 'transparent',
                        color: resultTab === 'skipped' ? undefined : 'var(--text-secondary)'
                      }}
                    >
                      <AlertTriangle size={16} />
                      Skipped Records ({importStats.skipped})
                    </button>
                  </div>

                  <button onClick={handleRemoveFile} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                    <RefreshCw size={14} />
                    Import Another File
                  </button>
                </div>

                {/* SEARCH AND FILTERS BAR (For Success Tab) */}
                {resultTab === 'success' && (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
                    
                    {/* Search */}
                    <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                      <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input 
                        type="text"
                        placeholder="Search mapped leads..."
                        value={successSearch}
                        onChange={(e) => setSuccessSearch(e.target.value)}
                        style={{
                          width: '100%',
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: '10px 10px 10px 36px',
                          color: '#fff',
                          fontSize: '0.875rem',
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* Status Filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ListFilter size={16} color="var(--text-muted)" />
                      <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{
                          backgroundColor: '#111420',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: '10px 16px',
                          color: '#fff',
                          fontSize: '0.875rem',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="GOOD_LEAD_FOLLOW_UP">Good Lead (Follow Up)</option>
                        <option value="DID_NOT_CONNECT">Did Not Connect</option>
                        <option value="BAD_LEAD">Bad Lead</option>
                        <option value="SALE_DONE">Sale Done</option>
                      </select>
                    </div>

                    {/* Source Filter */}
                    <div>
                      <select 
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value)}
                        style={{
                          backgroundColor: '#111420',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: '10px 16px',
                          color: '#fff',
                          fontSize: '0.875rem',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="ALL">All Sources</option>
                        <option value="leads_on_demand">Leads On Demand</option>
                        <option value="meridian_tower">Meridian Tower</option>
                        <option value="eden_park">Eden Park</option>
                        <option value="varah_swamy">Varah Swamy</option>
                        <option value="sarjapur_plots">Sarjapur Plots</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* SEARCH BAR (For Skipped Tab) */}
                {resultTab === 'skipped' && (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', maxWidth: '400px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input 
                        type="text"
                        placeholder="Search skipped items/reasons..."
                        value={skippedSearch}
                        onChange={(e) => setSkippedSearch(e.target.value)}
                        style={{
                          width: '100%',
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: '10px 10px 10px 36px',
                          color: '#fff',
                          fontSize: '0.875rem',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* TABLES CONTAINER */}
                {resultTab === 'success' ? (
                  <div className="table-container">
                    <div className="table-wrapper" style={{ maxHeight: '550px' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Created At</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Company</th>
                            <th>Location</th>
                            <th>Lead Owner</th>
                            <th>Status</th>
                            <th>Source</th>
                            <th>Note / Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSuccessRows.length === 0 ? (
                            <tr>
                              <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                                No mapped leads found matching the filters.
                              </td>
                            </tr>
                          ) : (
                            filteredSuccessRows.map((lead, i) => (
                              <tr key={i}>
                                <td style={{ fontSize: '0.8rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Clock size={12} color="var(--text-muted)" />
                                    {lead.created_at ? new Date(lead.created_at).toLocaleString() : 'N/A'}
                                  </div>
                                </td>
                                <td style={{ fontWeight: 600, color: '#fff' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <User size={14} color="var(--primary-hover)" />
                                    {lead.name || 'Unknown'}
                                  </div>
                                </td>
                                <td>
                                  {lead.email ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <Mail size={12} color="var(--text-muted)" />
                                      <a href={`mailto:${lead.email}`} style={{ textDecoration: 'underline' }}>{lead.email}</a>
                                    </div>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                                  )}
                                </td>
                                <td>
                                  {lead.mobile_without_country_code ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <Phone size={12} color="var(--text-muted)" />
                                      <span>{lead.country_code || ''} {lead.mobile_without_country_code}</span>
                                    </div>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                                  )}
                                </td>
                                <td>
                                  {lead.company ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <Building size={12} color="var(--text-muted)" />
                                      {lead.company}
                                    </div>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                                  )}
                                </td>
                                <td>
                                  {[lead.city, lead.state, lead.country].filter(Boolean).join(', ') ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <MapPin size={12} color="var(--text-muted)" />
                                      <span title={[lead.city, lead.state, lead.country].filter(Boolean).join(', ')}>
                                        {[lead.city, lead.state, lead.country].filter(Boolean).join(', ')}
                                      </span>
                                    </div>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                                  )}
                                </td>
                                <td>{lead.lead_owner || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                                <td>
                                  <span className={`badge ${getStatusBadgeClass(lead.crm_status)}`}>
                                    {getStatusLabel(lead.crm_status)}
                                  </span>
                                </td>
                                <td>
                                  {lead.data_source ? (
                                    <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                                      {lead.data_source.replace(/_/g, ' ')}
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                                  )}
                                </td>
                                <td title={lead.crm_note}>
                                  <span style={{ fontSize: '0.8rem' }}>{lead.crm_note || <span style={{ color: 'var(--text-muted)' }}>—</span>}</span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="table-container">
                    <div className="table-wrapper" style={{ maxHeight: '550px' }}>
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: '80px' }}>Item #</th>
                            <th style={{ width: '250px' }}>Skip Reason</th>
                            <th>Original Raw Row Content</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSkippedRows.length === 0 ? (
                            <tr>
                              <td colSpan={3} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                                No skipped records found.
                              </td>
                            </tr>
                          ) : (
                            filteredSkippedRows.map((item, i) => (
                              <tr key={i}>
                                <td style={{ fontWeight: 600 }}>{i + 1}</td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger)', fontWeight: 600 }}>
                                    <AlertTriangle size={14} />
                                    {item.reason}
                                  </div>
                                </td>
                                <td style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                  {JSON.stringify(item.record)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

        </div>
      </main>

      {/* FOOTER */}
      <footer style={{
        background: '#090b11',
        borderTop: '1px solid var(--border)',
        padding: '20px 24px',
        color: 'var(--text-muted)',
        fontSize: '0.8rem',
        textAlign: 'center'
      }}>
        <div className="container">
          <p>© {new Date().getFullYear()} GrowEasy. AI-Powered CRM Importer. Made for WFH Software Developer Assignment.</p>
        </div>
      </footer>

    </div>
  );
}
