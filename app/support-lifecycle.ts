export const supportStatusLabels = {
  new: "Yeni",
  read: "İşlemde",
  resolved: "Çözüldü",
} as const;

type SupportStatus=keyof typeof supportStatusLabels;
const transitions:Record<SupportStatus,readonly SupportStatus[]>={new:["read"],read:["resolved"],resolved:[]};
const isSupportStatus=(value:unknown):value is SupportStatus=>typeof value==="string"&&value in supportStatusLabels;

export const isTerminalSupportStatus=(value:unknown)=>value==="resolved";
export const canTransitionSupportStatus=(current:unknown,next:unknown)=>isSupportStatus(current)&&isSupportStatus(next)&&(current===next||transitions[current].includes(next));
export const allowedSupportStatusTargets=(current:unknown):SupportStatus[]=>isSupportStatus(current)?[current,...transitions[current]]:[];
