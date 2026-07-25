import { env } from "cloudflare:workers";

type IntegrationEnv={
  PAYMENT_PROVIDER?:string;
  PAYMENT_MODE?:string;
  PAYMENT_SECRET_KEY?:string;
  PAYMENT_WEBHOOK_SECRET?:string;
  EMAIL_PROVIDER?:string;
  EMAIL_MODE?:string;
  EMAIL_API_KEY?:string;
  EMAIL_FROM?:string;
};

function runtimeEnv(){return env as unknown as IntegrationEnv;}
const configured=(value:string|undefined)=>Boolean(value?.trim());
const mode=(value:string|undefined)=>value==="live"?"live":value==="sandbox"?"sandbox":"unconfigured";

export function getIntegrationStatus(){
  const current=runtimeEnv();
  const paymentProvider=current.PAYMENT_PROVIDER?.trim()??"";
  const emailProvider=current.EMAIL_PROVIDER?.trim()??"";
  const paymentMode=mode(current.PAYMENT_MODE);
  const emailMode=mode(current.EMAIL_MODE);
  const paymentKeys={
    PAYMENT_PROVIDER:configured(current.PAYMENT_PROVIDER),
    PAYMENT_MODE:paymentMode!=="unconfigured",
    PAYMENT_SECRET_KEY:configured(current.PAYMENT_SECRET_KEY),
    PAYMENT_WEBHOOK_SECRET:configured(current.PAYMENT_WEBHOOK_SECRET),
  };
  const emailKeys={
    EMAIL_PROVIDER:configured(current.EMAIL_PROVIDER),
    EMAIL_MODE:emailMode!=="unconfigured",
    EMAIL_API_KEY:configured(current.EMAIL_API_KEY),
    EMAIL_FROM:configured(current.EMAIL_FROM),
  };
  return {
    payment:{
      provider:paymentProvider,
      mode:paymentMode,
      credentialsConfigured:Object.values(paymentKeys).every(Boolean),
      adapterConnected:false,
      keys:paymentKeys,
      blockers:[
        ...(!paymentProvider?["Ödeme sağlayıcısı seçilmedi."]:[]),
        ...(!configured(current.PAYMENT_SECRET_KEY)?["Gizli API anahtarı tanımlı değil."]:[]),
        ...(!configured(current.PAYMENT_WEBHOOK_SECRET)?["Webhook imza anahtarı tanımlı değil."]:[]),
        "Sağlayıcıya özel ödeme adaptörü henüz etkin değil.",
      ],
    },
    email:{
      provider:emailProvider,
      mode:emailMode,
      credentialsConfigured:Object.values(emailKeys).every(Boolean),
      adapterConnected:false,
      keys:emailKeys,
      blockers:[
        ...(!emailProvider?["E-posta sağlayıcısı seçilmedi."]:[]),
        ...(!configured(current.EMAIL_API_KEY)?["E-posta API anahtarı tanımlı değil."]:[]),
        ...(!configured(current.EMAIL_FROM)?["Doğrulanmış gönderici adresi tanımlı değil."]:[]),
        "Sağlayıcıya özel gönderim adaptörü henüz etkin değil.",
      ],
    },
  };
}

export function getPaymentWebhookSecret(){return runtimeEnv().PAYMENT_WEBHOOK_SECRET?.trim()??"";}
