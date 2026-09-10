'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as api from './api';
import { useAuth } from './auth';
import type { Task } from './types';

/** Local YYYY-MM-DD — never toISOString(), which shifts the day in IST. */
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export function daysUntil(dueIso: string, from = todayIso()) {
  const a = new Date(from + 'T00:00:00');
  const b = new Date(dueIso + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  /** Open tasks. */
  pending: number;
  /** Open tasks whose due date has passed. */
  overdue: number;
  /** Open tasks due today. */
  dueToday: number;
  refresh: () => Promise<void>;
  create: (input: api.TaskInput) => Promise<{ duplicate?: boolean }>;
  toggle: (task: Task) => Promise<void>;
  update: (id: string, input: api.TaskInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearCompleted: () => Promise<number>;
}

const TasksContext = createContext<TasksState | undefined>(undefined);

/**
 * One place that owns the task list.
 *
 * The sidebar badge, the dashboard card and the Tasks page all need the same
 * data, and a case or a deadline can create a task from anywhere — so holding
 * it here means the badge updates the moment anything writes, instead of three
 * components fetching the same list and drifting apart.
 */
export function TasksProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await api.getTasks();
      setTasks(r.tasks);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your tasks');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(async (input: api.TaskInput) => {
    const r = await api.createTask(input);
    setTasks(r.tasks);
    return { duplicate: r.duplicate };
  }, []);

  const update = useCallback(async (id: string, input: api.TaskInput) => {
    const r = await api.updateTask(id, input);
    setTasks(r.tasks);
  }, []);

  const toggle = useCallback(async (task: Task) => {
    // Optimistic — a checkbox that lags feels broken.
    setTasks((cur) => cur.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    try {
      const r = await api.updateTask(task.id, { done: !task.done });
      setTasks(r.tasks);
    } catch {
      setTasks((cur) => cur.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)));
      setError('Could not save that change');
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    const r = await api.deleteTask(id);
    setTasks(r.tasks);
  }, []);

  const clearCompleted = useCallback(async () => {
    const r = await api.clearCompletedTasks();
    setTasks(r.tasks);
    return r.removed;
  }, []);

  const counts = useMemo(() => {
    const today = todayIso();
    const open = tasks.filter((t) => !t.done);
    return {
      pending: open.length,
      overdue: open.filter((t) => t.due && daysUntil(t.due, today) < 0).length,
      dueToday: open.filter((t) => t.due && daysUntil(t.due, today) === 0).length,
    };
  }, [tasks]);

  const value = useMemo(
    () => ({
      tasks,
      loading,
      error,
      ...counts,
      refresh,
      create,
      toggle,
      update,
      remove,
      clearCompleted,
    }),
    [tasks, loading, error, counts, refresh, create, toggle, update, remove, clearCompleted],
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasks must be used within TasksProvider');
  return ctx;
}
