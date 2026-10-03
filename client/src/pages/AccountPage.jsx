import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import {
  User,
  Globe,
  BarChart3,
  Activity,
  KeyRound,
  Trash2,
  Play,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Sparkles,
  Calendar,
  ExternalLink,
  Settings,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import SettingsTabSection from '../components/dashboard/SettingsTabSection';

export default function AccountPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'profile';
  const [activeTab, setActiveTab] = useState(initialTab);

  const { user, updateProfile, changePassword, deleteAccount, logout, checkAuth } = useAuth();
  const navigate = useNavigate();

  // Profile form states
  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [profileLoading, setProfileLoading] = useState(false);

  // Change password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passMsg, setPassMsg] = useState({ type: '', text: '' });
  const [passLoading, setPassLoading] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Cancel subscription modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Stats & Billing data state
  const [stats, setStats] = useState(null);
  const [billingData, setBillingData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    fetchStatsAndBilling();
  }, []);

  const fetchStatsAndBilling = async () => {
    try {
      setStatsLoading(true);
      const [statsRes, billingRes] = await Promise.all([
        fetch(`${API_URL}/me/stats`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' }),
        fetch(`${API_URL}/billing/me`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' }),
      ]);

      const statsJson = await statsRes.json();
      const billingJson = await billingRes.json();

      if (statsRes.ok && statsJson.success) setStats(statsJson.data);
      if (billingRes.ok && billingJson.success) setBillingData(billingJson.data);
    } catch (err) {
      console.warn('[account] Error fetching billing stats:', err.message);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMsg({ type: '', text: '' });
    try {
      setProfileLoading(true);
      await updateProfile({ name, avatarUrl });
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassMsg({ type: '', text: '' });
    try {
      setPassLoading(true);
      await changePassword(currentPassword, newPassword);
      setPassMsg({ type: 'success', text: 'Password changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPassMsg({ type: 'error', text: err.message });
    } finally {
      setPassLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setDeleteLoading(true);
      await deleteAccount();
      navigate('/login');
    } catch (err) {
      alert(err.message || 'Failed to delete account');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setCancelLoading(true);
      const res = await fetch(`${API_URL}/billing/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }
      await checkAuth();
      await fetchStatsAndBilling();
      setShowCancelModal(false);
    } catch (err) {
      alert(err.message || 'Error cancelling subscription');
    } finally {
      setCancelLoading(false);
    }
  };

  // Initials fallback calculation
  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  const planName = (user?.plan || 'free').toUpperCase();
  const runsUsed = billingData?.usage?.runsUsed ?? stats?.quotaUsage?.used ?? 0;
  const runsLimit = billingData?.usage?.runsLimit ?? stats?.quotaUsage?.limit ?? 3;
  const runsPct = Math.min(100, Math.round((runsUsed / runsLimit) * 100));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      
      {/* Account Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#ECEAE5] dark:border-[#26262F] pb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#6C63FF] text-white font-extrabold text-2xl flex items-center justify-center shadow-md overflow-hidden shrink-0">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading text-[var(--text-color)] flex items-center gap-2">
              {user?.name || 'Account'}
              <Badge variant="pill" className="bg-[#6C63FF]/15 text-[#6C63FF] text-xs font-semibold uppercase">
                {planName} Plan
              </Badge>
            </h1>
            <p className="text-sm text-[#6B6B70] dark:text-[#98989F]">{user?.email}</p>
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={logout} icon={Trash2}>
          Sign Out
        </Button>
      </div>

      {/* Tabs Header */}
      <div className="flex items-center gap-2 border-b border-[#ECEAE5] dark:border-[#26262F] overflow-x-auto pb-1">
        {[
          { id: 'profile', label: 'Profile', icon: User },
          { id: 'websites', label: 'My Websites', icon: Globe },
          { id: 'usage', label: 'Billing & Usage', icon: BarChart3 },
          { id: 'activity', label: 'Activity', icon: Activity },
          { id: 'settings', label: 'Settings & API Keys', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#6C63FF] text-white shadow-sm'
                  : 'text-[#6B6B70] dark:text-[#98989F] hover:text-[var(--text-color)] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Profile */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <GlassPanel className="p-6 sm:p-8 space-y-6">
              <div>
                <h2 className="text-lg font-bold font-heading text-[var(--text-color)] mb-1">
                  Personal Information
                </h2>
                <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">
                  Update your display name and avatar image.
                </p>
              </div>

              {profileMsg.text && (
                <div className={`p-4 rounded-2xl text-sm flex items-center gap-3 ${
                  profileMsg.type === 'success' ? 'bg-[#8FB8A8]/15 text-[#8FB8A8]' : 'bg-[#F08A7E]/15 text-[#F08A7E]'
                }`}>
                  {profileMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                  <span>{profileMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] mb-1.5">
                    Full Name
                  </label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    startIcon={User}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] mb-1.5">
                    Avatar Image URL
                  </label>
                  <Input
                    type="url"
                    placeholder="https://example.com/photo.jpg"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    startIcon={Globe}
                  />
                  <p className="text-[11px] text-[#6B6B70] dark:text-[#98989F] mt-1">
                    Leave blank to use your name initials as avatar.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] mb-1.5">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    startIcon={ShieldCheck}
                    className="opacity-70 cursor-not-allowed"
                  />
                </div>

                <Button type="submit" variant="primary" size="md" disabled={profileLoading}>
                  {profileLoading ? 'Saving...' : 'Save Profile'}
                </Button>
              </form>
            </GlassPanel>

            <Card hoverEffect={false} className="p-6 border-red-500/20 dark:border-red-500/20 bg-red-500/5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-red-500 mb-1">Delete Account</h3>
                  <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">
                    Permanently delete your account and remove all associated simulation data.
                  </p>
                </div>
                <Button variant="friction" size="sm" onClick={() => setShowDeleteModal(true)} icon={Trash2}>
                  Delete Account
                </Button>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-5">
            <GlassPanel className="p-6 sm:p-8 space-y-6">
              <div>
                <h2 className="text-lg font-bold font-heading text-[var(--text-color)] mb-1 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-[#6C63FF]" />
                  Change Password
                </h2>
                <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">
                  Ensure your account is using a strong password.
                </p>
              </div>

              {passMsg.text && (
                <div className={`p-4 rounded-2xl text-sm flex items-center gap-3 ${
                  passMsg.type === 'success' ? 'bg-[#8FB8A8]/15 text-[#8FB8A8]' : 'bg-[#F08A7E]/15 text-[#F08A7E]'
                }`}>
                  {passMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                  <span>{passMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] mb-1.5">
                    Current Password
                  </label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] mb-1.5">
                    New Password
                  </label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" variant="secondary" size="md" disabled={passLoading} className="w-full">
                  {passLoading ? 'Updating Password...' : 'Update Password'}
                </Button>
              </form>
            </GlassPanel>
          </div>
        </div>
      )}

      {/* Tab 2: My Websites */}
      {activeTab === 'websites' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold font-heading text-[var(--text-color)] mb-1">
                Tested Websites
              </h2>
              <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">
                Overview of all domains you've tested with Personify.
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/app/new-run')}
              icon={Play}
            >
              New Simulation
            </Button>
          </div>

          {statsLoading ? (
            <div className="py-12 flex justify-center">
              <div className="w-8 h-8 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !stats?.websites?.length ? (
            <GlassPanel className="p-12 text-center max-w-lg mx-auto">
              <img src="/assets/hero-scene.png" alt="Empty" className="w-40 mx-auto mb-4 opacity-50 object-contain" />
              <h3 className="text-lg font-bold text-[var(--text-color)] mb-2">No Websites Tested Yet</h3>
              <p className="text-xs text-[#6B6B70] dark:text-[#98989F] mb-6">
                Enter any public or local URL to simulate realistic user browsing behavior.
              </p>
              <Button variant="primary" size="md" onClick={() => navigate('/app/new-run')} icon={Play}>
                Start First Simulation
              </Button>
            </GlassPanel>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stats.websites.map((site) => (
                <Card key={site.domain} hoverEffect className="p-6 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${site.domain}&sz=64`}
                        alt={site.domain}
                        onError={(e) => { e.target.style.display = 'none'; }}
                        className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/5 p-1 shrink-0"
                      />
                      <div className="truncate">
                        <h3 className="font-bold text-base text-[var(--text-color)] truncate">
                          {site.domain}
                        </h3>
                        <p className="text-[11px] text-[#6B6B70] dark:text-[#98989F]">
                          Last tested {new Date(site.lastTestedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#ECEAE5] dark:border-[#26262F] text-center">
                      <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5">
                        <p className="text-[10px] text-[#6B6B70] dark:text-[#98989F] uppercase font-semibold">Runs</p>
                        <p className="text-sm font-extrabold text-[var(--text-color)]">{site.runCount}</p>
                      </div>
                      <div className="p-2 rounded-xl bg-[#8FB8A8]/10">
                        <p className="text-[10px] text-[#8FB8A8] uppercase font-semibold">Best Success</p>
                        <p className="text-sm font-extrabold text-[#8FB8A8]">{site.bestSuccessRate}%</p>
                      </div>
                      <div className="p-2 rounded-xl bg-[#F08A7E]/10">
                        <p className="text-[10px] text-[#F08A7E] uppercase font-semibold">Friction</p>
                        <p className="text-sm font-extrabold text-[#F08A7E]">{site.latestFrictionScore}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate(`/app/new-run?url=${encodeURIComponent(`https://${site.domain}`)}`)}
                      icon={Play}
                      className="w-full text-xs"
                    >
                      Run Again
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Billing & Usage */}
      {activeTab === 'usage' && (
        <div className="space-y-8">
          
          {/* Active Plan Overview Card */}
          <GlassPanel className="p-6 sm:p-8 space-y-6 border-l-4 border-l-[#6C63FF]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold font-heading text-[var(--text-color)]">
                    {planName} Plan
                  </h2>
                  <Badge variant="pill" className="bg-[#6C63FF] text-white text-xs font-bold uppercase">
                    {billingData?.subscription?.status || 'Active'}
                  </Badge>
                </div>
                <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">
                  Billing cycle: {billingData?.subscription?.interval || 'monthly'} • Renewal: {
                    billingData?.subscription?.currentPeriodEnd
                      ? new Date(billingData.subscription.currentPeriodEnd).toLocaleDateString()
                      : 'N/A'
                  }
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/pricing')}
                  icon={Sparkles}
                >
                  Change Plan
                </Button>
                {user?.plan !== 'free' && !billingData?.subscription?.cancelAtPeriodEnd && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCancelModal(true)}
                  >
                    Cancel Subscription
                  </Button>
                )}
              </div>
            </div>

            {/* Quota Usage Meters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#ECEAE5] dark:border-[#26262F]">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-2">
                  <span className="text-[var(--text-color)]">Monthly Runs Used</span>
                  <span className="text-[#6C63FF] font-bold">{runsUsed} / {runsLimit}</span>
                </div>
                <div className="w-full h-3 bg-[#ECEAE5] dark:bg-[#26262F] rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-[#6C63FF] to-[#8FB8A8] rounded-full transition-all duration-500"
                    style={{ width: `${runsPct}%` }}
                  />
                </div>
                <p className="text-[11px] text-[#6B6B70] dark:text-[#98989F] mt-1.5">
                  {Math.max(0, runsLimit - runsUsed)} runs remaining in current billing period.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-2">
                  <span className="text-[var(--text-color)]">Max Personas per Run</span>
                  <span className="text-[#8FB8A8] font-bold">{billingData?.usage?.personasLimit ?? 5} Personas</span>
                </div>
                <div className="w-full h-3 bg-[#ECEAE5] dark:bg-[#26262F] rounded-full overflow-hidden p-0.5">
                  <div className="h-full bg-[#8FB8A8] rounded-full w-full" />
                </div>
                <p className="text-[11px] text-[#6B6B70] dark:text-[#98989F] mt-1.5">
                  Allowed devices: {(billingData?.usage?.allowedDevices || ['desktop']).join(', ')}
                </p>
              </div>
            </div>
          </GlassPanel>

          {/* Payment History Table */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold font-heading text-[var(--text-color)]">
              Payment & Invoice History
            </h3>

            {!billingData?.payments?.length ? (
              <Card hoverEffect={false} className="p-6 text-center text-xs text-[#6B6B70] dark:text-[#98989F]">
                No paid invoices yet. Upgrades and payment receipts will appear here.
              </Card>
            ) : (
              <Card hoverEffect={false} className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F6F3] dark:bg-[#202026] text-[#6B6B70] dark:text-[#98989F] font-semibold border-b border-[#ECEAE5] dark:border-[#26262F]">
                      <tr>
                        <th className="p-4">Date</th>
                        <th className="p-4">Plan & Interval</th>
                        <th className="p-4">Amount</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Payment ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECEAE5] dark:divide-[#26262F]">
                      {billingData.payments.map((p) => (
                        <tr key={p._id || p.razorpayPaymentId}>
                          <td className="p-4 font-medium text-[var(--text-color)]">
                            {new Date(p.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-4 font-semibold text-[var(--text-color)] uppercase">
                            {p.plan} ({p.interval})
                          </td>
                          <td className="p-4 font-extrabold text-[var(--text-color)]">
                            ₹{p.amount}
                          </td>
                          <td className="p-4">
                            <Badge variant="pill" className="bg-[#8FB8A8]/15 text-[#8FB8A8] text-[10px] font-bold">
                              {p.status}
                            </Badge>
                          </td>
                          <td className="p-4 text-right font-mono text-[11px] text-[#6B6B70] dark:text-[#98989F]">
                            {p.razorpayPaymentId || p.razorpayOrderId}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>

          {/* Runs Per Month Chart */}
          <GlassPanel className="p-6 sm:p-8 space-y-4">
            <h3 className="text-base font-bold font-heading text-[var(--text-color)]">
              Simulation Activity Trend
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.runsPerMonth || []}>
                  <XAxis dataKey="month" stroke="#98989F" fontSize={12} tickLine={false} />
                  <YAxis stroke="#98989F" fontSize={12} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface-color)',
                      borderColor: 'var(--border-color)',
                      borderRadius: '16px',
                      color: 'var(--text-color)',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" fill="#6C63FF" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassPanel>

        </div>
      )}

      {/* Tab 4: Activity */}
      {activeTab === 'activity' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-heading text-[var(--text-color)]">
              Recent Activity
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/app/dashboard')}>
              View All Dashboard Runs
            </Button>
          </div>

          {statsLoading ? (
            <div className="py-12 flex justify-center">
              <div className="w-8 h-8 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !stats?.websites?.length ? (
            <GlassPanel className="p-12 text-center">
              <p className="text-sm text-[#6B6B70] dark:text-[#98989F]">No recent runs found.</p>
            </GlassPanel>
          ) : (
            <GlassPanel className="p-6 space-y-4">
              <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">
                Showing domains and test runs for your account.
              </p>
              <div className="divide-y divide-[#ECEAE5] dark:divide-[#26262F]">
                {stats.websites.map((site) => (
                  <div key={site.domain} className="py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-[#6C63FF]" />
                      <div>
                        <p className="text-sm font-bold text-[var(--text-color)]">{site.domain}</p>
                        <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">
                          {site.runCount} simulations run • Last active {new Date(site.lastTestedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/app/dashboard?domain=${encodeURIComponent(site.domain)}`)}
                      icon={ArrowUpRight}
                    >
                      View
                    </Button>
                  </div>
                ))}
              </div>
            </GlassPanel>
          )}
        </div>
      )}

      {/* Tab 5: Settings & API Keys */}
      {activeTab === 'settings' && (
        <SettingsTabSection user={user} checkAuth={checkAuth} />
      )}

      {/* Delete Account Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Account">
        <div className="space-y-4">
          <p className="text-sm text-[#6B6B70] dark:text-[#98989F]">
            Are you sure you want to delete your Personify account? This action is permanent and cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-3 pt-4">
            <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="friction"
              size="sm"
              onClick={handleDeleteAccount}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting...' : 'Permanently Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Subscription Modal */}
      <Modal isOpen={showCancelModal} onClose={() => setShowCancelModal(false)} title="Cancel Subscription">
        <div className="space-y-4">
          <p className="text-sm text-[#6B6B70] dark:text-[#98989F]">
            Are you sure you want to cancel your subscription? You will maintain full access to your plan features until the end of the current billing period.
          </p>
          <div className="flex items-center justify-end gap-3 pt-4">
            <Button variant="ghost" size="sm" onClick={() => setShowCancelModal(false)}>
              Keep Subscription
            </Button>
            <Button
              variant="friction"
              size="sm"
              onClick={handleCancelSubscription}
              disabled={cancelLoading}
            >
              {cancelLoading ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
