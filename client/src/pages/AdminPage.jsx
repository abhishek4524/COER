import React, { useEffect, useState } from 'react';
import { getAdminStats, updateUserRole } from '../services/api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminStats();
      setStats(data);
    } catch (err) {
      setError(err.message || 'Access denied or failed to load admin stats.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRoleToggle = async (userId, currentRole) => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`Change user role to ${nextRole}?`)) return;

    try {
      await updateUserRole(userId, nextRole);
      fetchStats();
    } catch (err) {
      alert(err.message || 'Failed to update user role');
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6 max-w-6xl mx-auto text-center py-12">
        <div className="text-3xl mb-2">🔒</div>
        <h2 className="text-xl font-bold text-white mb-2">Admin Access Required</h2>
        <p className="text-gray-400 text-sm max-w-md mx-auto">{error}</p>
      </div>
    );
  }

  const { overview, runsPerDay, failedRuns, recentUsers } = stats;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="purple">Admin System Portal</Badge>
          <span className="text-xs text-gray-500">•</span>
          <span className="text-xs text-gray-400">Live Telemetry</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Platform Analytics & Management</h1>
        <p className="text-gray-400 text-sm mt-1">
          Real-time metrics, simulation throughput, user administration, and system health.
        </p>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-extrabold text-white mb-1">{overview.totalUsers}</div>
          <div className="text-[11px] text-gray-400 uppercase font-semibold">Total Users</div>
        </Card>

        <Card className="p-4 text-center">
          <div className="text-2xl font-extrabold text-[#6C63FF] mb-1">{overview.totalRuns}</div>
          <div className="text-[11px] text-gray-400 uppercase font-semibold">Total Runs</div>
        </Card>

        <Card className="p-4 text-center">
          <div className="text-2xl font-extrabold text-indigo-400 mb-1">{overview.proUsers}</div>
          <div className="text-[11px] text-gray-400 uppercase font-semibold">Pro Subscriptions</div>
        </Card>

        <Card className="p-4 text-center">
          <div className="text-2xl font-extrabold text-purple-400 mb-1">{overview.teamUsers}</div>
          <div className="text-[11px] text-gray-400 uppercase font-semibold">Team Seats</div>
        </Card>

        <Card className="p-4 text-center">
          <div className="text-2xl font-extrabold text-emerald-400 mb-1">₹{overview.totalRevenue}</div>
          <div className="text-[11px] text-gray-400 uppercase font-semibold">Total Revenue</div>
        </Card>

        <Card className="p-4 text-center">
          <div className="text-2xl font-extrabold text-red-400 mb-1">{overview.failedRunsCount}</div>
          <div className="text-[11px] text-gray-400 uppercase font-semibold">Failed Runs</div>
        </Card>
      </div>

      {/* Chart: Runs Per Day */}
      <Card className="p-6">
        <h2 className="text-lg font-bold text-white mb-4">Simulation Runs Per Day (Last 14 Days)</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={runsPerDay}>
              <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickLine={false} />
              <YAxis stroke="#6b7280" fontSize={11} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#161B22', borderColor: '#30363d', borderRadius: '12px', color: '#fff' }}
              />
              <Bar dataKey="count" fill="#6C63FF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* User Management */}
      <Card className="p-6">
        <h2 className="text-lg font-bold text-white mb-4">Registered Accounts ({recentUsers.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="border-b border-white/10 text-gray-400 uppercase text-[10px]">
              <tr>
                <th className="pb-3 px-3">User</th>
                <th className="pb-3 px-3">Email</th>
                <th className="pb-3 px-3">Plan</th>
                <th className="pb-3 px-3">Role</th>
                <th className="pb-3 px-3">Joined</th>
                <th className="pb-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentUsers.map((u) => (
                <tr key={u._id} className="hover:bg-white/5">
                  <td className="py-3 px-3 font-semibold text-white">{u.name}</td>
                  <td className="py-3 px-3 text-gray-400">{u.email}</td>
                  <td className="py-3 px-3">
                    <Badge variant={u.plan === 'team' ? 'purple' : u.plan === 'pro' ? 'info' : 'secondary'}>
                      {u.plan.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="py-3 px-3">
                    <Badge variant={u.role === 'admin' ? 'warning' : 'secondary'}>
                      {u.role.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => handleRoleToggle(u._id, u.role)}
                      className="text-xs text-[#6C63FF] hover:underline"
                    >
                      {u.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Failed Runs Telemetry */}
      {failedRuns && failedRuns.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span>⚠️</span> Failed Runs Diagnostic Telemetry
          </h2>
          <div className="space-y-3">
            {failedRuns.map((r) => (
              <div key={r._id} className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-white">{r.targetUrl}</div>
                  <div className="text-gray-400">{r.failureReason || 'Worker execution error'}</div>
                </div>
                <div className="text-gray-500 text-[11px]">{new Date(r.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
