import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSharedReport } from '../services/api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';

export default function SharedReportPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    getSharedReport(token)
      .then((res) => {
        if (mounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || 'Shared report link is invalid or expired.');
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E1117] text-white flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading public UX report...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0E1117] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center text-2xl mb-4">
          ⚠️
        </div>
        <h1 className="text-2xl font-bold mb-2">Report Not Found</h1>
        <p className="text-gray-400 max-w-md mb-6">{error || 'This report link may have been revoked or expired.'}</p>
        <Link to="/">
          <Button variant="primary">Go to Personify Home</Button>
        </Link>
      </div>
    );
  }

  const { run, metrics, insights, funnel, personaTypeScores } = data;

  return (
    <div className="min-h-screen bg-[#0E1117] text-white">
      {/* Public Top Navbar */}
      <header className="border-b border-white/10 bg-[#161B22]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#6C63FF] to-[#FF6584] flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-[#6C63FF]/30">
              P
            </div>
            <span className="font-bold text-lg text-white tracking-tight">Personify</span>
          </Link>
          <Badge variant="purple" className="text-xs">Public UX Audit Report</Badge>
        </div>

        <Link to="/signup">
          <Button variant="primary" className="text-xs py-2 px-4">
            Simulate Your Site Free →
          </Button>
        </Link>
      </header>

      {/* Main Body */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Header summary */}
        <div className="p-6 rounded-2xl bg-[#161B22]/60 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-[#6C63FF] font-semibold uppercase tracking-wider">Tested Website</span>
              <span className="text-xs text-gray-500">•</span>
              <span className="text-xs text-gray-400">{new Date(run.createdAt).toLocaleDateString()}</span>
            </div>
            <h1 className="text-2xl font-bold text-white break-all">{run.url}</h1>
            <p className="text-gray-400 text-sm mt-1">Goal: "{run.goal}"</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-gray-400">Device Target</div>
              <div className="font-medium capitalize text-sm">{run.device}</div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-right">
              <div className="text-xs text-gray-400">Simulated Testers</div>
              <div className="font-medium text-sm">{run.personaCount} personas</div>
            </div>
          </div>
        </div>

        {/* Metric KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-5 text-center">
            <div className="text-3xl font-extrabold text-[#6C63FF] mb-1">
              {metrics?.taskSuccessRate ?? 0}%
            </div>
            <div className="text-xs text-gray-400 font-medium">Task Success Rate</div>
          </Card>

          <Card className="p-5 text-center">
            <div className="text-3xl font-extrabold text-[#FF6584] mb-1">
              {metrics?.avgFrustration ?? 0}%
            </div>
            <div className="text-xs text-gray-400 font-medium">Avg Frustration Score</div>
          </Card>

          <Card className="p-5 text-center">
            <div className="text-3xl font-extrabold text-amber-400 mb-1">
              {metrics?.ctaMissRate ?? 0}%
            </div>
            <div className="text-xs text-gray-400 font-medium">CTA Miss Rate</div>
          </Card>

          <Card className="p-5 text-center">
            <div className="text-3xl font-extrabold text-emerald-400 mb-1">
              {metrics?.avgSessionTime ?? 0}s
            </div>
            <div className="text-xs text-gray-400 font-medium">Avg Session Time</div>
          </Card>
        </div>

        {/* Top UX Issues */}
        <Card className="p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span>🚨</span> Top Usability Bottlenecks Identified
          </h2>

          {insights && insights.length > 0 ? (
            <div className="space-y-4">
              {insights.map((issue, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white text-sm">{issue.title || issue.issue}</span>
                    <Badge variant={issue.severity === 'critical' ? 'danger' : issue.severity === 'high' ? 'warning' : 'info'}>
                      {issue.severity?.toUpperCase() || 'MEDIUM'}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">{issue.description || issue.detail}</p>
                  {issue.suggestedFix && (
                    <div className="text-xs text-emerald-400 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
                      💡 <strong>Recommendation:</strong> {issue.suggestedFix}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No critical UX bottlenecks were detected during this run.</p>
          )}
        </Card>

        {/* Drop-off Funnel */}
        {funnel && funnel.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-bold text-white mb-4">User Drop-off Funnel</h2>
            <div className="space-y-3">
              {funnel.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-300">
                    <span>{item.stage}</span>
                    <span className="font-medium text-white">{item.pct}% ({item.count} users)</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#6C63FF] to-[#FF6584] transition-all duration-500"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
