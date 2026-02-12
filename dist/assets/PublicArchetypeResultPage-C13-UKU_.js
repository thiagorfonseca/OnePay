import{i as N,b as v,r as m,j as e,L as w}from"./index-HcuLVkXM.js";import{R}from"./ResultChart--lX9zCWP.js";import"./generateCategoricalChart-B03fitBM.js";import"./BarChart-CmfSdQYO.js";const g={FACILITADOR:"Você valoriza harmonia, colaboração e equilíbrio nas relações.",ANALISTA:"Você é detalhista, analítico e gosta de decisões bem fundamentadas.",REALIZADOR:"Você é orientado a resultados, pragmático e gosta de desafios.",VISIONÁRIO:"Você é criativo, comunicativo e busca inspirar pessoas ao redor.",EMPATE:"Seus resultados ficaram equilibrados entre mais de um perfil."},l={FACILITADOR:"Facilitador",ANALISTA:"Analista",REALIZADOR:"Realizador",VISIONÁRIO:"Visionário"},S=()=>{const{publicToken:n}=N(),b=v(),[t,y]=m.useState(null);m.useEffect(()=>{const s=b.state?.result;if(s){y(s);return}if(!n)return;const i=typeof window<"u"?window.localStorage.getItem(`archetypeResult:${n}`):null;if(i)try{const c=JSON.parse(i);y(c)}catch{}},[b.state,n]);const j=m.useMemo(()=>t?t.topProfile==="EMPATE"?g.EMPATE:g[t.topProfile]||"":"",[t]),r=m.useMemo(()=>{if(!t)return null;const i=Object.entries(t.scores).map(([a,p])=>({key:a,label:l[a]||a,score:p,percentage:t.percentages?.[a]??0})).sort((a,p)=>p.score-a.score),c=i[0]?.score??0,f=i.filter(a=>a.score===c),d=i.find(a=>a.score<c)?.score??null,u=d===null?[]:i.filter(a=>a.score===d);return{sorted:i,topProfiles:f,secondProfiles:u}},[t]),P=()=>{if(!t)return;const s=o=>o.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"),i=`${window.location.origin}/logo-onefinc.png`,f=new Date().toLocaleDateString("pt-BR"),d=t.topProfile==="EMPATE"?"Empate técnico":l[t.topProfile]||t.topProfile,u=t.topProfile==="EMPATE"&&t.topProfiles.length?t.topProfiles.map(o=>l[o]||o).join(", "):d,p=Object.entries(t.percentages).map(([o,h])=>({profile:o,label:l[o]||o,value:h})).sort((o,h)=>h.value-o.value).map(o=>`
          <tr>
            <td>${s(o.label)}</td>
            <td>${o.value.toFixed(0)}%</td>
          </tr>
        `).join(""),x=window.open("","_blank");x&&(x.document.write(`
      <html>
        <head>
          <title>Resultado do Teste de Perfil</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: "Segoe UI", Arial, sans-serif;
              color: #111827;
              padding: 32px;
            }
            .header {
              display: flex;
              align-items: center;
              gap: 16px;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 16px;
              margin-bottom: 24px;
            }
            .logo {
              width: 56px;
              height: 56px;
              object-fit: contain;
            }
            .brand h1 {
              margin: 0;
              font-size: 22px;
            }
            .brand p {
              margin: 4px 0 0;
              color: #6b7280;
              font-size: 12px;
            }
            h2 {
              margin: 0 0 8px;
              font-size: 20px;
            }
            .section {
              margin-bottom: 20px;
            }
            .tag {
              display: inline-block;
              padding: 4px 10px;
              border-radius: 999px;
              background: #eef2ff;
              color: #4338ca;
              font-size: 11px;
              font-weight: 600;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              margin-bottom: 10px;
            }
            .summary {
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 12px;
              padding: 16px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
              font-size: 13px;
            }
            th, td {
              border: 1px solid #e5e7eb;
              padding: 8px;
              text-align: left;
            }
            th {
              background: #f3f4f6;
              font-weight: 600;
            }
            .footer {
              margin-top: 32px;
              font-size: 11px;
              color: #9ca3af;
              border-top: 1px solid #e5e7eb;
              padding-top: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${i}" alt="OneFinc" class="logo" />
            <div class="brand">
              <h1>OneFinc</h1>
              <p>Resultado do Teste de Perfil</p>
            </div>
          </div>

          <div class="section">
            <span class="tag">Resumo</span>
            <div class="summary">
              <h2>${s(d)}</h2>
              <p>${s(j||"")}</p>
              <p><strong>Perfis em destaque:</strong> ${s(u)}</p>
            </div>
          </div>

          <div class="section">
            <span class="tag">Pontuação</span>
            <table>
              <thead>
                <tr>
                  <th>Perfil</th>
                  <th>Percentual</th>
                </tr>
              </thead>
              <tbody>
                ${p}
              </tbody>
            </table>
          </div>

          <div class="footer">
            Relatório gerado em ${s(f)}.
          </div>
        </body>
      </html>
    `),x.document.close(),x.focus(),x.print())};return t?e.jsx("div",{className:"min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50",children:e.jsxs("div",{className:"max-w-5xl mx-auto px-4 py-12 space-y-8",children:[e.jsxs("header",{className:"space-y-3 text-center",children:[e.jsx("span",{className:"inline-flex items-center justify-center px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold uppercase tracking-wide",children:"Resultado do teste"}),e.jsx("h1",{className:"text-3xl sm:text-4xl font-bold text-gray-800",children:"Seu resultado"}),e.jsx("p",{className:"text-gray-500",children:"Veja quais perfis se destacaram para você."})]}),e.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6",children:[e.jsxs("div",{className:"bg-white border border-gray-100 rounded-2xl p-6 space-y-4 shadow-sm",children:[e.jsxs("div",{className:"space-y-2",children:[e.jsx("p",{className:"text-sm text-gray-500",children:"Perfil predominante"}),t.topProfile==="EMPATE"?e.jsxs("div",{children:[e.jsx("h2",{className:"text-2xl font-semibold text-gray-800",children:"Empate técnico"}),e.jsx("p",{className:"text-sm text-gray-500",children:t.topProfiles.map(s=>l[s]||s).join(", ")})]}):e.jsx("h2",{className:"text-2xl font-semibold text-gray-800",children:l[t.topProfile]||t.topProfile}),e.jsx("p",{className:"text-sm text-gray-500 max-w-lg",children:j})]}),e.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-4",children:[e.jsxs("div",{className:"bg-brand-50 rounded-2xl p-4",children:[e.jsx("p",{className:"text-xs uppercase tracking-wide text-brand-600",children:"1º perfil"}),e.jsx("p",{className:"text-lg font-semibold text-gray-800",children:r?.topProfiles.length===1?r.topProfiles[0].label:"Empate"}),r?.topProfiles.length===1?e.jsxs(e.Fragment,{children:[e.jsxs("p",{className:"text-xs text-gray-500",children:[r.topProfiles[0].percentage.toFixed(0),"% das respostas"]}),e.jsx("p",{className:"text-xs text-gray-600 mt-2",children:g[r.topProfiles[0].key]||""})]}):e.jsx("p",{className:"text-xs text-gray-500",children:r?.topProfiles.map(s=>s.label).join(", ")})]}),e.jsxs("div",{className:"bg-gray-50 rounded-2xl p-4",children:[e.jsx("p",{className:"text-xs uppercase tracking-wide text-gray-500",children:"2º perfil"}),r?.secondProfiles.length?e.jsxs(e.Fragment,{children:[e.jsx("p",{className:"text-lg font-semibold text-gray-800",children:r.secondProfiles.length===1?r.secondProfiles[0].label:"Empate"}),e.jsx("p",{className:"text-xs text-gray-500",children:r.secondProfiles.length===1?`${r.secondProfiles[0].percentage.toFixed(0)}% das respostas`:r.secondProfiles.map(s=>s.label).join(", ")}),r.secondProfiles.length===1&&e.jsx("p",{className:"text-xs text-gray-600 mt-2",children:g[r.secondProfiles[0].key]||""})]}):e.jsx("p",{className:"text-sm text-gray-500",children:"Sem segundo perfil destacado."})]})]}),e.jsx("div",{className:"bg-white border border-gray-100 rounded-xl p-4",children:e.jsx(R,{scores:t.scores})})]}),e.jsxs("div",{className:"bg-white border border-gray-100 rounded-2xl p-6 space-y-4 shadow-sm",children:[e.jsx("h3",{className:"text-sm font-semibold text-gray-700 uppercase tracking-wide",children:"Pontuação detalhada"}),e.jsx("div",{className:"grid grid-cols-2 gap-3 text-center",children:Object.entries(t.percentages).map(([s,i])=>e.jsxs("div",{className:"bg-gray-50 rounded-xl p-3",children:[e.jsx("p",{className:"text-xs text-gray-400",children:l[s]||s}),e.jsxs("p",{className:"text-lg font-semibold text-gray-800",children:[i.toFixed(0),"%"]})]},s))}),e.jsx("div",{className:"text-sm text-gray-500",children:"Use este resultado como referência para entender seus pontos fortes e como se comunica em equipe."})]})]}),n&&e.jsx("button",{type:"button",onClick:P,className:"inline-flex items-center justify-center px-4 py-2 rounded-lg border border-gray-200 text-gray-600",children:"Baixar PDF"})]})}):e.jsx("div",{className:"min-h-screen flex items-center justify-center bg-gray-50 p-6",children:e.jsxs("div",{className:"bg-white border border-gray-100 rounded-2xl p-8 max-w-md text-center space-y-3",children:[e.jsx("h1",{className:"text-xl font-semibold text-gray-800",children:"Resultado indisponível"}),e.jsx("p",{className:"text-sm text-gray-500",children:"Volte ao link do teste para gerar o resultado."}),n&&e.jsx(w,{to:`/public/perfil/${n}`,className:"inline-flex items-center justify-center px-4 py-2 rounded-lg bg-brand-600 text-white text-sm",children:"Refazer teste"})]})})};export{S as default};
