import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProjects, createProject, updateProject, deleteProject } from '../services/api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  // Form state
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [defaultGoal, setDefaultGoal] = useState('');
  const [defaultPersonaGroup, setDefaultPersonaGroup] = useState('all');
  const [defaultDevice, setDefaultDevice] = useState('desktop');
  const [formError, setFormError] = useState('');

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const list = await getProjects();
      setProjects(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const openCreateModal = () => {
    setEditingProject(null);
    setName('');
    setDomain('');
    setDefaultGoal('Test overall user experience and find conversion friction');
    setDefaultPersonaGroup('all');
    setDefaultDevice('desktop');
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (p) => {
    setEditingProject(p);
    setName(p.name);
    setDomain(p.domain);
    setDefaultGoal(p.defaultGoal || '');
    setDefaultPersonaGroup(p.defaultPersonaGroup || 'all');
    setDefaultDevice(p.defaultDevice || 'desktop');
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    try {
      if (editingProject) {
        await updateProject(editingProject._id || editingProject.id, {
          name,
          defaultGoal,
          defaultPersonaGroup,
          defaultDevice,
        });
      } else {
        await createProject({
          name,
          domain,
          defaultGoal,
          defaultPersonaGroup,
          defaultDevice,
        });
      }
      setShowModal(false);
      fetchProjects();
    } catch (err) {
      setFormError(err.message || 'Failed to save project');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => (p._id || p.id) !== id));
    } catch (err) {
      alert(err.message || 'Failed to delete project');
    }
  };

  const handleRunAgain = (p) => {
    const targetUrl = p.domain.startsWith('http') ? p.domain : `https://${p.domain}`;
    navigate(`/app/new-run?url=${encodeURIComponent(targetUrl)}&goal=${encodeURIComponent(p.defaultGoal)}&group=${p.defaultPersonaGroup}&device=${p.defaultDevice}`);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Saved Projects</h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage your saved website projects, preset goals, and launch 1-click UX re-tests.
          </p>
        </div>
        <Button variant="primary" onClick={openCreateModal}>
          + Add Project
        </Button>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-[#6C63FF]/10 text-[#6C63FF] flex items-center justify-center text-2xl mb-4">
            🌐
          </div>
          <h3 className="text-lg font-bold text-white mb-1">No Saved Projects Yet</h3>
          <p className="text-gray-400 text-sm max-w-sm mb-6">
            Save your target websites to track UX friction trends and re-test with single-click presets.
          </p>
          <Button variant="primary" onClick={openCreateModal}>
            Add First Project
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => {
            const id = p._id || p.id;
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${p.domain}&sz=64`;

            return (
              <Card key={id} className="p-5 flex flex-col justify-between hover:border-white/20 transition-all space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={faviconUrl}
                        alt={p.name}
                        className="w-8 h-8 rounded-lg bg-white/10 p-1 border border-white/10 object-contain"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <div>
                        <h3 className="font-bold text-white text-base leading-tight">{p.name}</h3>
                        <p className="text-xs text-[#6C63FF] font-medium">{p.domain}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(p)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white text-xs"
                        title="Edit Project"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 text-xs"
                        title="Delete Project"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-gray-300 bg-white/5 p-2.5 rounded-xl border border-white/5 line-clamp-2">
                    🎯 {p.defaultGoal}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="bg-black/30 p-2 rounded-lg">
                      <span className="text-gray-400 block text-[10px] uppercase">Best Success</span>
                      <span className="font-bold text-emerald-400">{p.bestSuccessRate ?? 0}%</span>
                    </div>
                    <div className="bg-black/30 p-2 rounded-lg">
                      <span className="text-gray-400 block text-[10px] uppercase">Total Runs</span>
                      <span className="font-bold text-white">{p.runCount ?? 0} runs</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-gray-400">
                    {p.lastTestedAt ? `Tested ${new Date(p.lastTestedAt).toLocaleDateString()}` : 'Never tested'}
                  </span>

                  <Button variant="primary" className="text-xs py-1.5 px-3" onClick={() => handleRunAgain(p)}>
                    ⚡ 1-Click Test
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Project Modal */}
      {showModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowModal(false)}
          title={editingProject ? 'Edit Project' : 'Create New Project'}
        >
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {formError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
                {formError}
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1">Project Name</label>
              <Input
                type="text"
                placeholder="e.g. Acme Checkout Store"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1">Domain</label>
              <Input
                type="text"
                placeholder="e.g. myshop.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={!!editingProject}
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1">Default Test Goal</label>
              <Input
                type="text"
                placeholder="e.g. Complete purchase checkout flow"
                value={defaultGoal}
                onChange={(e) => setDefaultGoal(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-300 block mb-1">Persona Group</label>
                <select
                  value={defaultPersonaGroup}
                  onChange={(e) => setDefaultPersonaGroup(e.target.value)}
                  className="w-full bg-[#161B22] border border-white/10 text-gray-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#6C63FF]"
                >
                  <option value="all">All 50 Personas</option>
                  <option value="gen-z">Gen-Z Digital Natives</option>
                  <option value="seniors">Senior Users</option>
                  <option value="impulsive">Impulsive Shoppers</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-300 block mb-1">Device Target</label>
                <select
                  value={defaultDevice}
                  onChange={(e) => setDefaultDevice(e.target.value)}
                  className="w-full bg-[#161B22] border border-white/10 text-gray-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#6C63FF]"
                >
                  <option value="desktop">Desktop Chrome</option>
                  <option value="mobile">Mobile Safari</option>
                  <option value="slow">Slow 3G Mobile</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                {editingProject ? 'Save Changes' : 'Create Project'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
