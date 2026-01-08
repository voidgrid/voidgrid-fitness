import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { 
  Plus, Trash2, Dumbbell, Layers, Activity, Search, Filter, Check, Clock, 
  MapPin, Repeat, Timer, ClipboardList, X, ChevronRight, ArrowRight, Play, 
  Save, Calendar as CalendarIcon, ChevronLeft, Users, Shield, LogOut, 
  Lock, Globe, UserPlus, Settings, Moon, Sun, AlertCircle, Info
} from 'lucide-react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
// Import the separated muscle map configuration
import { MUSCLE_MAP } from './muscleMap';

const API_URL = import.meta.env.VITE_API_URL || '';

// --- API Client ---
class ApiClient {
  token: string | null = localStorage.getItem('token');
  async request(endpoint: string, options: RequestInit = {}) {
    const headers = { 'Content-Type': 'application/json', ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}), ...options.headers };
    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (response.status === 401) this.logout();
    if (!response.ok) { const error = await response.json(); throw new Error(error.detail || 'API Request Failed'); }
    return response.json();
  }
  async login(username, password) {
    const formData = new URLSearchParams(); formData.append('username', username); formData.append('password', password);
    const data = await this.request('/api/v1/users/login/access-token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formData });
    this.token = data.access_token; localStorage.setItem('token', data.access_token); return this.getMe();
  }
  logout() { this.token = null; localStorage.removeItem('token'); window.location.reload(); }
  async getMe() { return this.request('/api/v1/users/me'); }
  async getConfig() { return this.request('/api/v1/users/config'); }
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

// --- 3D Components ---

const EcorcheModel = ({ activeMuscles, darkMode, activeCategories, onMeshClick, highlightedMesh }) => {
  const { scene } = useGLTF('/scene.gltf');
  
  // Colors
  const baseColor = new THREE.Color(darkMode ? "#64748b" : "#cbd5e1");
  const primaryColor = new THREE.Color("#ef4444"); // Red (Hot)
  const secondaryColor = new THREE.Color("#fca5a5"); // Pink (Warm)
  const debugColor = new THREE.Color("#3b82f6"); // Blue (Debug Select)

  useFrame(() => {
    if (!scene) return;
    
    scene.traverse((child) => {
      if (child.isMesh) {
        if (!child.userData.originalMaterial) {
          child.userData.originalMaterial = child.material.clone();
          child.material = child.userData.originalMaterial;
        }

        let targetColor = baseColor;
        const nameLower = child.name.toLowerCase();
        
        // Debug Highlight
        if (highlightedMesh === child.name) {
             child.material.color.lerp(debugColor, 0.3);
             return;
        }

        // 1. Primary Selection Logic
        const isPrimary = activeMuscles.some(muscle => {
            // A. Check for specific map entry (e.g., "Pectorals (Upper)")
            let keys = MUSCLE_MAP[muscle];

            // B. If not found, check root map entry (e.g., "Pectorals")
            if (!keys) {
                const rootName = muscle.split(' (')[0];
                keys = MUSCLE_MAP[rootName];
            }

            // C. Fallback: Check if mesh name contains the muscle name itself
            if (!keys) keys = [muscle.toLowerCase()];
            
            // Check direct mesh name AND parent name
            const parentName = child.parent ? child.parent.name.toLowerCase() : '';
            
            // Match ANY keyword in the keys array
            return keys.some(k => {
                const key = k.toLowerCase();
                return nameLower.includes(key) || parentName.includes(key);
            });
        });

        // 2. Secondary Selection Logic (Category)
        let isSecondary = false;
        if (!isPrimary && activeCategories.length > 0) {
            // Very loose matching for categories
            if (activeCategories.includes('Chest') && (nameLower.includes('chest') || nameLower.includes('pec'))) isSecondary = true;
            if (activeCategories.includes('Back') && (nameLower.includes('lat') || nameLower.includes('trap') || nameLower.includes('dors'))) isSecondary = true;
            if (activeCategories.includes('Legs') && (nameLower.includes('leg') || nameLower.includes('thigh') || nameLower.includes('calf'))) isSecondary = true;
            if (activeCategories.includes('Arms') && (nameLower.includes('arm') || nameLower.includes('bicep') || nameLower.includes('tricep'))) isSecondary = true;
        }

        if (isPrimary) targetColor = primaryColor;
        else if (isSecondary) targetColor = secondaryColor;
        
        child.material.color.lerp(targetColor, 0.1);
      }
    });
  });

  return (
    <primitive 
      object={scene} 
      onClick={(e) => {
        e.stopPropagation();
        const meshName = e.object.name;
        const parentName = e.object.parent ? e.object.parent.name : 'No Parent';
        onMeshClick(meshName, parentName);
      }}
    />
  );
};

const InteractiveBodyModel = ({ selectedMuscles, selectedCategories, darkMode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Debug State
  const [clickedMeshInfo, setClickedMeshInfo] = useState(null);
  const [allMeshes, setAllMeshes] = useState([]);

  const onCreated = (state) => {
     const meshNames = [];
     state.scene.traverse(child => {
         if(child.isMesh) meshNames.push(child.name);
     });
     setAllMeshes([...new Set(meshNames)].sort());
  };

  return (
    <div className="flex flex-col gap-2">
        <div className="h-[450px] w-full rounded-xl overflow-hidden bg-gradient-to-b from-slate-50 to-slate-200 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 relative group">
          
          <div className="absolute top-2 left-2 z-10 bg-black/70 text-white text-[10px] p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
             <div><strong>Debug Info</strong></div>
             {clickedMeshInfo ? (
                 <>
                   <div>Mesh: <span className="text-emerald-400">{clickedMeshInfo.mesh}</span></div>
                   <div>Parent: <span className="text-blue-400">{clickedMeshInfo.parent}</span></div>
                 </>
             ) : (
                 <div>Click 3D model to identify parts</div>
             )}
          </div>

          <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-slate-400">Loading 3D Model...</div>}>
            {hasError ? (
               <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                 <AlertCircle className="w-8 h-8 mb-2" />
                 <p>Model Error: {errorMsg}</p>
                 <p className="text-[10px] mt-2">Ensure <code>scene.gltf</code> is in <code>frontend/public/</code></p>
               </div>
            ) : (
              <ErrorBoundary setHasError={setHasError} setErrorMsg={setErrorMsg}>
                 <Canvas shadows dpr={[1, 2]} onCreated={onCreated}>
                    <Suspense fallback={null}>
                      <Stage environment="city" intensity={0.5} contactShadow={false} adjustCamera={1.2}>
                        <EcorcheModel 
                            activeMuscles={selectedMuscles} 
                            activeCategories={selectedCategories} 
                            darkMode={darkMode}
                            onMeshClick={(mesh, parent) => setClickedMeshInfo({mesh, parent})}
                            highlightedMesh={clickedMeshInfo?.mesh}
                        />
                      </Stage>
                    </Suspense>
                    <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.75} />
                 </Canvas>
              </ErrorBoundary>
            )}
          </Suspense>
        </div>
        
        <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex justify-between">
                <span>Detected Meshes (Click to Highlight)</span>
                <span>{allMeshes.length} found</span>
            </div>
            <div className="h-20 overflow-y-auto text-[10px] font-mono text-slate-600 dark:text-slate-400 grid grid-cols-2 gap-x-2">
                {allMeshes.map(m => (
                    <div 
                        key={m} 
                        className={`cursor-pointer hover:text-blue-500 truncate ${clickedMeshInfo?.mesh === m ? 'text-blue-600 font-bold bg-blue-100 dark:bg-blue-900/30' : ''}`}
                        onClick={() => setClickedMeshInfo({mesh: m, parent: 'Manual Select'})}
                    >
                        {m}
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

// Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error) { 
      console.error("3D Model Error:", error); 
      this.props.setHasError(true); 
      this.props.setErrorMsg(error.message);
  }
  render() { return this.state.hasError ? null : this.props.children; }
}

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

// --- AUTH VIEW ---
const AuthView = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({ allow_registration: true, allow_password_login: true, oidc_enabled: false });

  useEffect(() => {
    api.getConfig().then(setConfig).catch(console.error);
  }, []);

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

  const handleOIDC = async () => {
    window.location.href = '/api/v1/users/login/oidc';
  };

  return (
    <div className="min-h-screen bg-slate-900 dark:bg-black flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-8 shadow-2xl transition-colors">
        <div className="text-center mb-8">
           <div className="bg-emerald-100 dark:bg-emerald-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 dark:text-emerald-400"><Dumbbell className="w-8 h-8" /></div>
           <h2 className="text-2xl font-bold text-slate-800 dark:text-white">FitStack</h2>
           <p className="text-slate-500 dark:text-slate-400">Self-Hosted Fitness</p>
        </div>
        {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm mb-6 flex items-center gap-2"><X className="w-4 h-4" /> {error}</div>}
        
        {(config.allow_password_login || !isLogin) && (
          <form onSubmit={handleAuth} className="space-y-4">
            <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Email</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl outline-none focus:border-emerald-500" /></div>
            <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Password</label><input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl outline-none focus:border-emerald-500" /></div>
            <button type="submit" disabled={loading} className="w-full bg-slate-900 dark:bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-emerald-700 transition-transform active:scale-[0.98]">{loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}</button>
          </form>
        )}

        <div className="mt-6 space-y-3">
           {config.oidc_enabled && (
             <button type="button" className="w-full border border-slate-200 dark:border-slate-700 py-3 rounded-xl flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium" onClick={handleOIDC}><Globe className="w-4 h-4" /> Continue with OIDC</button>
           )}
           {config.allow_registration && (
             <div className="text-center pt-2"><button onClick={() => setIsLogin(!isLogin)} className="text-emerald-600 dark:text-emerald-400 font-medium text-sm hover:underline">{isLogin ? "Need an account? Sign up" : "Already have an account? Login"}</button></div>
           )}
        </div>
      </div>
    </div>
  );
};

// --- DATA VIEWS ---

const AdminPanel = ({ userProfile }) => {
  const [users, setUsers] = useState([]);
  
  useEffect(() => {
    api.request('/api/v1/users/').then(setUsers).catch(console.error);
  }, []);

  const toggleStatus = async (user) => {
    try {
      const updated = await api.request(`/api/v1/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !user.is_active })
      });
      setUsers(prev => prev.map(u => u.id === user.id ? updated : u));
    } catch (err) { console.error(err); }
  };

  return (
    <div className="animate-fade-in space-y-6">
       <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-emerald-500" /> User Management</h2>
          <div className="space-y-3">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                 <div>
                    <div className="font-bold text-slate-900 dark:text-white">{u.email}</div>
                    <div className="text-xs text-slate-500 uppercase">{u.role}</div>
                 </div>
                 <div className="flex gap-2">
                    <button onClick={() => toggleStatus(u)} className={`px-3 py-1 rounded-lg text-xs font-bold ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{u.is_active ? 'Active' : 'Banned/Pending'}</button>
                 </div>
              </div>
            ))}
          </div>
       </div>
    </div>
  );
};

const WorkoutsView = ({ userProfile, onDeleteWorkout }) => {
  const [workouts, setWorkouts] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [activeTab, setActiveTab] = useState('list');
  const [workoutName, setWorkoutName] = useState('');
  const [selectedExerciseIds, setSelectedExerciseIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    api.request('/api/v1/workouts/').then(setWorkouts).catch(console.error);
    api.request('/api/v1/exercises/').then(setExercises).catch(console.error);
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const newW = await api.request('/api/v1/workouts/', {
        method: 'POST',
        body: JSON.stringify({ name: workoutName, exercise_ids: selectedExerciseIds, is_public: false })
      });
      setWorkouts(p => [newW, ...p]);
      setWorkoutName(''); setSelectedExerciseIds([]); setActiveTab('list');
    } catch(e) { console.error(e); }
  };

  const filteredEx = exercises.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="animate-fade-in">
       <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-xl mb-6 max-w-md mx-auto md:mx-0"><button onClick={() => setActiveTab('create')} className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'create' ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}><Plus className="w-4 h-4" /> Create Template</button><button onClick={() => setActiveTab('list')} className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'list' ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}><ClipboardList className="w-4 h-4" /> My Templates</button></div>
       
       {activeTab === 'create' ? (
         <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
           <form onSubmit={handleSave} className="space-y-6">
             <input value={workoutName} onChange={e=>setWorkoutName(e.target.value)} placeholder="Workout Name" className="w-full p-3 border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl outline-none focus:border-emerald-500" />
             <div>
               <div className="relative mb-3"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search exercises..." className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:border-emerald-500" /></div>
               <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {filteredEx.map(ex => (
                    <ExerciseCard key={ex.id} exercise={ex} compact isSelected={selectedExerciseIds.includes(ex.id)} onSelect={() => setSelectedExerciseIds(p => p.includes(ex.id)?p.filter(i=>i!==ex.id):[...p, ex.id])} />
                  ))}
               </div>
             </div>
             <button type="submit" className="w-full bg-slate-900 dark:bg-emerald-600 text-white font-medium rounded-xl py-3 hover:bg-slate-800 dark:hover:bg-emerald-700">Save Template</button>
           </form>
         </div>
       ) : (
         <div className="space-y-4">
           {workouts.map(w => (
             <div key={w.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                <div className="flex justify-between">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">{w.name}</h3>
                  <button onClick={() => onDeleteWorkout(w.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="text-sm text-slate-500">{w.exercise_ids.length} Exercises</div>
             </div>
           ))}
         </div>
       )}
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

  const handleToggleCategory = (cat) => {
      setSelectedCategories(p => p.includes(cat) && p.length===1 ? p : p.includes(cat) ? p.filter(c=>c!==cat) : [...p,cat]);
  };
  
  const handleToggleSubcat = (sub) => setSelectedSubcats(p => p.includes(sub) ? p.filter(s=>s!==sub) : [...p,sub]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
      <div className="lg:col-span-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sticky top-24">
          <h2 className="font-bold text-xl mb-6 text-slate-800 dark:text-white flex items-center gap-2"><Layers className="w-5 h-5 text-emerald-500" /> New Exercise</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div><label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 ml-1">Name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Bench Press" className="w-full p-3 border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" /></div>
            <div><label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 ml-1">Type</label><div className="flex flex-wrap gap-2">{TRACKING_TYPES.map(t => <button key={t.id} type="button" onClick={()=>setTrackingType(t.id)} className={`px-3 py-2 rounded-lg text-xs font-bold border ${trackingType===t.id?'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400':'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-300'}`}>{t.label}</button>)}</div></div>
            
            {/* Main Categories */}
            <div><label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 ml-1">Categories</label><div className="flex flex-wrap gap-2">{CATEGORY_KEYS.map(c => <button key={c} type="button" onClick={()=>handleToggleCategory(c)} className={`px-2 py-1 rounded text-xs border ${selectedCategories.includes(c)?'bg-emerald-500 text-white border-emerald-500':'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-300'}`}>{c}</button>)}</div></div>
            
            {/* 3D Model & Subcategories */}
            <div className="py-2">
               <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 ml-1 mb-2 block">Target Visualization</label>
               <InteractiveBodyModel selectedMuscles={selectedSubcats} selectedCategories={selectedCategories} darkMode={darkMode} />
               
               {/* Explicit Minor Muscle Selection */}
               <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 ml-1 mt-4 mb-2 block">Select Specific Muscles</label>
               <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border dark:border-slate-700 max-h-[200px] overflow-y-auto flex flex-wrap gap-2">
                  {selectedCategories.map(c => (
                    CATEGORIES[c].map(m => (
                      <button 
                        key={m} 
                        type="button" 
                        onClick={()=>handleToggleSubcat(m)} 
                        className={`text-[10px] px-2 py-1 rounded border transition-colors ${selectedSubcats.includes(m) ? 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}
                      >
                        {m}
                      </button>
                    ))
                  ))}
                  {selectedCategories.length === 0 && <div className="text-xs text-slate-400 p-2 italic w-full text-center">Select a main category above to see specific muscles.</div>}
               </div>
            </div>

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
          <div className="flex gap-4 mb-6 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800">
             {['exercises', 'workouts', 'admin'].map(v => (
               (v !== 'admin' || user.is_superuser) && 
               <button key={v} onClick={() => setCurrentView(v)} className={`pb-2 px-4 font-bold capitalize transition-all ${currentView === v ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-400'}`}>
                 {v === 'exercises' ? 'Library' : v}
               </button>
             ))}
          </div>
          {currentView === 'exercises' && <ExercisesView userProfile={user} darkMode={darkMode} onDeleteExercise={() => {}} />}
          {currentView === 'workouts' && <WorkoutsView userProfile={user} onDeleteWorkout={() => {}} />}
          {currentView === 'admin' && user.is_superuser && <AdminPanel userProfile={user} />}
        </main>
      </div>
    </div>
  );
}
