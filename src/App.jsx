import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { 
  Check, Trash2, Flame, Trophy, LayoutGrid, Plus, Activity, X 
} from 'lucide-react';
import { 
  subDays, isSameDay, format, differenceInDays, startOfToday, 
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, addDays
} from 'date-fns';

// --- UTILITIES ---------------------------------------------------------------

// Generate the last 365 days (52 weeks) for the heatmap
const generateYearDays = () => {
  const days = [];
  const today = new Date();
  // Generate roughly 365 days backwards
  for (let i = 364; i >= 0; i--) {
    days.push(subDays(today, i));
  }
  return days;
};

// Logic to calculate the current streak
const calculateStreak = (habitId, logs) => {
  const habitLogs = logs
    .filter((log) => log.habitId === habitId)
    .map((log) => new Date(log.date + 'T00:00:00')) // Fix timezone issues by forcing midnight
    .sort((a, b) => b - a);

  if (habitLogs.length === 0) return 0;

  const today = startOfToday();
  let streak = 0;
  let currentCompareDate = today;

  // Check if completed today
  const completedToday = habitLogs.some(d => isSameDay(d, today));
  
  // If not done today, we check if it was done yesterday to keep streak alive
  if (!completedToday) {
    currentCompareDate = subDays(today, 1);
    const completedYesterday = habitLogs.some(d => isSameDay(d, currentCompareDate));
    if (!completedYesterday) return 0;
  }

  // Iterate backwards to count consecutive days
  // We simplify by checking if the log exists for the compare date
  for (let i = 0; i < 365; i++) {
    const targetDate = subDays(today, completedToday ? i : i + 1);
    const hasLog = habitLogs.some(d => isSameDay(d, targetDate));
    
    if (hasLog) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
};

// --- DUMMY DATA --------------------------------------------------------------

const DUMMY_HABITS = [
  { id: '1', name: 'LeetCode Practice', description: 'Solve 1 medium problem' },
  { id: '2', name: 'Reading', description: 'Read 20 pages' },
  { id: '3', name: 'Workout', description: '30 mins cardio' },
];

const generateDummyLogs = () => {
  const logs = [];
  const today = new Date();
  DUMMY_HABITS.forEach(habit => {
    // Generate random activity for the last 150 days
    for (let i = 0; i < 150; i++) {
      if (Math.random() > 0.4) { // 60% chance of completion
        const date = subDays(today, i);
        logs.push({ habitId: habit.id, date: format(date, 'yyyy-MM-dd') });
      }
    }
  });
  return logs;
};

// --- CONTEXT -----------------------------------------------------------------

const HabitContext = createContext();

const HabitProvider = ({ children }) => {
  // 1. Load Data from LocalStorage
  const [habits, setHabits] = useState(() => {
    const saved = localStorage.getItem('habits');
    return saved ? JSON.parse(saved) : DUMMY_HABITS;
  });

  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('logs');
    return saved ? JSON.parse(saved) : generateDummyLogs();
  });

  // 2. Track "Today" in state to trigger auto-updates at midnight
  const [todayDate, setTodayDate] = useState(new Date());

  // --- THE MIDNIGHT WATCHER ---
  // Checks every minute if the day has changed while the app is open
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      // If the day stored in state is different from 'now', update it
      if (!isSameDay(now, todayDate)) {
        setTodayDate(now); 
        // This state change triggers a re-render of the whole app,
        // instantly resetting checkboxes and adding the new day to the heatmap.
      }
    }, 60000); // Check every 60 seconds

    return () => clearInterval(timer);
  }, [todayDate]);

  // 3. Persistence
  useEffect(() => {
    localStorage.setItem('habits', JSON.stringify(habits));
    localStorage.setItem('logs', JSON.stringify(logs));
  }, [habits, logs]);

  const addHabit = (habit) => {
    setHabits([...habits, { ...habit, id: crypto.randomUUID() }]);
  };

  const deleteHabit = (id) => {
    if(confirm('Are you sure you want to delete this habit?')) {
      setHabits(habits.filter((h) => h.id !== id));
      setLogs(logs.filter((l) => l.habitId !== id));
    }
  };

  // 4. Toggle Logic - Always uses the current specific date
  const toggleHabit = (habitId) => {
    const dateStr = format(todayDate, 'yyyy-MM-dd'); // Uses the live date state
    const exists = logs.find(l => l.habitId === habitId && l.date === dateStr);

    if (exists) {
      setLogs(logs.filter(l => !(l.habitId === habitId && l.date === dateStr)));
    } else {
      setLogs([...logs, { habitId, date: dateStr }]);
    }
  };

  // 5. Check Logic - Simply asks "Is there a log for the current date state?"
  const isCompletedToday = (habitId) => {
    const dateStr = format(todayDate, 'yyyy-MM-dd');
    return logs.some(l => l.habitId === habitId && l.date === dateStr);
  };

  return (
    <HabitContext.Provider value={{ habits, logs, addHabit, deleteHabit, toggleHabit, isCompletedToday }}>
      {children}
    </HabitContext.Provider>
  );
};
const useHabit = () => useContext(HabitContext);

