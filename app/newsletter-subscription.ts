import {and,eq,exists,gt,inArray,ne,sql} from "drizzle-orm";
import {getDb} from "../db";
import {newsletterOutbox,newsletterSubscribers} from "../db/schema";

type Database=ReturnType<typeof getDb>;

type VerificationInput={
  email:string;
  market:"TR"|"GLOBAL";
  verificationTokenHash:string;
  unsubscribeTokenHash:string;
  verificationExpiresAt:string;
  subject:string;
  body:string;
  now:string;
};

const cancellableStatuses=["draft","failed","dismissed"];

export async function createNewsletterVerification(db:Database,input:VerificationInput){
  const subscriberWrite=db.insert(newsletterSubscribers).values({
    email:input.email,market:input.market,status:"pending_verification",consentAt:input.now,
    verificationTokenHash:input.verificationTokenHash,verificationExpiresAt:input.verificationExpiresAt,
    unsubscribeTokenHash:input.unsubscribeTokenHash,unsubscribedAt:null,updatedAt:input.now,
  }).onConflictDoUpdate({
    target:newsletterSubscribers.email,
    set:{market:input.market,status:"pending_verification",consentAt:input.now,verificationTokenHash:input.verificationTokenHash,verificationExpiresAt:input.verificationExpiresAt,unsubscribeTokenHash:input.unsubscribeTokenHash,unsubscribedAt:null,updatedAt:input.now},
    setWhere:ne(newsletterSubscribers.status,"active"),
  }).returning({id:newsletterSubscribers.id,status:newsletterSubscribers.status});
  const currentSubscriber=()=>db.select({id:newsletterSubscribers.id}).from(newsletterSubscribers).where(and(eq(newsletterSubscribers.email,input.email),eq(newsletterSubscribers.status,"pending_verification"),eq(newsletterSubscribers.verificationTokenHash,input.verificationTokenHash)));
  const cancelPrior=db.update(newsletterOutbox).set({status:"cancelled",deliveryClaimKey:"",deliveryClaimedAt:null,nextAttemptAt:null,updatedAt:input.now}).where(and(inArray(newsletterOutbox.subscriberId,currentSubscriber()),eq(newsletterOutbox.eventType,"verification"),inArray(newsletterOutbox.status,cancellableStatuses)));
  const eventKey=`newsletter:verify:${input.verificationTokenHash}`;
  const enqueue=db.insert(newsletterOutbox).select(db.select({
    id:sql<number>`NULL`,subscriberId:newsletterSubscribers.id,eventKey:sql<string>`${eventKey}`,eventType:sql<string>`${"verification"}`,
    recipient:sql<string>`${input.email}`,subject:sql<string>`${input.subject}`,body:sql<string>`${input.body}`,status:sql<string>`${"draft"}`,attempts:sql<number>`0`,
    deliveryClaimKey:sql<string>`${""}`,deliveryClaimedAt:sql<string|null>`NULL`,nextAttemptAt:sql<string|null>`NULL`,providerMessageId:sql<string>`${""}`,lastError:sql<string>`${""}`,sentAt:sql<string|null>`NULL`,
    createdAt:sql<string>`${input.now}`,updatedAt:sql<string>`${input.now}`,
  }).from(newsletterSubscribers).where(and(eq(newsletterSubscribers.email,input.email),eq(newsletterSubscribers.status,"pending_verification"),eq(newsletterSubscribers.verificationTokenHash,input.verificationTokenHash)))).onConflictDoNothing({target:newsletterOutbox.eventKey}).returning({id:newsletterOutbox.id});
  const[subscriberRows,,outboxRows]=await db.batch([subscriberWrite,cancelPrior,enqueue]);
  if(subscriberRows.length&&outboxRows.length)return"queued" as const;
  const[current]=await db.select({status:newsletterSubscribers.status}).from(newsletterSubscribers).where(eq(newsletterSubscribers.email,input.email)).limit(1);
  return current?.status==="active"?"active" as const:"conflict" as const;
}

export async function unsubscribeNewsletterSubscriber(db:Database,input:{id:number;tokenHash?:string;expectedUpdatedAt?:string;now:string}){
  const conditions=[eq(newsletterSubscribers.id,input.id)];
  if(input.tokenHash!==undefined)conditions.push(eq(newsletterSubscribers.unsubscribeTokenHash,input.tokenHash));
  if(input.expectedUpdatedAt!==undefined)conditions.push(eq(newsletterSubscribers.updatedAt,input.expectedUpdatedAt));
  const subscriberWrite=db.update(newsletterSubscribers).set({status:"unsubscribed",unsubscribedAt:input.now,verificationTokenHash:"",verificationExpiresAt:null,unsubscribeTokenHash:"",updatedAt:input.now}).where(and(...conditions)).returning();
  const stillUnsubscribed=()=>exists(db.select({id:newsletterSubscribers.id}).from(newsletterSubscribers).where(and(eq(newsletterSubscribers.id,input.id),eq(newsletterSubscribers.status,"unsubscribed"),eq(newsletterSubscribers.updatedAt,input.now))));
  const cancelQueued=db.update(newsletterOutbox).set({status:"cancelled",deliveryClaimKey:"",deliveryClaimedAt:null,nextAttemptAt:null,updatedAt:input.now}).where(and(eq(newsletterOutbox.subscriberId,input.id),eq(newsletterOutbox.eventType,"verification"),inArray(newsletterOutbox.status,cancellableStatuses),stillUnsubscribed()));
  const[subscriberRows]=await db.batch([subscriberWrite,cancelQueued]);
  return subscriberRows[0]??null;
}

export async function verifyNewsletterSubscriber(db:Database,input:{id:number;tokenHash:string;now:string}){
  const subscriberWrite=db.update(newsletterSubscribers).set({status:"active",verifiedAt:input.now,verificationTokenHash:"",verificationExpiresAt:null,updatedAt:input.now}).where(and(eq(newsletterSubscribers.id,input.id),eq(newsletterSubscribers.verificationTokenHash,input.tokenHash),gt(newsletterSubscribers.verificationExpiresAt,input.now))).returning();
  const stillActive=()=>exists(db.select({id:newsletterSubscribers.id}).from(newsletterSubscribers).where(and(eq(newsletterSubscribers.id,input.id),eq(newsletterSubscribers.status,"active"),eq(newsletterSubscribers.updatedAt,input.now))));
  const cancelQueued=db.update(newsletterOutbox).set({status:"cancelled",deliveryClaimKey:"",deliveryClaimedAt:null,nextAttemptAt:null,updatedAt:input.now}).where(and(eq(newsletterOutbox.subscriberId,input.id),eq(newsletterOutbox.eventType,"verification"),inArray(newsletterOutbox.status,cancellableStatuses),stillActive()));
  const[subscriberRows]=await db.batch([subscriberWrite,cancelQueued]);
  return subscriberRows[0]??null;
}
