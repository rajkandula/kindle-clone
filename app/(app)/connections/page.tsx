import { getVerifiedUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { OAuthToken, User } from "@/lib/models";
import { ConnectionsView } from "@/components/ConnectionsView";

export const metadata = { title: "Claude connector" };
export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const user = (await getVerifiedUser())!;
  await connectDB();
  const [userDoc, grants] = await Promise.all([
    User.findById(user.id).select("mcpToken"),
    OAuthToken.find({ userId: user.id }).sort({ createdAt: -1 }).limit(20),
  ]);

  return (
    <ConnectionsView
      initialMcpToken={userDoc?.mcpToken ?? ""}
      grants={grants.map((g) => ({
        id: g._id.toString(),
        clientName: g.clientName,
        createdAt: g.createdAt.toISOString(),
        lastUsedAt: g.lastUsedAt ? g.lastUsedAt.toISOString() : null,
      }))}
    />
  );
}
