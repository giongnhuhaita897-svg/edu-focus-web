import type { PomodoroPresetId, FocusSessionMode } from "@/types/database";
export function parseFocusQuery(params: URLSearchParams) {
 const preset=params.get("preset"); const tab=params.get("tab");
 return {goalId:params.get("goalId")??"",eventId:params.get("eventId")??"",preset:(preset==="50_15"?"50_15":"25_5") as PomodoroPresetId,tab:(tab==="exercise_break"?"exercise_break":"study_focus") as FocusSessionMode};
}
export function createWebcamLink(goalId:string,eventId:string,preset:PomodoroPresetId,tab:FocusSessionMode="exercise_break") {
 const query=new URLSearchParams({preset,tab});if(goalId)query.set("goalId",goalId);if(eventId)query.set("eventId",eventId);return `/webcam?${query.toString()}`;
}
