import type {Metadata} from "next";

export const metadata:Metadata={
  title:"Sipariş doğrulama · MYSA OBJETS",
  robots:{index:false,follow:false},
};

export default function VerificationLayout({children}:{children:React.ReactNode}){return children;}
