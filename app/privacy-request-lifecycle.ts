export const privacyRequestStatusLabels = {
  new: "Yeni",
  reviewing: "İnceleniyor",
  waiting_identity: "Kimlik doğrulama bekliyor",
  completed: "Tamamlandı",
  rejected: "Gerekçeli ret",
} as const;

export const identityStatusLabels = {
  unverified: "Doğrulanmadı",
  pending: "Kontrol ediliyor",
  verified: "Doğrulandı",
  rejected: "Doğrulanamadı",
} as const;

type RequestStatus=keyof typeof privacyRequestStatusLabels;
type IdentityStatus=keyof typeof identityStatusLabels;

const requestTransitions:Record<RequestStatus,readonly RequestStatus[]>={
  new:["reviewing","waiting_identity","rejected"],
  reviewing:["waiting_identity","completed","rejected"],
  waiting_identity:["reviewing","completed","rejected"],
  completed:[],
  rejected:[],
};

const identityTransitions:Record<IdentityStatus,readonly IdentityStatus[]>={
  unverified:["pending","verified","rejected"],
  pending:["verified","rejected"],
  verified:[],
  rejected:["pending","verified"],
};

const isRequestStatus=(value:unknown):value is RequestStatus=>typeof value==="string"&&value in privacyRequestStatusLabels;
const isIdentityStatus=(value:unknown):value is IdentityStatus=>typeof value==="string"&&value in identityStatusLabels;

export const isTerminalPrivacyRequestStatus=(value:unknown)=>value==="completed"||value==="rejected";
export const canTransitionPrivacyRequestStatus=(current:unknown,next:unknown)=>isRequestStatus(current)&&isRequestStatus(next)&&(current===next||requestTransitions[current].includes(next));
export const canTransitionIdentityStatus=(current:unknown,next:unknown)=>isIdentityStatus(current)&&isIdentityStatus(next)&&(current===next||identityTransitions[current].includes(next));
export const allowedPrivacyRequestStatusTargets=(current:unknown):RequestStatus[]=>isRequestStatus(current)?[current,...requestTransitions[current]]:[];
export const allowedIdentityStatusTargets=(current:unknown):IdentityStatus[]=>isIdentityStatus(current)?[current,...identityTransitions[current]]:[];
