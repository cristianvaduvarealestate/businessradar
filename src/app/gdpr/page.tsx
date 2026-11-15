export default function GDPRPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 text-titanium-200">
      <div className="border-b border-titanium-800 pb-6">
        <h1 className="text-2xl font-bold text-titanium-100">Conformitate GDPR &amp; Protecția Datelor</h1>
        <p className="text-xs text-titanium-400 mt-1">
          Garanții de Conformitate conform Regulamentului General privind Protecția Datelor (UE 2016/679)
        </p>
      </div>

      <div className="space-y-6 text-sm leading-relaxed">
        <section className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-titanium-100">1. Distincția între Persoane Juridice și Persoane Fizice</h2>
          <p>
            Regulamentul General privind Protecția Datelor (GDPR) se aplică prelucrării datelor cu caracter personal ale persoanelor fizice. Conform Considerentului (14) al GDPR, regulamentul <strong>nu vizează prelucrarea datelor referitoare la persoane juridice</strong> și, în special, la întreprinderi înregistrate ca entități juridice (inclusiv denumirea, forma juridică și datele de contact oficiale ale entității).
          </p>
          <p>
            În măsura în care datele colectate din surse publice (de exemplu, persoane fizice autorizate, asociați unici sau administratori) pot constitui date cu caracter personal, platforma aplică măsuri tehnice și organizatorice stricte de securitate și proporționalitate.
          </p>
        </section>

        <section className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-titanium-100">2. Drepturile Persoanelor Vizate</h2>
          <p>Persoanele vizate beneficiază de următoarele drepturi garantate prin GDPR:</p>
          <ul className="list-disc pl-5 space-y-1 text-titanium-300">
            <li><strong>Dreptul de acces:</strong> Informare cu privire la datele prelucrate.</li>
            <li><strong>Dreptul la rectificare:</strong> Corectarea datelor inexacte sau actualizarea acestora.</li>
            <li><strong>Dreptul de opoziție (Opt-Out):</strong> Solicitarea excluderii imediate și permanente din baza de prospectare prin intermediul mecanismului de suprimare.</li>
            <li><strong>Dreptul la ștergere (dreptul de a fi uitat):</strong> Ștergerea datelor de contact în măsura în care nu există o obligație legală sau interes legitim prevalent.</li>
          </ul>
        </section>

        <section className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-titanium-100">3. Contact pentru Solicitări GDPR</h2>
          <p>
            Pentru exercitarea oricărui drept sau pentru solicitarea înscrierii pe lista de suprimare, vă rugăm să trimiteți un mesaj către adresa de conformitate:
          </p>
          <div className="p-3 bg-titanium-950 border border-titanium-700 rounded-lg text-radar-green font-mono text-xs inline-block">
            myremaxclubcristianv@gmail.com
          </div>
          <p className="text-xs text-titanium-400">
            Termenul de răspuns și soluționare a solicitărilor de opoziție este de maximum 48 de ore lucrătoare.
          </p>
        </section>

        <section className="p-4 rounded-lg bg-titanium-950 border border-titanium-800 text-xs text-titanium-400">
          <strong>Notă:</strong> Prezenta notă de informare se aplică în raport cu activitățile operaționale de procesare efectuate prin intermediul platformei BUSINESS RADAR.
        </section>
      </div>
    </div>
  );
}
