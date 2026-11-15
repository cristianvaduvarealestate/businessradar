export default function PrivacyPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 text-titanium-200">
      <div className="border-b border-titanium-800 pb-6">
        <h1 className="text-2xl font-bold text-titanium-100">Politică de Confidențialitate</h1>
        <p className="text-xs text-titanium-400 mt-1">
          Ultima actualizare: 15 Noiembrie 2026 | Document Intern de Conformitate
        </p>
      </div>

      <div className="space-y-6 text-sm leading-relaxed">
        <section className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-titanium-100">1. Domeniu de Aplicare &amp; Caracterul Aplicației</h2>
          <p>
            Platforma <strong>RADAR BUSINESS ROMÂNIA</strong> (găzduită la domeniul canonic <code>businessradar.cristianvaduva.com</code>) este o aplicație privată de uz intern pentru analiză economică, descoperire de companii și identificarea oportunităților de asigurare dedicate persoanelor juridice din România.
          </p>
          <p>
            Această platformă <strong>nu este un portal public</strong> și este accesibilă exclusiv utilizatorilor autorizați prin politici de securitate Cloudflare Zero Trust Access.
          </p>
        </section>

        <section className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-titanium-100">2. Categoriile de Date Prelucrate &amp; Sursele Publice</h2>
          <p>Platforma colectează și consolidează exclusiv date publice privind persoanele juridice înregistrate în România:</p>
          <ul className="list-disc pl-5 space-y-1 text-titanium-300">
            <li><strong>Identificatori fiscali și comerciali:</strong> Codul Unic de Înregistrare (CUI), număr Registrul Comerțului, denumire firmă, formă juridică.</li>
            <li><strong>Date de localizare sediu social:</strong> Județ, localitate, sector, adresă oficială de contact comercial.</li>
            <li><strong>Date economice și de clasificare:</strong> Coduri CAEN (activitate principală și secundară).</li>
            <li><strong>Date fiscale și financiare publice:</strong> Stare fiscală (activ/inactiv ANAF), înregistrare TVA, bilanțuri financiare anuale publicate de Ministerul Finanțelor Publice.</li>
          </ul>
          <p className="text-xs text-titanium-400 italic">
            Surse de proveniență a datelor: Oficiul Național al Registrului Comerțului (ONRC prin data.gov.ro), Agenția Națională de Administrare Fiscală (ANAF), Ministerul Finanțelor Publice.
          </p>
        </section>

        <section className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-titanium-100">3. Temeiul Legal al Prelucrării</h2>
          <p>
            Prelucrarea datelor corporative se realizează pe baza <strong>Interesului Legitim</strong> (art. 6 alin. (1) lit. (f) din Regulamentul (UE) 2016/679 - GDPR) pentru prospectare comercială B2B, intermediere de asigurări corporative și evaluare a riscurilor comerciale.
          </p>
        </section>

        <section className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-titanium-100">4. Politica de Opoziție și Lista de Suprimare (Do-Not-Contact)</h2>
          <p>
            Respectăm cu strictețe dreptul de opoziție. Orice reprezentant al unei persoane juridice poate solicita excluderea din analizele și comunicările de prospectare ale platformei prin înscriere directă în lista internă de suprimare (<code>suppression_list</code>).
          </p>
          <p>
            Contact de securitate și conformitate: <code>myremaxclubcristianv@gmail.com</code>.
          </p>
        </section>

        <section className="p-4 rounded-lg bg-titanium-950 border border-titanium-800 text-xs text-titanium-400">
          <strong>Notă privind revizuirea juridică:</strong> Prezentul document reflectă activitățile tehnice reale de procesare a datelor. Detaliile privind entitatea operatoare formală sunt rezervate documentației corporative și acordurilor comerciale interne.
        </section>
      </div>
    </div>
  );
}
