import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getVerifiedUser } from "@/lib/auth";
import { Book, User, toBookLite } from "@/lib/models";
import { pagesForBook, PRICING } from "@/lib/pricing";
import { OrderForm } from "@/components/OrderForm";

export const metadata = { title: "Order a printed copy" };
export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const user = (await getVerifiedUser())!;
  const { id } = await params;
  const { cancelled } = await searchParams;
  if (!mongoose.isValidObjectId(id)) notFound();

  await connectDB();
  const [book, userDoc] = await Promise.all([
    Book.findById(id),
    User.findById(user.id).select("savedAddress"),
  ]);
  const isOwn = book?.ownerId?.toString() === user.id;
  if (!book || (book.status !== "published" && !isOwn)) notFound();
  if (book.chapterCount === 0) notFound();

  return (
    <OrderForm
      book={toBookLite(book, user.id)}
      pages={pagesForBook(book)}
      pricing={{
        basePrint: PRICING.basePrint,
        perPage: PRICING.perPage,
        delivery: PRICING.delivery,
        taxRate: PRICING.taxRate,
      }}
      savedAddress={
        userDoc?.savedAddress
          ? {
              name: userDoc.savedAddress.name,
              phone: userDoc.savedAddress.phone,
              line1: userDoc.savedAddress.line1,
              line2: userDoc.savedAddress.line2,
              city: userDoc.savedAddress.city,
              state: userDoc.savedAddress.state,
              postalCode: userDoc.savedAddress.postalCode,
              country: userDoc.savedAddress.country,
            }
          : null
      }
      wasCancelled={cancelled === "1"}
    />
  );
}
