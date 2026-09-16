import { format, addDays, addWeeks, addMonths, isAfter, parseISO, differenceInCalendarDays } from 'date-fns';
import type { Task, TaskException, TaskCompletionOverride } from '../types';

export function occursOn(
  taskDateStr: string,
  pattern: string | null,
  target: string
): boolean {
  if (!pattern) return taskDateStr === target;
  const taskDate = parseISO(taskDateStr);
  const targetDate = parseISO(target);
  if (isAfter(targetDate, taskDate) || differenceInCalendarDays(targetDate, taskDate) === 0) {
    if (pattern === 'daily') return true;
    if (pattern === 'weekly') {
      const diff = differenceInCalendarDays(targetDate, taskDate);
      return diff % 7 === 0;
    }
    if (pattern === 'monthly') {
      return taskDate.getDate() === targetDate.getDate();
    }
  }
  return false;
}

export interface ExpandedTask extends Task {
  is_recurring_instance: boolean;
  exception_dates: string[];
}

export function expandRecurringTasks(
  tasks: Task[],
  exceptions: TaskException[],
  overrides: TaskCompletionOverride[],
  targetDate: string
): ExpandedTask[] {
  const result: ExpandedTask[] = [];
  const exceptionSet = new Set(exceptions.map((e) => e.task_id + '_' + e.exception_date));
  const overrideMap = new Map(
    overrides.map((o) => [o.task_id + '_' + o.date, o.completed])
  );

  for (const task of tasks) {
    if (!task.repeat_pattern) {
      if (task.date === targetDate) {
        result.push({ ...task, is_recurring_instance: false, exception_dates: [] });
      }
      continue;
    }

    if (task.repeat_end_date && isAfter(parseISO(targetDate), parseISO(task.repeat_end_date))) {
      continue;
    }

    if (!occursOn(task.date, task.repeat_pattern, targetDate)) continue;
    if (exceptionSet.has(task.id + '_' + targetDate)) continue;

    const isCompleted = overrideMap.has(task.id + '_' + targetDate)
      ? overrideMap.get(task.id + '_' + targetDate)!
      : false;

    result.push({
      ...task,
      completed: isCompleted,
      date: targetDate,
      is_recurring_instance: true,
      exception_dates: exceptions.filter((e) => e.task_id === task.id).map((e) => e.exception_date),
    });
  }

  return result;
}

export function getWeekDates(startDate: string): string[] {
  const dates: string[] = [];
  const start = parseISO(startDate);
  for (let i = 0; i < 7; i++) {
    dates.push(format(addDays(start, i), 'yyyy-MM-dd'));
  }
  return dates;
}

export function getMonthDates(monthStr: string): string[] {
  const [year, month] = monthStr.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const dates: string[] = [];
  let current = firstDay;
  while (current.getMonth() === month - 1) {
    dates.push(format(current, 'yyyy-MM-dd'));
    current = addDays(current, 1);
  }
  return dates;
}
