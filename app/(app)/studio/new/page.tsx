import { getVerifiedUser } from "@/lib/auth";
import { StudioView } from "@/components/StudioView";
import { PlusUpsell } from "@/components/PlusUpsell";

export const metadata = { title: "New book" };
export const dynamic = "force-dynamic";

export default async function NewStudioProject() {
  const user = (await getVerifiedUser())!;
  if (!user.plus) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12 sm:px-10">
        <PlusUpsell context="Describe an idea and watch your AI writing partner turn it into a real book, chapter by chapter. Creating books is included with Lectoire Plus." />
      </div>
    );
  }
  return <StudioView />;
}