// --- COMPONENT: ADVANCED HEATMAP ---------------------------------------------

// --- COMPONENT: ADVANCED HEATMAP (FIXED TOOLTIPS) ----------------------------

const Heatmap = ({ habitId, logs }) => {
  // 1. Prepare Data
  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();
    const daysToGenerate = 364; 
    const startDate = subDays(today, daysToGenerate);
    const calendarStart = startOfWeek(startDate); 
    
    const allDays = eachDayOfInterval({
      start: calendarStart,
      end: today
    });

    const weeks = [];
    let currentWeek = [];
    
    allDays.forEach((day) => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    const monthLabels = [];
    weeks.forEach((week, index) => {
      const firstDay = week[0];
      if (isSameMonth(firstDay, addDays(firstDay, 7)) === false || index === 0) {
        if (index > 0 && index - (monthLabels[monthLabels.length - 1]?.index || 0) < 4) return;
        monthLabels.push({
          month: format(addDays(firstDay, 3), 'MMM'),
          index: index
        });
      }
    });

    return { weeks, monthLabels };
  }, []);

  // 2. Fast Lookup
  const activeDates = useMemo(() => {
    const dates = new Set();
    logs.forEach(log => {
      if (log.habitId === habitId) dates.add(log.date);
    });
    return dates;
  }, [logs, habitId]);

  return (
    <div className="w-full overflow-x-auto pb-4 scrollbar-hide">
      <div className="min-w-max px-2"> {/* Added px-2 padding to prevent edge clipping */}
        
        {/* Month Labels */}
        <div className="flex text-xs text-zinc-400 mb-2 relative h-4">
          {monthLabels.map((label) => (
            <span 
              key={label.index} 
              style={{ left: `${label.index * 14}px`, position: 'absolute' }}
            >
              {label.month}
            </span>
          ))}
        </div>

        <div className="flex gap-1">
          {/* Day Labels */}
          <div className="flex flex-col justify-between text-[10px] text-zinc-400 mr-2 py-[2px] h-[88px] leading-none">
            <span>Mon</span>
            <span>Wed</span>
            <span>Fri</span>
          </div>

          {/* Grid */}
          <div className="flex gap-[2px]">
            {weeks.map((week, weekIndex) => {
              // LOGIC FIX: Check if we are near the right edge (last 10 weeks)
              const isRightEdge = weekIndex > weeks.length - 10;

              return (
                <div key={weekIndex} className="flex flex-col gap-[2px]">
                  {week.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isActive = activeDates.has(dateStr);
                    
                    return (
                      <div key={dateStr} className="group relative">
                        {/* The Square */}
                        <div
                          className={`w-3 h-3 rounded-[1px] transition-colors duration-200 ${
                            isActive 
                              ? 'bg-emerald-500' 
                              : 'bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                          }`}
                        />
                        
                        {/* SMART TOOLTIP */}
                        <div 
                          className={`
                            absolute bottom-full mb-2 hidden group-hover:block z-20 pointer-events-none whitespace-nowrap
                            ${isRightEdge ? 'right-0' : 'left-1/2 -translate-x-1/2'} 
                          `}
                        >
                          <div className="bg-zinc-900 text-white text-xs py-1 px-2 rounded shadow-xl border border-zinc-700">
                            {isActive ? 'Completed' : 'No activity'} on <span className="font-semibold text-emerald-400">{format(day, 'MMM do, yyyy')}</span>
                          </div>
                          
                          {/* Triangle Arrow - adjusted based on position */}
                          <div 
                            className={`
                              w-2 h-2 bg-zinc-900 rotate-45 absolute -bottom-1 border-r border-b border-zinc-700
                              ${isRightEdge ? 'right-1' : 'left-1/2 -translate-x-1/2'}
                            `}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT: HABIT CARD ---------------------------------------------------

const HabitCard = ({ habit }) => {
  const { logs, toggleHabit, isCompletedToday, deleteHabit } = useHabit();
  const isDone = isCompletedToday(habit.id);
  const streak = calculateStreak(habit.id, logs);
  const totalDays = logs.filter(l => l.habitId === habit.id).length;

  return (
    <div className="min-w-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{habit.name}</h3>
          <p className="text-zinc-500 text-sm mt-1">{habit.description}</p>
        </div>
        
        <button
          onClick={() => toggleHabit(habit.id)}
          className={`flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 ${
            isDone 
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-105' 
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          }`}
        >
          <Check size={24} strokeWidth={3} />
        </button>
      </div>

      {/* Stats Row */}
      <div className="flex gap-6 mb-6">
        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          <Flame size={18} className={streak > 0 ? "text-orange-500 fill-orange-500" : ""} />
          <span className="text-sm font-medium">{streak} Day Streak</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          <Trophy size={18} className="text-yellow-500" />
          <span className="text-sm font-medium">{totalDays} Total</span>
        </div>
      </div>

      {/* Heatmap Visualization */}
      <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Consistency</p>
        <Heatmap habitId={habit.id} logs={logs} />
      </div>

      <div className="mt-4 flex justify-end">
         <button 
           onClick={() => deleteHabit(habit.id)}
           className="text-xs text-zinc-400 hover:text-red-500 transition-colors flex items-center gap-1 opacity-60 hover:opacity-100"
         >
           <Trash2 size={14} /> Delete Habit
         </button>
      </div>
    </div>
  );
};

// --- COMPONENT: DASHBOARD ----------------------------------------------------

const Dashboard = () => {
  const { habits, addHabit } = useHabit();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitDesc, setNewHabitDesc] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newHabitName) return;
    addHabit({ name: newHabitName, description: newHabitDesc || 'Daily Goal' });
    setNewHabitName('');
    setNewHabitDesc('');
    setIsModalOpen(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Consistency is key.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus size={18} /> New Habit
        </button>
      </header>

      {/* Grid of Habits */}
      {habits.length === 0 ? (
        <div className="text-center py-20 opacity-50">
           <p className="text-xl">No habits tracked yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {habits.map(habit => (
            <HabitCard key={habit.id} habit={habit} />
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold dark:text-white">Create New Habit</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAdd}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Habit Name</label>
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="e.g., Drink 3L Water"
                    className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent outline-none focus:ring-2 ring-emerald-500 dark:text-white transition-all"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g., Use my water bottle"
                    className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent outline-none focus:ring-2 ring-emerald-500 dark:text-white transition-all"
                    value={newHabitDesc}
                    onChange={(e) => setNewHabitDesc(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-emerald-500/20"
                >
                  Create Habit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// --- MAIN LAYOUT (FIXED) -----------------------------------------------------

export default function App() {
  return (
    <HabitProvider>
      {/* 1. CHANGED: min-h-screen -> h-screen overflow-hidden 
          This locks the viewport and prevents "double scrollbars" or rendering lines 
      */}
      <div className="h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 flex flex-col md:flex-row text-zinc-900 font-sans selection:bg-emerald-100 dark:selection:bg-emerald-900">
        
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 border-r border-zinc-200 dark:border-zinc-800 flex-col p-6 h-full bg-white dark:bg-zinc-950 z-20">
          <div className="flex items-center gap-2 mb-10 text-emerald-600 dark:text-emerald-500">
            <Activity size={28} />
            <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-white">HabitFlow</span>
          </div>
          
          <nav className="space-y-2 flex-1">
            <a href="#" className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-900 p-3 rounded-lg text-zinc-900 dark:text-white font-medium shadow-sm ring-1 ring-zinc-900/5">
              <LayoutGrid size={20} /> Dashboard
            </a>
          </nav>

          <div className="text-xs text-zinc-400 text-center">
            v1.0.0 Alpha
          </div>
        </aside>

        {/* 2. ADDED: A layout wrapper for the right side (Header + Content) */}
        <div className="flex-1 flex flex-col h-full relative">
          
          {/* Mobile Nav Header */}
          <div className="md:hidden bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between shrink-0 z-40 shadow-sm">
             <div className="flex items-center gap-2">
               <Activity size={24} className="text-emerald-500"/>
               <span className="font-bold text-lg dark:text-white">HabitFlow</span>
             </div>
          </div>

          {/* Main Content Area */}
          {/* This ensures ONLY this area scrolls when you add many tasks */}
          <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
            <Dashboard />
          </main>
        </div>

      </div>
    </HabitProvider>
  );
}
