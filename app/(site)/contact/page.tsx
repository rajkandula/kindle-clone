import { Clock, MessageSquareText, ShieldCheck } from "lucide-react";
import { getVerifiedUser } from "@/lib/auth";
import { ContactForm } from "@/components/ContactForm";

export const metadata = { title: "Contact · Lectoire" };
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const user = await getVerifiedUser();

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16 sm:px-10 sm:py-20">
        <p className="text-[13px] font-semibold tracking-wide text-faint uppercase">
          We&apos;d love to hear from you
        </p>
        <h1 className="font-display mb-2 text-4xl font-semibold tracking-tight">
          Contact us
        </h1>
        <p className="mb-8 max-w-lg text-sm leading-relaxed text-muted">
          Questions about an order, the Studio, Lectoire Plus, or anything else —
          send a note and a real person will reply.
        </p>

        <ContactForm
          initialName={user?.name ?? ""}
          initialEmail=""
        />

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { icon: MessageSquareText, text: "Every message lands with our team — nothing goes to a void." },
            { icon: Clock, text: "We usually reply within one business day." },
            { icon: ShieldCheck, text: "Your details are only used to answer you." },
          ].map((i, idx) => (
            <div key={idx} className="flex items-start gap-2.5 rounded-2xl border border-line bg-surface p-4">
              <i.icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <p className="text-xs leading-relaxed text-muted">{i.text}</p>
            </div>
          ))}
        </div>
    </div>
  );
}
