import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Trash2, Dumbbell, Layers, Activity, Search, Filter, Check, Clock, 
  MapPin, Repeat, Timer, ClipboardList, X, ChevronRight, ArrowRight, Play, 
  Save, Calendar as CalendarIcon, ChevronLeft, Users, Shield, LogOut, 
  Lock, Globe, UserPlus, Settings, Moon, Sun
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

class ApiClient {
  token: string | null = localStorage.getItem('token');

  async request(endpoint: string, options: RequestInit = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    
    if (response.status === 401) {
      this.logout();
      // window.location.reload(); // Optional: force reload
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'API Request Failed');
    }

    return response.json();
  }

  async login(username, password) {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const data = await this.request('/api/v1/login/access-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });
    
    this.token = data.access_token;
    localStorage.setItem('token', data.access_token);
    return this.getMe();
  }

  logout() {
    this.token = null;
    localStorage.removeItem('token');
  }

  async getMe() {
    return this.request('/api/v1/users/me');
  }
}

const api = new ApiClient();

const CATEGORIES = {
  Chest: ['Pectorals (Upper)', 'Pectorals (Lower)', 'Pectorals (Inner)'],
  Back: ['Latissimus Dorsi', 'Trapezius', 'Rhomboids', 'Lower Back'],
  Shoulders: ['Anterior Deltoid', 'Lateral Deltoid', 'Posterior Deltoid', 'Rotator Cuff'],
  Arms: ['Biceps', 'Triceps', 'Forearms'],
  Legs: ['Quadriceps', 'Hamstrings', 'Calves', 'Glutes', 'Adductors'],
  Core: ['Rectus Abdominis', 'Obliques', 'Transverse Abdominis'],
  Olympic: ['Full Body', 'Posterior Chain', 'Hips', 'Trapezius'],
  Plyometrics: ['Quadriceps', 'Hamstrings', 'Calves', 'Glutes', 'Full Body'],
  Cardio: ['LISS', 'HIIT', 'Sprint', 'Endurance'],
  Stretches: ['Static', 'Dynamic', 'PNF', 'Myofascial Release']
};
const CATEGORY_KEYS = Object.keys(CATEGORIES);
const TRACKING_TYPES = [
  { id: 'weight_reps', label: 'Weight & Reps', icon: Dumbbell },
  { id: 'reps_only', label: 'Reps Only', icon: Repeat },
  { id: 'time', label: 'Duration', icon: Clock },
  { id: 'distance_time', label: 'Distance & Time', icon: MapPin },
  { id: 'weight_time', label: 'Weight & Time', icon: Timer }
];

