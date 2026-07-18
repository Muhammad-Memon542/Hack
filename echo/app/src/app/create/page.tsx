import { CreateMarketForm } from "@/components/CreateMarketForm";

export const dynamic = "force-dynamic";

export default function CreatePage() {
  return (
    <div className="panel" style={{ maxWidth: 560, margin: "0 auto" }}>
      <h2>Create a market</h2>
      <p className="dim" style={{ marginBottom: "1rem" }}>
        One transaction allocates the market PDA and vault on-chain; the title and description live
        in the social layer. Optionally set a subject wallet to enable Programmable Yield Routing.
      </p>
      <CreateMarketForm />
    </div>
  );
}
