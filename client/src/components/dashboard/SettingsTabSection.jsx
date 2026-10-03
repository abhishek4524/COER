import React, { useState } from 'react';
import { updateUserSettings, generateApiKey, revokeApiKey } from '../../services/api';
import { GlassPanel } from '../ui/GlassPanel';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import Modal from '../ui/Modal';
import { KeyRound, ShieldCheck, Copy, CheckCircle2 } from 'lucide-react';

export default function SettingsTabSection({ user, checkAuth }) {
  const [theme, setTheme] = useState(user?.settings?.theme || 'dark');
  const [defaultDevice, setDefaultDevice] = useState(user?.settings?.defaultDevice || 'desktop');
  const [defaultPersonaCount, setDefaultPersonaCount] = useState(user?.settings?.defaultPersonaCount || 5);
  const [settingsMsg, setSettingsMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  // API Key modal states
  const [apiKeys, setApiKeys] = useState(user?.apiKeys || []);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [generatedRawKey, setGeneratedRawKey] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsMsg({ type: '', text: '' });
    try {
      setLoading(true);
      await updateUserSettings({ theme, defaultDevice, defaultPersonaCount });
      if (checkAuth) await checkAuth();
      setSettingsMsg({ type: 'success', text: 'Preferences updated successfully.' });
    } catch (err) {
      setSettingsMsg({ type: 'error', text: err.message || 'Failed to save preferences' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApiKey = async (e) => {
    e.preventDefault();
    try {
      const res = await generateApiKey(keyName || 'CLI Access Key');
      setGeneratedRawKey(res.apiKey);
      setApiKeys((prev) => [...prev, res.keyInfo]);
      setKeyName('');
      if (checkAuth) await checkAuth();
    } catch (err) {
      alert(err.message || 'Failed to generate API key');
    }
  };

  const handleRevokeKey = async (keyId) => {
    if (!window.confirm('Are you sure you want to revoke this API key? Apps using it will lose access.')) return;
    try {
      await revokeApiKey(keyId);
      setApiKeys((prev) => prev.filter((k) => (k._id || k.id) !== keyId));
      if (checkAuth) await checkAuth();
    } catch (err) {
      alert(err.message || 'Failed to revoke API key');
    }
  };

  return (
    <div className="space-y-8">
      {/* Defaults & Theme Preferences */}
      <GlassPanel className="p-6 sm:p-8 space-y-6">
        <div>
          <h2 className="text-lg font-bold font-heading text-[var(--text-color)] mb-1">
            Default Preferences
          </h2>
          <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">
            Set default configuration presets for your UX simulation runs.
          </p>
        </div>

        {settingsMsg.text && (
          <div className={`p-4 rounded-2xl text-sm flex items-center gap-3 ${
            settingsMsg.type === 'success' ? 'bg-[#8FB8A8]/15 text-[#8FB8A8]' : 'bg-[#F08A7E]/15 text-[#F08A7E]'
          }`}>
            <span>{settingsMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] mb-1.5">
                Theme
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full bg-[#161B22] border border-white/10 text-gray-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#6C63FF]"
              >
                <option value="dark">Dark Theme</option>
                <option value="light">Light Theme</option>
                <option value="system">System Default</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] mb-1.5">
                Default Device Target
              </label>
              <select
                value={defaultDevice}
                onChange={(e) => setDefaultDevice(e.target.value)}
                className="w-full bg-[#161B22] border border-white/10 text-gray-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#6C63FF]"
              >
                <option value="desktop">Desktop Chrome (1440x900)</option>
                <option value="mobile">Mobile Safari (390x844)</option>
                <option value="tablet">Tablet iPad (768x1024)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] mb-1.5">
                Default Persona Count ({defaultPersonaCount})
              </label>
              <input
                type="range"
                min="1"
                max="50"
                value={defaultPersonaCount}
                onChange={(e) => setDefaultPersonaCount(Number(e.target.value))}
                className="w-full accent-[#6C63FF] mt-2"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-white/10">
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </form>
      </GlassPanel>

      {/* API Key Management */}
      <GlassPanel className="p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold font-heading text-[var(--text-color)] mb-1 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-[#6C63FF]" />
              API Key Access (CLI & CI/CD)
            </h2>
            <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">
              Generate secret API keys to trigger Personify simulations programmatically from CLI or GitHub Actions.
            </p>
          </div>

          <Button variant="primary" size="sm" onClick={() => { setGeneratedRawKey(''); setShowKeyModal(true); }}>
            + Generate New Key
          </Button>
        </div>

        {apiKeys.length === 0 ? (
          <p className="text-xs text-gray-400 py-4">No active API keys generated yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="border-b border-white/10 text-gray-400 uppercase text-[10px]">
                <tr>
                  <th className="pb-3 px-3">Name</th>
                  <th className="pb-3 px-3">Prefix</th>
                  <th className="pb-3 px-3">Created</th>
                  <th className="pb-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {apiKeys.map((k) => (
                  <tr key={k._id || k.id} className="hover:bg-white/5">
                    <td className="py-3 px-3 font-semibold text-white">{k.name}</td>
                    <td className="py-3 px-3 font-mono text-[#6C63FF]">{k.keyPrefix}</td>
                    <td className="py-3 px-3 text-gray-400">{new Date(k.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleRevokeKey(k._id || k.id)}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>

      {/* API Key Modal */}
      {showKeyModal && (
        <Modal isOpen={true} onClose={() => setShowKeyModal(false)} title="Generate API Key">
          {generatedRawKey ? (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs font-semibold">
                ⚠️ Save this key now! It will never be displayed again.
              </div>

              <div>
                <label className="text-xs font-medium text-gray-300 block mb-1">Your Secret API Key</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedRawKey}
                    className="flex-1 bg-black/40 border border-white/10 text-xs font-mono text-emerald-400 rounded-xl px-3 py-2.5"
                  />
                  <Button
                    variant="primary"
                    className="text-xs py-2 px-3"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedRawKey);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button variant="secondary" onClick={() => setShowKeyModal(false)}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateApiKey} className="space-y-4 py-2">
              <div>
                <label className="text-xs font-medium text-gray-300 block mb-1">Key Name</label>
                <Input
                  type="text"
                  placeholder="e.g. GitHub Actions Production Pipeline"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <Button type="button" variant="secondary" onClick={() => setShowKeyModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Generate Key
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
