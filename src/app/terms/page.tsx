export default function TermsPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 text-titanium-200">
      <div className="border-b border-titanium-800 pb-6">
        <h1 className="text-2xl font-bold text-titanium-100">Termeni și Condiții de Utilizare</h1>
        <p className="text-xs text-titanium-400 mt-1">
          Regulament Intern de Securitate și Utilizare a Platformei Private
        </p>
      </div>

      <div className="space-y-6 text-sm leading-relaxed">
        <section className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-titanium-100">1. Caracter Confidențial &amp; Proprietar</h2>
          <p>
            Informațiile generate și agregate în cadrul aplicației <strong>RADAR BUSINESS ROMÂNIA</strong> au caracter confidențial și constituie secret comercial intern. Accesul este strict rezervat utilizatorilor autorizați.
          </p>
          <p>
            Este strict interzisă distribuirea, partajarea credențialelor de acces, transferul bazei de date sau publicarea analizelor către terțe părți neautorizate.
          </p>
        </section>

        <section className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-titanium-100">2. Responsabilitatea Utilizatorului</h2>
          <p>Utilizatorii autorizați au obligația de a:</p>
          <ul className="list-disc pl-5 space-y-1 text-titanium-300">
            <li>Păstra confidențialitatea passkey-urilor și a sesiunilor de autentificare Cloudflare Zero Trust.</li>
            <li>Nu efectua extrageri masive de date (scraping sau export abuziv) dincolo de necesitățile operaționale justificate.</li>
            <li>Verifica statutul unei companii în lista de suprimare înainte de inițierea oricărui contact comercial.</li>
          </ul>
        </section>

        <section className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-titanium-100">3. Monitorizare &amp; Audit de Securitate</h2>
          <p>
            Toate acțiunile operaționale, descărcările de rapoarte CSV, actualizările de status în pipeline și încercările de autentificare sunt înregistrate în jurnale de audit criptate pentru asigurarea conformității și integrității datelor.
          </p>
        </section>

        <section className="p-4 rounded-lg bg-titanium-950 border border-titanium-800 text-xs text-titanium-400">
          <strong>Notă:</strong> Orice tentativă de acces neautorizat atrage revocarea imediată a drepturilor de acces și activarea măsurilor de securitate perimetrală.
        </section>
      </div>
    </div>
  );
}
