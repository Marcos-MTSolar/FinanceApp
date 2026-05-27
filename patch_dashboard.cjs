const fs = require('fs');

const path = 'src/pages/Dashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add state variable
content = content.replace(
  /const \[loading, setLoading\] = useState\(true\);/,
  `const [loading, setLoading] = useState(true);\n  const [isCarteiraModalOpen, setIsCarteiraModalOpen] = useState(false);`
);

// 2. Add computation logic
const calcTarget = `let receitasMes = 0;
  let despesasMes = 0;

  transactions.forEach((t) => {
    const val = Number(t.valor) || 0;
    if (isCurrentMonth(t.data)) {
      if (t.tipo === 'receita') {
        receitasMes += val;
      } else {
        despesasMes += Math.abs(val);
      }
    }
  });`;

const calcReplacement = `let receitasMes = 0;
  let despesasMes = 0;

  // --- CARTEIRA WIDGET ---
  const carteiraBancos: Record<string, number> = {};
  let carteiraEspecie = 0;
  let ultimoDataEspecie = 0;

  transactions.forEach((t) => {
    const val = Number(t.valor) || 0;
    if (isCurrentMonth(t.data)) {
      if (t.tipo === 'receita') {
        receitasMes += val;
      } else {
        despesasMes += Math.abs(val);
      }

      if (t.bancoOrigem) {
        if (!carteiraBancos[t.bancoOrigem]) carteiraBancos[t.bancoOrigem] = 0;
        carteiraBancos[t.bancoOrigem] += t.tipo === 'receita' ? val : -val;
      }
      
      if (t.dinheiroCarteira !== undefined && t.dinheiroCarteira !== null) {
        const tDate = new Date(t.criadoEm || t.data).getTime();
        if (tDate > ultimoDataEspecie) {
          ultimoDataEspecie = tDate;
          carteiraEspecie = Number(t.dinheiroCarteira);
        }
      }
    }
  });

  const bancosNomes = Object.keys(carteiraBancos);
  const totalBancos = bancosNomes.reduce((sum, b) => sum + carteiraBancos[b], 0);
  const totalCarteira = totalBancos + carteiraEspecie;
  const bancosRegistradosCount = bancosNomes.length;`;

// Using regex to tolerate line ending variations
content = content.replace(/let receitasMes = 0;[\s\S]*?despesasMes \+= Math\.abs\(val\);\s*}\s*}\s*}\);/, calcReplacement);

// 3. Add Widget component outside Dashboard
const widgetComponent = `
function CarteiraWidget({ 
  totalCarteira, 
  bancosRegistradosCount, 
  onClick 
}: { 
  totalCarteira: number, 
  bancosRegistradosCount: number, 
  onClick: () => void 
}) {
  return (
    <div 
      onClick={onClick}
      className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-blue-950/30 border border-gray-800 rounded-3xl p-6 lg:p-7 shadow-xl shadow-black/20 group hover:border-blue-500/50 transition-all duration-300 cursor-pointer"
    >
      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase">Minha Carteira</span>
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400">
          <Wallet className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-4">
        <h3 className="text-3xl font-extrabold text-blue-400 tracking-tight">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCarteira)}
        </h3>
        <div className="flex items-center gap-2 mt-3 text-xs text-blue-400 font-medium">
          <span className="flex items-center gap-0.5 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{bancosRegistradosCount} bancos registrados</span>
          </span>
          <span className="text-gray-500">ver detalhes</span>
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {`;
content = content.replace(/export function Dashboard\(\) {/, widgetComponent);


// 4. Inject widget in Empresarial
const empRegex = /(<div className="grid grid-cols-1 md:grid-cols-3 gap-6">[\s\S]*?)({\/\* Faturamento \*\/})/;
content = content.replace(empRegex, '$1<CarteiraWidget totalCarteira={totalCarteira} bancosRegistradosCount={bancosRegistradosCount} onClick={() => setIsCarteiraModalOpen(true)} />\n              $2');

// 5. Inject widget in Pessoal
const pesRegex = /(<div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-6">[\s\S]*?)(<div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-indigo-950\/40)/;
content = content.replace(pesRegex, '$1<CarteiraWidget totalCarteira={totalCarteira} bancosRegistradosCount={bancosRegistradosCount} onClick={() => setIsCarteiraModalOpen(true)} />\n              $2');


// 6. Inject Modal at the end of main
const modalContent = `

      {isCarteiraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl shadow-black text-white overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-900/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Detalhes da Carteira</h3>
                </div>
              </div>
              <button
                onClick={() => setIsCarteiraModalOpen(false)}
                className="p-2 text-gray-400 hover:text-white rounded-xl bg-gray-800/60 hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {bancosNomes.length === 0 && carteiraEspecie === 0 ? (
                <div className="text-center py-6 text-gray-500 text-sm">
                  Nenhum dado de carteira registrado ainda. Adicione transações com banco de origem para visualizar.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-gray-950 border border-gray-800 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <PiggyBank className="w-5 h-5 text-gray-400" />
                      <span className="font-semibold text-gray-300">Carteira Física (Espécie)</span>
                    </div>
                    <span className="font-extrabold text-white">{formatCurrency(carteiraEspecie)}</span>
                  </div>
                  {bancosNomes.map(banco => (
                    <div key={banco} className="flex items-center justify-between p-4 bg-gray-950 border border-gray-800 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <Briefcase className="w-5 h-5 text-indigo-400" />
                        <div>
                          <p className="font-semibold text-gray-300">{banco}</p>
                          <p className="text-xs text-gray-500">{transactions.filter(t => isCurrentMonth(t.data) && t.bancoOrigem === banco).length} transações</p>
                        </div>
                      </div>
                      <span className={\`font-extrabold \${carteiraBancos[banco] >= 0 ? 'text-emerald-400' : 'text-rose-400'}\`}>
                        {formatCurrency(carteiraBancos[banco])}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 bg-gray-950 border-t border-gray-800 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total Consolidado</span>
              <span className={\`text-2xl font-extrabold \${totalCarteira >= 0 ? 'text-emerald-400' : 'text-rose-400'}\`}>
                {formatCurrency(totalCarteira)}
              </span>
            </div>
          </div>
        </div>
      )}
      
      </main>`;
content = content.replace(/<\/main>/, modalContent);

fs.writeFileSync(path, content, 'utf8');
console.log('Dashboard patched successfully');
