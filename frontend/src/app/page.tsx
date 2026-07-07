'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
  ListFilter,
  Download,
  Copy,
  FileJson,
  X,
  ShieldAlert,
  Sun,
  Moon,
  ArrowLeft
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
  confidence_level: 'High' | 'Medium' | 'Low' | '';
}

interface SkippedRecord {
  record: Record<string, any>;
  reason: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface LogEntry {
  time: string;
  msg: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface ToastProps {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  onDismiss: (id: string) => void;
}

const DraggableToast: React.FC<ToastProps> = ({ id, message, type, onDismiss }) => {
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [opacity, setOpacity] = useState(1);
  const [isDismissing, setIsDismissing] = useState(false);

  const handleStart = (clientX: number) => {
    setStartX(clientX);
    setIsDragging(true);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging) return;
    const diffX = clientX - startX;
    setCurrentX(diffX);
    
    const absDiff = Math.abs(diffX);
    const newOpacity = Math.max(0.1, 1 - absDiff / 200);
    setOpacity(newOpacity);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    if (Math.abs(currentX) > 100) {
      setIsDismissing(true);
      setTimeout(() => {
        onDismiss(id);
      }, 200);
    } else {
      setCurrentX(0);
      setOpacity(1);
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX);
  };

  const onMouseUp = () => {
    handleEnd();
  };

  const onTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  const onTouchEnd = () => {
    handleEnd();
  };

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMove = (e: MouseEvent) => handleMove(e.clientX);
      const handleGlobalUp = () => handleEnd();

      window.addEventListener('mousemove', handleGlobalMove);
      window.addEventListener('mouseup', handleGlobalUp);

      return () => {
        window.removeEventListener('mousemove', handleGlobalMove);
        window.removeEventListener('mouseup', handleGlobalUp);
      };
    }
  }, [isDragging, startX]);

  return (
    <div
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className={`toast toast-${type}`}
      style={{
        transform: `translateX(${currentX}px)`,
        opacity: isDismissing ? 0 : opacity,
        transition: isDragging ? 'none' : 'transform 0.2s ease-out, opacity 0.2s ease-out',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {type === 'success' && <CheckCircle2 size={16} color="var(--success)" />}
      {type === 'error' && <AlertTriangle size={16} color="var(--danger)" />}
      {type === 'info' && <RefreshCw size={16} color="var(--primary)" />}
      <span>{message}</span>
    </div>
  );
};

export default function Home() {
  // App Steps
  // 1: Dashboard Landing, 2: Preview & Stats, 3: Processing Loop, 4: Results
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); 
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentBatchNum, setCurrentBatchNum] = useState(0);
  const [totalBatchesNum, setTotalBatchesNum] = useState(0);
  
  // Selection states
  const [checkedRows, setCheckedRows] = useState<Set<number>>(new Set());

  // Log Panel States
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const consoleBottomRef = useRef<HTMLDivElement>(null);
  const isImportCancelled = useRef(false);

  // Error States
  const [errorState, setErrorState] = useState<{ message: string; details?: string } | null>(null);

  // Toast Notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Results State
  const [importedLeads, setImportedLeads] = useState<CRMRecord[]>([]);
  const [skippedLeads, setSkippedLeads] = useState<SkippedRecord[]>([]);
  const [importStats, setImportStats] = useState<{ total: number; imported: number; skipped: number }>({ total: 0, imported: 0, skipped: 0 });
  const [resultTab, setResultTab] = useState<'success' | 'skipped'>('success');
  
  // Filter & Search States
  const [previewSearch, setPreviewSearch] = useState('');
  const [successSearch, setSuccessSearch] = useState('');
  const [skippedSearch, setSkippedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Config States (Stored locally)
  const [showConfig, setShowConfig] = useState(false);
  const [apiUrl, setApiUrl] = useState('http://localhost:5000/api/import');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [batchSize, setBatchSize] = useState(20);

  // Load configs on client mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setApiUrl(localStorage.getItem('groweasy_api_url') || 'http://localhost:5000/api/import');
      setGeminiApiKey(localStorage.getItem('groweasy_gemini_key') || '');
      setBatchSize(parseInt(localStorage.getItem('groweasy_batch_size') || '20', 10));
      
      const savedTheme = (localStorage.getItem('groweasy_theme') || 'dark') as 'dark' | 'light';
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  // Theme toggle helper
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('groweasy_theme', nextTheme);
    triggerToast(`Switched to ${nextTheme} theme`, 'info');
  };

  // Scroll Console to bottom
  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Toast helper
  const triggerToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Log Console helper
  const addLog = (msg: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { time, msg, type }]);
  };

  // Save Config
  const saveConfig = () => {
    localStorage.setItem('groweasy_api_url', apiUrl);
    localStorage.setItem('groweasy_gemini_key', geminiApiKey);
    localStorage.setItem('groweasy_batch_size', batchSize.toString());
    setShowConfig(false);
    triggerToast('Configuration saved successfully!', 'success');
  };

  // Helper to trigger Template Download
  const downloadSampleTemplate = () => {
    const headersStr = "Name,Email,Phone,Company,City,State,Country,Status,Source,Possession Timeline,Description\n";
    const row1 = "Jane Smith,jane.smith@example.com,+1 415 555 2671,GrowEasy,San Francisco,California,USA,GOOD_LEAD_FOLLOW_UP,leads_on_demand,Immediate,Interested in property investment\n";
    const row2 = "Rajesh Kumar,rajesh.kumar@example.com,+91 98765 43210,Tech Corp,Bangalore,Karnataka,India,GOOD_LEAD_FOLLOW_UP,eden_park,3 months,Looking for 3BHK flat\n";
    const row3 = "Priya Patel,,9876543211,,Mumbai,,India,DID_NOT_CONNECT,varah_swamy,,No email provided\n";
    const row4 = "John Doe,john.doe@example.com,,,New Delhi,Delhi,India,BAD_LEAD,sarjapur_plots,,No phone provided\n";
    
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headersStr + row1 + row2 + row3 + row4);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", "sample_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('Sample template downloaded!', 'success');
  };

  // Client-Side Pre-import Statistics & Calculations
  const stats = useMemo(() => {
    let missingEmailCount = 0;
    let missingPhoneCount = 0;
    let duplicateEmails = 0;
    let duplicatePhones = 0;
    let invalidRowCount = 0;

    const emailSet = new Set<string>();
    const phoneSet = new Set<string>();

    rawRows.forEach((row) => {
      // Find possible fields
      const emailVal = (row.email || row.Email || row['Email Address'] || row['Primary Email'] || '').trim().toLowerCase();
      const phoneVal = String(row.phone || row.Phone || row['Phone Number'] || row.mobile || row.Mobile || '').replace(/\D/g, '');

      if (!emailVal) {
        missingEmailCount++;
      } else {
        if (emailSet.has(emailVal)) {
          duplicateEmails++;
        } else {
          emailSet.add(emailVal);
        }
      }

      if (!phoneVal) {
        missingPhoneCount++;
      } else {
        if (phoneSet.has(phoneVal)) {
          duplicatePhones++;
        } else {
          phoneSet.add(phoneVal);
        }
      }

      // Invalid rule: missing BOTH
      if (!emailVal && !phoneVal) {
        invalidRowCount++;
      }
    });

    return {
      totalRows: rawRows.length,
      totalCols: headers.length,
      missingEmails: missingEmailCount,
      missingPhones: missingPhoneCount,
      duplicateEmails,
      duplicatePhones,
      invalidRows: invalidRowCount
    };
  }, [rawRows, headers]);

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
      triggerToast('Please upload a valid CSV file.', 'error');
      return;
    }
    setFile(fileToProcess);
    
    // Utilize worker: true for background thread streaming parsing
    Papa.parse(fileToProcess, {
      header: true,
      skipEmptyLines: 'greedy',
      worker: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          const parsedData = results.data as Record<string, any>[];
          setRawRows(parsedData);
          
          if (results.meta && results.meta.fields) {
            setHeaders(results.meta.fields);
          } else {
            setHeaders(Object.keys(parsedData[0] as object));
          }
          
          // Select all rows by default
          setCheckedRows(new Set(parsedData.map((_, i) => i)));
          setIsUploadModalOpen(false);
          setStep(2);
          triggerToast('CSV parsed successfully!', 'success');
        } else {
          triggerToast('The CSV file is empty or could not be parsed.', 'error');
        }
      },
      error: (err) => {
        triggerToast(`Error parsing CSV: ${err.message}`, 'error');
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
    setErrorState(null);
  };

  // Abort controller reference for halting imports
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sequential Batch Importer Loop with Abort Signal
  const handleConfirmImport = async () => {
    setStep(3);
    setProgress(0);
    setLogs([]);
    setErrorState(null);
    isImportCancelled.current = false;

    const selectedRows = rawRows.filter((_, i) => checkedRows.has(i));
    const totalRecords = selectedRows.length;

    if (totalRecords === 0) {
      triggerToast('No rows selected for import!', 'error');
      setStep(2);
      return;
    }

    addLog(`Initializing AI Importer worker...`, 'info');
    addLog(`Calculated duplicates locally: ${stats.duplicateEmails} duplicate emails, ${stats.duplicatePhones} duplicate mobiles.`, 'warning');
    addLog(`Starting batch mapping. Sending ${totalRecords} selected records to Gemini AI...`, 'info');

    const totalBatches = Math.ceil(totalRecords / batchSize);
    setTotalBatchesNum(totalBatches);
    setCurrentBatchNum(0);

    const accumulatedImported: CRMRecord[] = [];
    const accumulatedSkipped: SkippedRecord[] = [];

    abortControllerRef.current = new AbortController();

    for (let i = 0; i < totalRecords; i += batchSize) {
      if (isImportCancelled.current) {
        addLog(`Import process cancelled by user. Halting remaining requests.`, 'error');
        triggerToast('Import cancelled.', 'info');
        break;
      }

      const batchIndex = Math.floor(i / batchSize) + 1;
      setCurrentBatchNum(batchIndex);
      addLog(`Uploading & processing Batch ${batchIndex} of ${totalBatches}...`, 'info');

      const batchRecords = selectedRows.slice(i, i + batchSize);

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gemini-key': geminiApiKey,
          },
          body: JSON.stringify({
            records: batchRecords,
            batchSize: batchSize,
          }),
          signal: abortControllerRef.current.signal
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || `HTTP ${response.status} Server Error`);
        }

        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.message || 'AI service returned failure code.');
        }

        accumulatedImported.push(...data.imported);
        accumulatedSkipped.push(...data.skipped);

        addLog(`Batch ${batchIndex} complete: ${data.imported.length} leads successfully mapped, ${data.skipped.length} records skipped.`, 'success');
        
        const nextProgress = Math.min(100, Math.round((batchIndex / totalBatches) * 100));
        setProgress(nextProgress);

      } catch (err: any) {
        if (err.name === 'AbortError') {
          break;
        }

        addLog(`Batch ${batchIndex} failed: ${err.message || 'Network exception'}`, 'error');
        // Mark whole batch as skipped
        batchRecords.forEach((record) => {
          accumulatedSkipped.push({
            record,
            reason: `Batch Error: ${err.message || 'AI service connection failed'}`
          });
        });
      }
    }

    addLog(`All batches completed. Summarizing final metrics...`, 'success');
    setImportedLeads(accumulatedImported);
    setSkippedLeads(accumulatedSkipped);

    // Update stats for step 4
    setImportStats({
      total: totalRecords,
      imported: accumulatedImported.length,
      skipped: accumulatedSkipped.length
    });

    if (accumulatedImported.length === 0 && accumulatedSkipped.length > 0 && !isImportCancelled.current) {
      // Trigger error state screen
      setErrorState({
        message: 'AI Service Unavailable or Rates Limit Exceeded',
        details: 'The AI server was unable to respond to import requests. Check your Gemini API Key configuration and network endpoints.'
      });
    }

    setStep(4);
    triggerToast('AI Import complete!', 'success');
  };

  // Halt execution handler
  const cancelImport = () => {
    isImportCancelled.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    addLog(`Cancelling process. Aborting connection...`, 'warning');
  };

  // Checkbox row togglers
  const toggleRow = (index: number) => {
    setCheckedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAllRows = () => {
    if (checkedRows.size === rawRows.length) {
      setCheckedRows(new Set());
    } else {
      setCheckedRows(new Set(rawRows.map((_, i) => i)));
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
      const matchesSearch = successSearch === '' || 
        [lead.name, lead.email, lead.mobile_without_country_code, lead.company, lead.city, lead.state, lead.country, lead.crm_note, lead.description]
          .some(field => String(field || '').toLowerCase().includes(successSearch.toLowerCase()));
      const matchesStatus = statusFilter === 'ALL' || lead.crm_status === statusFilter;
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

  // Export Mapped Leads to CSV
  const exportCRMCSV = () => {
    if (importedLeads.length === 0) {
      triggerToast('No leads available to export.', 'info');
      return;
    }
    const csv = Papa.unparse(importedLeads);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `crm_leads_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('Leads CSV exported successfully!', 'success');
  };

  // Export raw JSON response
  const exportCRMJSON = () => {
    if (importedLeads.length === 0) {
      triggerToast('No leads available to export.', 'info');
      return;
    }
    const jsonStr = JSON.stringify(importedLeads, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `crm_leads_export_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('JSON response downloaded!', 'success');
  };

  // Copy raw JSON responses to clipboard
  const copyJSONToClipboard = () => {
    if (importedLeads.length === 0) {
      triggerToast('No response data to copy.', 'info');
      return;
    }
    const jsonStr = JSON.stringify(importedLeads, null, 2);
    navigator.clipboard.writeText(jsonStr);
    triggerToast('Copied JSON responses to clipboard!', 'success');
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'GOOD_LEAD_FOLLOW_UP': return 'badge-success';
      case 'DID_NOT_CONNECT': return 'badge-info';
      case 'BAD_LEAD': return 'badge-danger';
      case 'SALE_DONE': return 'badge-success'; 
      default: return 'badge-warning';
    }
  };

  const getStatusLabel = (status: string) => {
    if (!status) return 'UNMAPPED';
    return status.replace(/_/g, ' ');
  };

  const getConfidenceClass = (level: string) => {
    switch (level) {
      case 'High': return 'badge-success';
      case 'Medium': return 'badge-warning';
      case 'Low': return 'badge-danger';
      default: return 'badge-info';
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER SECTION */}
      <header style={{
        background: 'var(--bg-secondary)',
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
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={toggleTheme}
              className="btn btn-secondary"
              style={{ padding: '8px', borderRadius: '6px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button 
              onClick={() => setShowConfig(true)}
              className="btn btn-secondary" 
              style={{ padding: '8px 14px', borderRadius: '6px', fontSize: '0.85rem' }}
            >
              <Settings size={16} />
              Configure
            </button>
          </div>
        </div>
      </header>

      {/* TOAST SYSTEM CONTAINER */}
      <div className="toast-container">
        {toasts.map((t) => (
          <DraggableToast 
            key={t.id} 
            id={t.id} 
            message={t.message} 
            type={t.type} 
            onDismiss={removeToast} 
          />
        ))}
      </div>

      {/* CONFIG MODAL */}
      {showConfig && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={20} color="var(--primary-hover)" />
              Importer Configuration
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              {/* <div>
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
              </div> */}

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
          
          {/* STEP 1: DASHBOARD LANDING & MODAL TRIGGER */}
          {step === 1 && (
            <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
              <div className="glass-panel" style={{ padding: '48px 40px', marginBottom: '24px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, var(--primary-glow), rgba(139, 92, 246, 0.1))',
                  borderRadius: '50%',
                  padding: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  border: '1px solid rgba(79, 70, 229, 0.2)'
                }}>
                  <FileSpreadsheet size={40} color="var(--primary-hover)" />
                </div>
                <h2 style={{ fontSize: '1.85rem', marginBottom: '8px' }}>CRM Lead CSV Importer</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.95rem' }}>
                  Map arbitrary spreadsheet logs from Facebook, Google Ads, or real estate brokers directly to CRM leads using automated LLM field matching.
                </p>

                <button 
                  onClick={() => setIsUploadModalOpen(true)}
                  className="btn btn-primary"
                  style={{ padding: '12px 32px', fontSize: '1rem', borderRadius: '8px' }}
                >
                  <Upload size={18} />
                  Import Leads via CSV
                </button>
              </div>

              {/* REFERENCE UPLOAD MODAL */}
              {isUploadModalOpen && (
                <div className="modal-overlay">
                  <div className="modal-content" style={{ maxWidth: '520px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Import Leads via CSV
                      </h3>
                      <button onClick={() => setIsUploadModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        <X size={18} />
                      </button>
                    </div>

                    <div 
                      className={`dropzone ${isDragging ? 'active' : ''}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      style={{ minHeight: '180px', marginBottom: '16px' }}
                    >
                      <Upload size={28} color="var(--primary-hover)" />
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>Drag & drop your CSV file here</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Only .csv files are supported</p>
                      </div>
                      
                      <input 
                        type="file" 
                        id="csv-modal-picker" 
                        accept=".csv" 
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                      <button 
                        onClick={() => document.getElementById('csv-modal-picker')?.click()}
                        className="btn btn-secondary" 
                        style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                      >
                        Choose File
                      </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                      <button 
                        onClick={downloadSampleTemplate} 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 12px', background: 'none', border: 'none', color: 'var(--primary-hover)', textDecoration: 'underline' }}
                      >
                        Download Template
                      </button>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setIsUploadModalOpen(false)} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.8rem' }}>
                          Cancel
                        </button>
                        <button 
                          onClick={() => document.getElementById('csv-modal-picker')?.click()} 
                          className="btn btn-primary" 
                          style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                        >
                          Upload File
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: PREVIEW & STATS SCREEN */}
          {step === 2 && (
            <div>
              <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                  
                  {/* File Information Card */}
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
                          {file ? (file.size / (1024 * 1024)).toFixed(2) : 0} MB
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, backgroundColor: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary-hover)', padding: '2px 8px', borderRadius: '4px' }}>
                          {rawRows.length} Rows
                        </span>
                      </h2>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Client-side parsing loaded. Checked rows will be mapped to standard CRM.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={handleRemoveFile} className="btn btn-secondary" style={{ padding: '10px 16px' }}>
                      <ArrowLeft size={16} />
                      Back
                    </button>
                    <button onClick={handleConfirmImport} className="btn btn-primary" style={{ padding: '10px 24px' }}>
                      <Play size={16} />
                      Confirm & Process
                    </button>
                  </div>
                </div>

                {/* CSV Statistics Dashboard */}
                <div style={{ margin: '20px 0' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    CSV Summary Statistics
                  </h4>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-card-value">{stats.totalRows}</div>
                      <div className="stat-card-label">Total Rows</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-card-value">{stats.totalCols}</div>
                      <div className="stat-card-label">Columns</div>
                    </div>
                    <div className="stat-card" style={{ borderLeft: stats.duplicateEmails > 0 ? '2px solid var(--warning)' : undefined }}>
                      <div className="stat-card-value" style={{ color: stats.duplicateEmails > 0 ? 'var(--warning)' : undefined }}>
                        {stats.duplicateEmails}
                      </div>
                      <div className="stat-card-label">Duplicate Emails</div>
                    </div>
                    <div className="stat-card" style={{ borderLeft: stats.duplicatePhones > 0 ? '2px solid var(--warning)' : undefined }}>
                      <div className="stat-card-value" style={{ color: stats.duplicatePhones > 0 ? 'var(--warning)' : undefined }}>
                        {stats.duplicatePhones}
                      </div>
                      <div className="stat-card-label">Duplicate Phones</div>
                    </div>
                    <div className="stat-card" style={{ borderLeft: stats.invalidRows > 0 ? '2px solid var(--danger)' : undefined }}>
                      <div className="stat-card-value" style={{ color: stats.invalidRows > 0 ? 'var(--danger)' : undefined }}>
                        {stats.invalidRows}
                      </div>
                      <div className="stat-card-label">Invalid Rows</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                    <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input 
                      type="text"
                      placeholder="Search preview rows..."
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        padding: '10px 10px 10px 36px',
                        color: 'var(--text-primary)',
                        fontSize: '0.875rem',
                        outline: 'none'
                      }}
                    />
                  </div>
                  
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Selected: <strong>{checkedRows.size}</strong> / {rawRows.length} rows
                  </div>
                </div>

                {/* Table Preview */}
                <div className="table-container">
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th className="checkbox-cell">
                            <div 
                              className={`custom-checkbox ${checkedRows.size === rawRows.length ? 'checked' : ''}`}
                              onClick={toggleAllRows}
                            >
                              {checkedRows.size === rawRows.length && '✓'}
                            </div>
                          </th>
                          <th style={{ width: '60px' }}>Row</th>
                          {headers.map((h, i) => (
                            <th key={i}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPreviewRows.slice(0, 100).map((row, index) => {
                          const originalIndex = rawRows.indexOf(row);
                          const isChecked = checkedRows.has(originalIndex);
                          return (
                            <tr key={index} style={{ opacity: isChecked ? 1 : 0.4 }}>
                              <td className="checkbox-cell">
                                <div 
                                  className={`custom-checkbox ${isChecked ? 'checked' : ''}`}
                                  onClick={() => toggleRow(originalIndex)}
                                >
                                  {isChecked && '✓'}
                                </div>
                              </td>
                              <td style={{ fontWeight: 600 }}>{originalIndex + 1}</td>
                              {headers.map((h, colIndex) => (
                                <td key={colIndex} title={String(row[h] || '')}>
                                  {String(row[h] || '')}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                {rawRows.length > 100 && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '10px', textAlign: 'center' }}>
                    Showing first 100 rows. Click &apos;Confirm &amp; Process&apos; to import all {checkedRows.size} selected records.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: INCREMENTAL PROCESSING & LIVE LOGS SCREEN */}
          {step === 3 && (
            <div style={{ maxWidth: '640px', margin: '30px auto' }}>
              <div className="glass-panel" style={{ padding: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    marginBottom: '16px',
                    border: '1px solid rgba(79, 70, 229, 0.2)'
                  }}>
                    <RefreshCw size={24} color="var(--primary-hover)" className="animate-spin" />
                  </div>

                  <h3 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>AI Field Mapping in Progress...</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Batch {currentBatchNum} / {totalBatchesNum}
                  </p>
                </div>

                {/* Progress bar */}
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--primary), var(--primary-hover))',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease-out'
                  }} />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                  <span>Batch size: {batchSize}</span>
                  <span>{progress}% Completed</span>
                </div>

                {/* Console Logs Panel */}
                <div style={{ textAlign: 'left' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Real-time Processing Console
                  </span>
                  <div className="console-panel">
                    {logs.map((log, index) => (
                      <div key={index} className={`console-line console-line-${log.type}`}>
                        <span className="console-line-timestamp">[{log.time}]</span>
                        <span>{log.msg}</span>
                      </div>
                    ))}
                    <div ref={consoleBottomRef} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                  <button onClick={cancelImport} className="btn btn-danger" style={{ padding: '8px 24px', fontSize: '0.85rem' }}>
                    Cancel Import
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: DETAILED ERROR OR RESULTS SCREEN */}
          {step === 4 && errorState ? (
            <div style={{ maxWidth: '550px', margin: '40px auto', textAlign: 'center' }}>
              <div className="glass-panel" style={{ padding: '40px', borderLeft: '4px solid var(--danger)' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  marginBottom: '20px'
                }}>
                  <ShieldAlert size={32} color="var(--danger)" />
                </div>
                <h2 style={{ fontSize: '1.4rem', marginBottom: '8px', color: 'var(--text-primary)' }}>
                  {errorState.message}
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
                  {errorState.details}
                </p>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button onClick={handleConfirmImport} className="btn btn-primary" style={{ padding: '10px 20px', fontSize: '0.85rem' }}>
                    <RefreshCw size={14} />
                    Retry Import
                  </button>
                  <button onClick={() => setStep(2)} className="btn btn-secondary" style={{ padding: '10px 20px', fontSize: '0.85rem' }}>
                    Go Back
                  </button>
                </div>
              </div>
            </div>
          ) : step === 4 && (
            <div>
              
              {/* Stats Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                <div className="glass-panel" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>TOTAL RECORDS</span>
                  <h3 style={{ fontSize: '2rem', marginTop: '4px', color: 'var(--text-primary)' }}>{importStats.total}</h3>
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

              {/* Action Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '16px' }}>
                <button onClick={exportCRMCSV} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                  <Download size={14} />
                  Export CRM CSV
                </button>
                <button onClick={exportCRMJSON} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                  <FileJson size={14} />
                  Download JSON
                </button>
                <button onClick={copyJSONToClipboard} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                  <Copy size={14} />
                  Copy JSON
                </button>
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
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: '10px 10px 10px 36px',
                          color: 'var(--text-primary)',
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
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: '10px 16px',
                          color: 'var(--text-primary)',
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
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: '10px 16px',
                          color: 'var(--text-primary)',
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
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: '10px 10px 10px 36px',
                          color: 'var(--text-primary)',
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
                            <th>Status</th>
                            <th>Source</th>
                            <th>Confidence</th>
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
                                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
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
                                <td>
                                  <span className={`badge ${getConfidenceClass(lead.confidence_level)}`}>
                                    {lead.confidence_level || 'High'}
                                  </span>
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
        background: 'var(--bg-primary)',
        borderTop: '1px solid var(--border)',
        padding: '20px 24px',
        color: 'var(--text-muted)',
        fontSize: '0.8rem',
        textAlign: 'center'
      }}>
        <div className="container">
          <p>© {new Date().getFullYear()} GrowEasy. AI-Powered CRM Importer. Made by Shubham Mali.</p>
        </div>
      </footer>

    </div>
  );
}
