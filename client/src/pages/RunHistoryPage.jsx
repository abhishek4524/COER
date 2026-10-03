import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRuns, deleteRun, generateShareToken, revokeShareToken } from '../services/api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';

export default function RunHistoryPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Share modal state
  const [shareRun, setShareRun] = useState(null);
  const [shareLink, setShareLink] = useState('');
  const [shareLoading, setShareLoading] = useState(false);

  // Delete modal state
  const [deleteRunId, setDeleteRunId] = useState(null);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const data = await getRuns();
      setRuns(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const handleDelete = async () => {
    if (!deleteRunId) return;
    try {
      await deleteRun(deleteRunId);
      setRuns((prev) => prev.filter((r) => (r.id || r._id) !== deleteRunId));
    } catch (err) {
      alert(err.message || 'Failed to delete run');
    } finally {
      setDeleteRunId(null);
    }
  };

  const openShareModal = async (run) => {
    setShareRun(run);
    setShareLoading(true);
    try {
      const res = await generateShareToken(run.id || run._id);
      setShareLink(res.shareUrl);
    } catch (err) {
      alert(err.message || 'Could not generate share link');
    } finally {
      setShareLoading(false);
    }
  };

  const handleRevokeShare = async () => {
    if (!shareRun) return;
    try {
      await revokeShareToken(shareRun.id || shareRun._id);
      setShareLink('');
      setShareRun(null);
    } catch (err) {
      alert(err.message || 'Could not revoke share link');
    }
  };

  const handleExportJSON = (run) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(run, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `run-${run.id || run._id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportPDF = (run) => {
    const printWin = window.open('', '_blank');
    if (!printWin) return alert('Please allow popups to export PDF');
    printWin.document.write(`
      <html>
        <head>
          <title>UX Audit Report - ${run.url}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 40px; color: #111; }
            h1 { color: #6C63FF; }
            .kpi { display: inline-block; padding: 15px; border: 1px solid #ccc; border-radius: 8px; margin-right: 15px; min-width: 120px; text-align: center; }
            .kpi-val { font-size: 24px; font-weight: bold; color: #6C63FF; }
          </style>
        </head>
        <body>
          <h1>Personify UX Audit Report</h1>
          <p><strong>Website:</strong> ${run.url}</p>
          <p><strong>Goal:</strong> ${run.goal}</p>
          <p><strong>Tested Date:</strong> ${new Date(run.createdAt).toLocaleString()}</p>
          <hr />
          <h3>Metrics Summary</h3>
          <div class="kpi">
            <div class="kpi-val">${run.scores?.taskSuccessRate ?? 0}%</div>
            <div>Task Success</div>
          </div>
          <div class="kpi">
            <div class="kpi-val">${run.scores?.avgFrustration ?? 0}%</div>
            <div>Frustration</div>
          </div>
          <div class="kpi">
            <div class="kpi-val">${run.scores?.ctaMissRate ?? 0}%</div>
            <div>CTA Miss Rate</div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  // Filter and sort runs
  const filteredRuns = runs
    .filter((r) => {
      const matchesSearch = (r.url || '').toLowerCase().includes(search.toLowerCase()) ||
                            (r.goal || '').toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Run History</h1>
          <p className="text-gray-400 text-sm mt-1">
            View, search, filter, and export all past UX test runs.
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate('/app/new-run')}>
          + New Simulation
        </Button>
      </div>

      {/* Filter Controls */}
      <Card className="p-4 flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1 w-full">
          <Input
            type="text"
            placeholder="Search by domain or target goal..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#161B22] border border-white/10 text-gray-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#6C63FF]"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-[#161B22] border border-white/10 text-gray-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#6C63FF]"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </Card>

      {/* Runs List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredRuns.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center">
          <img
            src="/assets/personas/default.png"
            alt="No runs"
            className="w-24 h-24 object-contain opacity-60 mb-4"
          />
          <h3 className="text-lg font-bold text-white mb-1">No Simulation Runs Found</h3>
          <p className="text-gray-400 text-sm max-w-sm mb-6">
            {search ? 'Try clearing your search filters.' : 'Run your first usability test to start gathering insights.'}
          </p>
          <Button variant="primary" onClick={() => navigate('/app/new-run')}>
            Start New Test
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRuns.map((run) => {
            const runId = run.id || run._id;
            const successRate = run.scores?.taskSuccessRate ?? 0;

            return (
              <Card key={runId} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-white/20 transition-all">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base break-all">{run.url}</h3>
                    <Badge variant={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'danger' : 'warning'}>
                      {run.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-1">Goal: "{run.goal}"</p>

                  <div className="flex items-center gap-4 text-xs text-gray-400 pt-1">
                    <span>📅 {new Date(run.createdAt).toLocaleDateString()}</span>
                    <span>👥 {run.personaCount} personas</span>
                    <span className="capitalize">💻 {run.device || 'desktop'}</span>
                  </div>
                </div>

                {/* Score & Actions */}
                <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 border-white/10 pt-3 md:pt-0">
                  {run.status === 'completed' && (
                    <div className="text-right">
                      <div className="text-xl font-extrabold text-[#6C63FF]">{successRate}%</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider">Success Rate</div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      className="text-xs py-2 px-3"
                      onClick={() => navigate(`/app/dashboard?runId=${runId}`)}
                    >
                      View Report
                    </Button>

                    <button
                      onClick={() => openShareModal(run)}
                      title="Share Public Link"
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all text-xs"
                    >
                      🔗
                    </button>

                    <button
                      onClick={() => handleExportJSON(run)}
                      title="Export JSON"
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all text-xs"
                    >
                      📄
                    </button>

                    <button
                      onClick={() => handleExportPDF(run)}
                      title="Export PDF / Print"
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all text-xs"
                    >
                      🖨️
                    </button>

                    <button
                      onClick={() => setDeleteRunId(runId)}
                      title="Delete Run"
                      className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all text-xs"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Share Link Modal */}
      {shareRun && (
        <Modal isOpen={true} onClose={() => setShareRun(null)} title="Share Read-Only Report">
          <div className="space-y-4 py-2">
            <p className="text-xs text-gray-300">
              Anyone with this unguessable link can view the read-only UX audit report without logging in.
            </p>

            {shareLoading ? (
              <div className="py-4 text-center text-xs text-gray-400">Generating link...</div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  className="flex-1 bg-black/40 border border-white/10 text-xs text-gray-200 rounded-xl px-3 py-2"
                />
                <Button
                  variant="primary"
                  className="text-xs py-2 px-3"
                  onClick={() => {
                    navigator.clipboard.writeText(shareLink);
                    alert('Copied to clipboard!');
                  }}
                >
                  Copy
                </Button>
              </div>
            )}

            <div className="pt-2 flex justify-between items-center">
              <button
                onClick={handleRevokeShare}
                className="text-xs text-red-400 hover:underline"
              >
                Revoke Link
              </button>
              <Button variant="secondary" className="text-xs py-1.5 px-3" onClick={() => setShareRun(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteRunId && (
        <Modal isOpen={true} onClose={() => setDeleteRunId(null)} title="Confirm Deletion">
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-300">
              Are you sure you want to delete this run? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setDeleteRunId(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
