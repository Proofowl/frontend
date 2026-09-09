import type { Metadata } from "next";

import { PassportView } from "@/components/PassportView";
import { truncateMiddle } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ wallet: string }>;
}): Promise<Metadata> {
  const { wallet } = await params;
  return {
    title: `Passport · ${truncateMiddle(wallet, 4, 4)}`,
    description: `On-chain reputation passport for ${wallet}.`,
  };
}

export default async function PassportDetailPage({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const { wallet } = await params;
  return <PassportView wallet={wallet} />;
}
