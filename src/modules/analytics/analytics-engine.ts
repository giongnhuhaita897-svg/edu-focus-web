import type { FocusSession } from "@/types/database";

export interface DailyFocus { date: string; studyMinutes: number; exerciseMinutes: number }
export interface Achievement { id: string; title: string; description: string }
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const validMinutes = (session: FocusSession) => session.penalized ? 0 : Math.max(0, Number.isFinite(session.durationMinutes) ? session.durationMinutes : 0);
export function getWeeklyFocus(sessions: FocusSession[], today = new Date()): DailyFocus[] {
  const result: DailyFocus[] = [];
  for(let offset=6; offset>=0; offset--) {
    const day = new Date(today.getFullYear(),today.getMonth(),today.getDate()-offset);
    const date = dateKey(day);
    const daily = sessions.filter(s => s.endedAt && dateKey(new Date(s.endedAt)) === date);
    result.push({date,studyMinutes: daily.filter(s=>s.mode==="study_focus").reduce((n,s)=>n+validMinutes(s),0),exerciseMinutes:daily.filter(s=>s.mode==="exercise_break").reduce((n,s)=>n+validMinutes(s),0)});
  }
  return result;
}
export function getDailyStreak(sessions: FocusSession[], today = new Date()): number {
  const days = new Set(sessions.filter(s=>s.mode==="study_focus" && !s.penalized && validMinutes(s)>0 && !Number.isNaN(new Date(s.endedAt).getTime())).map(s=>dateKey(new Date(s.endedAt))));
  let cursor = new Date(today.getFullYear(),today.getMonth(),today.getDate());
  if(!days.has(dateKey(cursor))) cursor.setDate(cursor.getDate()-1);
  let streak=0;
  while(days.has(dateKey(cursor))) { streak++; cursor.setDate(cursor.getDate()-1); }
  return streak;
}
export function getAchievements(sessions: FocusSession[], today = new Date()): Achievement[] {
  const valid = sessions.filter(s=>!s.penalized);
  const study = valid.filter(s=>s.mode==="study_focus" && validMinutes(s)>0);
  const exerciseReps = valid.filter(s=>s.mode==="exercise_break").reduce((sum,s)=>sum+Math.max(0,s.completedReps??0),0);
  const streak = getDailyStreak(sessions,today);
  const awards: Achievement[]=[];
  if(study.length) awards.push({id:"first-study",title:"Khởi đầu kỷ luật",description:"Hoàn thành phiên học đầu tiên"});
  if(streak>=3) awards.push({id:"three-days",title:"Chuỗi 3 ngày tập trung",description:"Học tập 3 ngày liên tiếp"});
  if(exerciseReps>=50) awards.push({id:"fifty-reps",title:"50 nhịp vận động",description:"Hoàn thành ít nhất 50 nhịp tập"});
  return awards;
}