const Header = ({ userProfile, onLogout, darkMode, toggleDarkMode }) => (
  <header className="bg-slate-900 dark:bg-black text-white p-4 shadow-lg sticky top-0 z-50 transition-colors duration-300">
    <div className="max-w-6xl mx-auto flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="bg-emerald-500 p-2 rounded-lg">
          <Dumbbell className="w-6 h-6 text-slate-900" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">FitStack</h1>
          {userProfile && (
             <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-emerald-400">
               <span>{userProfile.role || 'User'}</span>
             </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={toggleDarkMode} className="p-2 bg-slate-800 dark:bg-slate-900 rounded-lg hover:text-emerald-400 transition-colors">
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        {userProfile && (
          <div className="flex items-center gap-4">
             <div className="hidden md:block text-right text-sm font-bold">{userProfile.email}</div>
             <button onClick={onLogout} className="p-2 bg-slate-800 dark:bg-slate-900 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-colors"><LogOut className="w-4 h-4" /></button>
          </div>
        )}
      </div>
    </div>
  </header>
);

const ExerciseCard = ({ exercise, onDelete, compact = false, onSelect, isSelected = false, userId }) => {
  const categories = exercise.categories || [];
  const trackingType = TRACKING_TYPES.find(t => t.id === exercise.tracking_type) || TRACKING_TYPES[0];
  const TypeIcon = trackingType.icon;
  const isOwner = exercise.owner_id === userId;
  const canDelete = onDelete && isOwner;

  if (compact) {
    return (
      <div onClick={onSelect} className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between group ${isSelected ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 ring-1 ring-emerald-500' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700'}`}>
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-md ${isSelected ? 'bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}><TypeIcon className="w-4 h-4" /></div>
          <div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">{exercise.name} {exercise.is_public ? <Globe className="w-3 h-3 text-slate-400" /> : <Lock className="w-3 h-3 text-amber-500" />}</div>
            <div className="text-xs text-slate-400 dark:text-slate-500">{categories.join(', ')}</div>
          </div>
        </div>
        {isSelected ? <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> : <Plus className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 dark:group-hover:text-emerald-400" />}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all p-4 flex flex-col gap-3 group relative overflow-hidden h-full">
      <div className={`absolute top-0 left-0 w-1 h-full ${exercise.is_public ? 'bg-blue-500' : 'bg-amber-500'}`}></div>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex justify-between items-start pr-2">
            <div className="flex flex-wrap gap-1 mb-2">{categories.map((cat) => <span key={cat} className="text-xs font-bold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">{cat}</span>)}</div>
            <div title={exercise.is_public ? "Public" : "Private"}>{exercise.is_public ? <Globe className="w-4 h-4 text-slate-300 dark:text-slate-600" /> : <Lock className="w-4 h-4 text-amber-400" />}</div>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 leading-tight">{exercise.name}</h3>
        </div>
        {canDelete && <button onClick={() => onDelete(exercise.id)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1 ml-2"><Trash2 className="w-4 h-4" /></button>}
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700"><TypeIcon className="w-3.5 h-3.5" /><span className="font-medium">Tracks: {trackingType.label}</span></div>
      <div className="flex flex-wrap gap-2 mt-auto pt-2 border-t border-slate-50 dark:border-slate-800">
        {exercise.subcategories && exercise.subcategories.map((sub, idx) => <span key={idx} className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 font-medium">{sub}</span>)}
      </div>
    </div>
  );
};

const AuthView = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        const user = await api.login(email, password);
        onLogin(user);
      } else {
        await api.request('/api/v1/users/register', { 
          method: 'POST', 
          body: JSON.stringify({ email, password, full_name: 'New User' }) 
        });
        const user = await api.login(email, password);
        onLogin(user);
      }
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 dark:bg-black flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-8 shadow-2xl transition-colors">
        <div className="text-center mb-8">
           <div className="bg-emerald-100 dark:bg-emerald-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 dark:text-emerald-400"><Dumbbell className="w-8 h-8" /></div>
           <h2 className="text-2xl font-bold text-slate-800 dark:text-white">FitStack</h2>
           <p className="text-slate-500 dark:text-slate-400">Self-Hosted Fitness (FastAPI)</p>
        </div>
        {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm mb-6 flex items-center gap-2"><X className="w-4 h-4" /> {error}</div>}
        <form onSubmit={handleAuth} className="space-y-4">
           <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Email</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl outline-none focus:border-emerald-500" /></div>
           <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Password</label><input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl outline-none focus:border-emerald-500" /></div>
           <button type="submit" disabled={loading} className="w-full bg-slate-900 dark:bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-emerald-700 transition-transform active:scale-[0.98]">{loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}</button>
        </form>
        <div className="mt-6 text-center pt-2"><button onClick={() => setIsLogin(!isLogin)} className="text-emerald-600 dark:text-emerald-400 font-medium text-sm hover:underline">{isLogin ? "Need an account? Sign up" : "Already have an account? Login"}</button></div>
      </div>
    </div>
  );
};

const ExercisesView = ({ userProfile, onDeleteExercise, darkMode }) => {
  const [exercises, setExercises] = useState([]);
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([CATEGORY_KEYS[0]]);
  const [selectedSubcats, setSelectedSubcats] = useState([]);
  const [trackingType, setTrackingType] = useState('weight_reps');

  useEffect(() => {
    api.request('/api/v1/exercises/')
      .then(data => setExercises(data))
      .catch(console.error);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const newEx = await api.request('/api/v1/exercises/', {
        method: 'POST',
        body: JSON.stringify({
          name, categories: selectedCategories, subcategories: selectedSubcats, 
          tracking_type: trackingType, is_public: isPublic
        })
      });
      setExercises(prev => [newEx, ...prev]);
      setName(''); setSelectedSubcats([]);
    } catch (err) { console.error("Error creating exercise:", err); }
  };

  const handleDelete = async (id) => {
    if(window.confirm('Delete?')) {
        await api.request(`/api/v1/exercises/${id}`, { method: 'DELETE' });
        setExercises(prev => prev.filter(e => e.id !== id));
    }
  };

  const handleToggleCategory = (cat) => setSelectedCategories(p => p.includes(cat) && p.length===1 ? p : p.includes(cat) ? p.filter(c=>c!==cat) : [...p,cat]);
  const handleToggleSubcat = (sub) => setSelectedSubcats(p => p.includes(sub) ? p.filter(s=>s!==sub) : [...p,sub]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
      <div className="lg:col-span-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sticky top-24">
          <h2 className="font-bold text-xl mb-6 text-slate-800 dark:text-white flex items-center gap-2"><Layers className="w-5 h-5 text-emerald-500" /> New Exercise</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div><label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 ml-1">Name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Bench Press" className="w-full p-3 border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" /></div>
            <div><label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 ml-1">Type</label><div className="flex flex-wrap gap-2">{TRACKING_TYPES.map(t => <button key={t.id} type="button" onClick={()=>setTrackingType(t.id)} className={`px-3 py-2 rounded-lg text-xs font-bold border ${trackingType===t.id?'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400':'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-300'}`}>{t.label}</button>)}</div></div>
            <div><label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 ml-1">Categories</label><div className="flex flex-wrap gap-2">{CATEGORY_KEYS.map(c => <button key={c} type="button" onClick={()=>handleToggleCategory(c)} className={`px-2 py-1 rounded text-xs border ${selectedCategories.includes(c)?'bg-emerald-500 text-white border-emerald-500':'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-300'}`}>{c}</button>)}</div></div>
            <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer"><input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-5 h-5 text-emerald-500 rounded" /><div><div className="font-bold text-slate-700 dark:text-slate-200 text-sm">Make Public</div><div className="text-xs text-slate-400">Share with all users</div></div></label>
            <button type="submit" className="w-full bg-slate-900 dark:bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold">Add Exercise</button>
          </form>
        </div>
      </div>
      <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
        {exercises.map(ex => <ExerciseCard key={ex.id} exercise={ex} userId={userProfile.id} onDelete={handleDelete} />)}
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [currentView, setCurrentView] = useState('exercises');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.getMe().then(setUser).catch(() => api.logout());
    }
  }, []);

  const handleLogout = () => {
    api.logout();
    setUser(null);
  };

  if (!user) return <div className={darkMode ? "dark" : ""}><AuthView onLogin={setUser} /></div>;

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-slate-50 dark:bg-black font-sans text-slate-900 dark:text-white transition-colors pb-24">
        <Header userProfile={user} onLogout={handleLogout} darkMode={darkMode} toggleDarkMode={() => setDarkMode(!darkMode)} />
        <main className="max-w-6xl mx-auto p-4">
          <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
             <button onClick={() => setCurrentView('exercises')} className={`px-4 py-2 rounded-full font-bold transition-all ${currentView === 'exercises' ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-slate-900 text-slate-500'}`}>Library</button>
          </div>
          {currentView === 'exercises' && <ExercisesView userProfile={user} darkMode={darkMode} onDeleteExercise={() => {}} />}
        </main>
      </div>
    </div>
  );
}
