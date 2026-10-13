'use strict';

/* ------------------------------------------------------------------ dati */

const CHIAVE = 'spese.dati.v1';
const VERSIONE_DATI = 1;
const IMPORTO_MAX = 99999999999; // centesimi

const COLORI = ['#c8553d', '#e09f3e', '#3f9b6d', '#3b82c4', '#7b5ea7', '#d1497a', '#2aa198', '#8a8f98', '#b5651d', '#5c7cfa'];

/* [tipo, nome, icona (chiave di ICONE), indice in COLORI] */
const CATEGORIE_BASE = [
  ['spesa', 'Spesa supermercato', 'cestino', 3], ['spesa', 'Shopping', 'carrello', 4], ['spesa', 'Ristoranti', 'posate', 1],
  ['spesa', 'Casa', 'casa', 0], ['spesa', 'Crediti', 'banca', 2], ['spesa', 'Salute', 'salute', 5],
  ['spesa', 'Trasporti', 'autobus', 6], ['spesa', 'Bollette', 'lampadina', 9], ['spesa', 'Famiglia', 'famiglia', 8],
  ['spesa', 'Regali', 'regalo', 5], ['spesa', 'Viaggi', 'aereo', 3], ['spesa', 'Animali', 'zampa', 8],
  ['spesa', 'Svago', 'ciak', 4], ['spesa', 'Altro', 'domanda', 7],
  ['entrata', 'Stipendio', 'valigetta', 2], ['entrata', 'Lavoro autonomo', 'ricevuta', 3], ['entrata', 'Regali', 'regalo', 5],
  ['entrata', 'Rimborsi', 'rimborso', 6], ['entrata', 'Altre entrate', 'banconota', 7],
];

/* Le prime versioni usavano emoji: qui la corrispondenza con le icone disegnate. */
const DA_EMOJI = {
  '🛒': 'cestino', '🏠': 'casa', '💡': 'lampadina', '🚌': 'autobus', '🍽️': 'posate', '🩺': 'salute', '🎬': 'ciak', '🛍️': 'carrello',
  '✈️': 'aereo', '📦': 'pacco', '☕': 'caffe', '⛽': 'benzina', '🚗': 'auto', '📱': 'telefono', '🎁': 'regalo', '🐾': 'zampa',
  '👕': 'maglia', '📚': 'libro', '🏋️': 'palestra', '💊': 'farmaco', '🧾': 'ricevuta', '🔧': 'attrezzi', '🎓': 'studio', '👶': 'bimbo',
  '💼': 'valigetta', '💶': 'banconota', '↩️': 'rimborso', '🏦': 'banca', '📈': 'crescita', '🌱': 'pianta', '⭐': 'stella',
};

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daIso = (s) => { const [a, m, g] = s.split('-').map(Number); return new Date(a, m - 1, g); };
const oggi = () => iso(new Date());
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const dataValida = (s) => typeof s === 'string' && DATA_RE.test(s) && iso(daIso(s)) === s;

const haIcona = (k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(ICONE, k);
function iconaValida(v) {
  if (haIcona(v)) return v;
  if (typeof v !== 'string' || !v) return 'domanda';
  if (haIcona(DA_EMOJI[v])) return DA_EMOJI[v];
  return [...v].slice(0, 4).join(''); // un'emoji scelta altrove resta com'è
}

function statoNuovo() {
  return {
    v: VERSIONE_DATI,
    saldoIniziale: 0,
    categorie: CATEGORIE_BASE.map(([tipo, nome, icona, c]) => ({ id: uid(), tipo, nome, icona, colore: COLORI[c] })),
    transazioni: [],
    ultimaCat: { spesa: null, entrata: null },
  };
}

/* Controlla e ripulisce dati letti dal telefono o da una copia: restituisce uno stato valido oppure null. */
function normalizza(grezzo) {
  if (!grezzo || typeof grezzo !== 'object' || !Array.isArray(grezzo.categorie) || !Array.isArray(grezzo.transazioni)) return null;
  const tipoOk = (t) => t === 'spesa' || t === 'entrata';
  const categorie = [];
  const visti = new Set();
  for (const c of grezzo.categorie) {
    if (!c || typeof c.id !== 'string' || !c.id || visti.has(c.id) || !tipoOk(c.tipo)) continue;
    const nome = String(c.nome ?? '').trim().slice(0, 30);
    if (!nome) continue;
    visti.add(c.id);
    categorie.push({
      id: c.id, tipo: c.tipo, nome,
      icona: iconaValida(c.icona),
      colore: /^#[0-9a-fA-F]{6}$/.test(c.colore) ? c.colore : COLORI[7],
    });
  }
  const perId = new Map(categorie.map((c) => [c.id, c]));
  const orfane = {};
  const transazioni = [];
  const idVisti = new Set();
  for (const t of grezzo.transazioni) {
    if (!t || !tipoOk(t.tipo) || !Number.isInteger(t.importo) || t.importo <= 0 || t.importo > IMPORTO_MAX || !dataValida(t.data)) continue;
    let cat = perId.get(t.cat);
    if (!cat || cat.tipo !== t.tipo) {
      if (!orfane[t.tipo]) {
        orfane[t.tipo] = { id: uid(), tipo: t.tipo, nome: 'Senza categoria', icona: 'domanda', colore: COLORI[7] };
        categorie.push(orfane[t.tipo]);
      }
      cat = orfane[t.tipo];
    }
    const id = typeof t.id === 'string' && t.id && !idVisti.has(t.id) ? t.id : uid();
    idVisti.add(id);
    transazioni.push({
      id, tipo: t.tipo, importo: t.importo, cat: cat.id, data: t.data,
      nota: String(t.nota ?? '').slice(0, 80),
      creato: Number.isFinite(t.creato) ? t.creato : 0,
    });
  }
  const ids = new Set(categorie.map((c) => c.id));
  const ultima = grezzo.ultimaCat || {};
  return {
    v: VERSIONE_DATI,
    saldoIniziale: Number.isInteger(grezzo.saldoIniziale) ? grezzo.saldoIniziale : 0,
    categorie,
    transazioni,
    ultimaCat: { spesa: ids.has(ultima.spesa) ? ultima.spesa : null, entrata: ids.has(ultima.entrata) ? ultima.entrata : null },
  };
}

/* Problemi di memoria da mostrare in modo permanente (non un avviso che sparisce). */
const allarme = { salvataggio: false, illeggibili: false, versioneNuova: false };

function mettiDaParte(suffisso, testo) {
  try { localStorage.setItem(`${CHIAVE}.${suffisso}`, testo); } catch { /* memoria piena o non disponibile */ }
}

function carica() {
  allarme.illeggibili = false;
  allarme.versioneNuova = false;
  let testo = null;
  try { testo = localStorage.getItem(CHIAVE); } catch { allarme.salvataggio = true; }
  if (!testo) return statoNuovo();
  let grezzo = null;
  try { grezzo = JSON.parse(testo); } catch { /* gestito sotto */ }
  const pulito = normalizza(grezzo);
  if (!pulito) {
    mettiDaParte(`illeggibile.${Date.now()}`, testo);
    allarme.illeggibili = true;
    return statoNuovo();
  }
  // Dati scritti da una versione più recente dell'app: si mostrano ma non si sovrascrivono.
  if (Number.isInteger(grezzo.v) && grezzo.v > VERSIONE_DATI) allarme.versioneNuova = true;
  // Se la pulizia ha scartato qualcosa, l'originale resta da parte prima che il prossimo salvataggio lo sostituisca.
  else if (pulito.transazioni.length < grezzo.transazioni.length) mettiDaParte('prima-della-pulizia', testo);
  return pulito;
}

function salva() {
  if (allarme.versioneNuova) { disegnaAllarme(); return false; }
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(stato));
    allarme.salvataggio = false;
  } catch {
    allarme.salvataggio = true;
  }
  disegnaAllarme();
  return !allarme.salvataggio;
}

let stato = carica();
let giornoCorrente = oggi();

const ui = {
  tipo: 'spesa',
  periodo: 'mese',
  ancora: oggi(),
  da: iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  a: oggi(),
  vista: 'panoramica', // oppure 'operazioni'
  ordine: 'data',
  filtroCat: null,
};

/* --------------------------------------------------------------- utilità */

const $ = (sel, radice = document) => radice.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const fmtEuro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' }); // 1.450,00 € anche sotto i 10.000
const euro = (centesimi) => fmtEuro.format(centesimi / 100);
const fmtData = (s, opz) => new Intl.DateTimeFormat('it-IT', opz).format(daIso(s));
const catPerId = (id) => stato.categorie.find((c) => c.id === id);
const nomeTipo = (t, plurale) => (t === 'spesa' ? (plurale ? 'spese' : 'spesa') : (plurale ? 'entrate' : 'entrata'));

/* Il disegno viene solo dalla tabella ICONE dell'app, mai dai dati: un valore sconosciuto è trattato come testo. */
function htmlIcona(chiave, colore = '#fff') {
  if (!haIcona(chiave)) return esc(chiave);
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${colore}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONE[chiave]}</svg>`;
}
const htmlPallino = (c) => `<span class="pallino" style="--c:${c ? c.colore : '#888'}" aria-hidden="true">${htmlIcona(c ? c.icona : 'domanda')}</span>`;

/* "12,50", "12.50", "1.234,5", "1.234" (= 1234) -> centesimi; null se non è un importo valido. */
function leggiImporto(testo) {
  let s = String(testo).trim().replace(/[\s€]/g, '').replace(/[−–]/g, '-');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // punto usato come separatore delle migliaia
  if (!/^-?\d*\.?\d*$/.test(s) || !/\d/.test(s)) return null;
  const n = Math.round(parseFloat(s) * 100);
  return Number.isFinite(n) ? n : null;
}
const scriviImporto = (centesimi) => (centesimi / 100).toFixed(2).replace('.', ',');

let timerAvviso = 0;
function avvisa(testo) {
  const el = $('#avviso');
  el.textContent = testo;
  el.hidden = false;
  clearTimeout(timerAvviso);
  timerAvviso = setTimeout(() => { el.hidden = true; }, 2600);
}

function disegnaAllarme() {
  const el = $('#allarme');
  if (!el) return;
  let testo = '';
  if (allarme.versioneNuova) testo = 'Questi dati sono stati salvati da una versione più recente dell’app: le modifiche non verranno salvate. Chiudi e riapri l’app per aggiornarla.';
  else if (allarme.salvataggio) testo = 'Non riesco a salvare sul dispositivo: le ultime modifiche andranno perse alla chiusura. Salva subito una copia dei dati.';
  else if (allarme.illeggibili) testo = 'I dati salvati non erano leggibili: ne ho tenuto una copia da parte e l’app è ripartita vuota. Se hai una copia, ripristinala da qui.';
  el.hidden = !testo;
  el.innerHTML = testo ? `<span>${esc(testo)}</span>${allarme.versioneNuova ? '' : `<button type="button" class="btn" id="${allarme.salvataggio ? 'allarme-copia' : 'allarme-dati'}">${allarme.salvataggio ? 'Salva una copia' : 'Apri i dati'}</button>`}` : '';
}

/* --------------------------------------------------------------- periodi */

function intervallo() {
  const a = daIso(ui.ancora);
  switch (ui.periodo) {
    case 'giorno': return [ui.ancora, ui.ancora];
    case 'settimana': {
      const lun = new Date(a.getFullYear(), a.getMonth(), a.getDate() - ((a.getDay() + 6) % 7));
      return [iso(lun), iso(new Date(lun.getFullYear(), lun.getMonth(), lun.getDate() + 6))];
    }
    case 'mese': return [iso(new Date(a.getFullYear(), a.getMonth(), 1)), iso(new Date(a.getFullYear(), a.getMonth() + 1, 0))];
    case 'anno': return [`${a.getFullYear()}-01-01`, `${a.getFullYear()}-12-31`];
    default: return ui.da <= ui.a ? [ui.da, ui.a] : [ui.a, ui.da];
  }
}

function sposta(passo) {
  const a = daIso(ui.ancora);
  if (ui.periodo === 'giorno') ui.ancora = iso(new Date(a.getFullYear(), a.getMonth(), a.getDate() + passo));
  else if (ui.periodo === 'settimana') ui.ancora = iso(new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7 * passo));
  else if (ui.periodo === 'mese') ui.ancora = iso(new Date(a.getFullYear(), a.getMonth() + passo, 1));
  else if (ui.periodo === 'anno') ui.ancora = iso(new Date(a.getFullYear() + passo, 0, 1));
  // Tornando sul periodo che contiene oggi, l'ancora è oggi: così "Giorno" non finisce al primo del mese.
  const [da, al] = intervallo();
  if (oggi() >= da && oggi() <= al) ui.ancora = oggi();
}

function etichettaPeriodo() {
  const [da, a] = intervallo();
  const annoCorrente = String(new Date().getFullYear());
  if (ui.periodo === 'giorno') {
    if (da === oggi()) return 'Oggi, ' + fmtData(da, { day: 'numeric', month: 'long' });
    return fmtData(da, { weekday: 'short', day: 'numeric', month: 'long', ...(da.startsWith(annoCorrente) ? {} : { year: 'numeric' }) });
  }
  if (ui.periodo === 'settimana') return `${fmtData(da, { day: 'numeric', month: 'short' })} – ${fmtData(a, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  if (ui.periodo === 'mese') return fmtData(da, { month: 'long', year: 'numeric' });
  if (ui.periodo === 'anno') return da.slice(0, 4);
  return '';
}

function transazioniDelPeriodo() {
  const [da, a] = intervallo();
  return stato.transazioni.filter((t) => t.tipo === ui.tipo && t.data >= da && t.data <= a);
}

function saldo() {
  return stato.transazioni.reduce((s, t) => s + (t.tipo === 'entrata' ? t.importo : -t.importo), stato.saldoIniziale);
}

/* ------------------------------------------------------------- schermate */

const PERIODI = [['giorno', 'Giorno'], ['settimana', 'Settimana'], ['mese', 'Mese'], ['anno', 'Anno'], ['periodo', 'Periodo']];

function htmlPeriodi() {
  const schede = PERIODI.map(([id, nome]) => `<button type="button" data-periodo="${id}" aria-pressed="${ui.periodo === id}">${nome}</button>`).join('');
  const [da, a] = intervallo();
  const suOggi = oggi() >= da && oggi() <= a;
  const nav = ui.periodo === 'periodo'
    ? `<div class="date-libere">
         <label>Dal<input type="date" id="per-da" value="${ui.da}"></label>
         <label>Al<input type="date" id="per-a" value="${ui.a}"></label>
       </div>`
    : `<div class="nav-periodo">
         <button type="button" class="freccia" data-sposta="-1" aria-label="Periodo precedente">‹</button>
         <button type="button" class="et" data-oggi${suOggi ? ' disabled' : ''} aria-live="polite"${suOggi ? '' : ' title="Torna a oggi"'}>${esc(etichettaPeriodo())}${suOggi ? '' : '<small>Torna a oggi</small>'}</button>
         <button type="button" class="freccia" data-sposta="1" aria-label="Periodo successivo">›</button>
       </div>`;
  return `<div class="periodi" role="group" aria-label="Periodo">${schede}</div>${nav}`;
}

function htmlAnello(parti, totale) {
  const R = 42, CIRC = 2 * Math.PI * R;
  let cerchi = `<circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--incasso)" stroke-width="11"/>`;
  if (totale > 0) {
    const spazio = parti.length > 1 ? 1.2 : 0;
    let inizio = 0;
    for (const p of parti) {
      const lung = (p.importo / totale) * CIRC;
      const visibile = Math.max(lung - spazio, 0.6);
      cerchi += `<circle cx="50" cy="50" r="${R}" fill="none" stroke="${p.cat.colore}" stroke-width="11" stroke-dasharray="${visibile.toFixed(3)} ${(CIRC - visibile).toFixed(3)}" stroke-dashoffset="${(-inizio).toFixed(3)}"/>`;
      inizio += lung;
    }
  }
  return `<div class="anello">
    <svg viewBox="0 0 100 100" role="img" aria-label="Ripartizione delle ${nomeTipo(ui.tipo, true)} per categoria">${cerchi}</svg>
    <div class="centro"><span class="tot">${euro(totale)}</span><span class="sub">${ui.tipo === 'spesa' ? 'spesi' : 'entrati'}</span></div>
  </div>`;
}

const percento = (parte, totale) => { const p = Math.round((parte / totale) * 100); return p === 0 ? '<1%' : `${p}%`; };

/* Ogni schermata è fatta di due zone, così si può ridisegnare il contenuto senza toccare i campi data del periodo. */
function partiPanoramica() {
  const tx = transazioniDelPeriodo();
  const totale = tx.reduce((s, t) => s + t.importo, 0);
  const perCat = new Map();
  for (const t of tx) perCat.set(t.cat, (perCat.get(t.cat) || 0) + t.importo);
  const parti = [...perCat].map(([id, importo]) => ({ cat: catPerId(id), importo })).filter((p) => p.cat)
    .sort((x, y) => y.importo - x.importo || x.cat.nome.localeCompare(y.cat.nome, 'it'));
  const righe = parti.map((p) => `<li><button type="button" class="riga" data-filtra="${esc(p.cat.id)}">
      ${htmlPallino(p.cat)}
      <span class="nome"><strong>${esc(p.cat.nome)}</strong></span>
      <span class="perc">${esc(percento(p.importo, totale))}</span>
      <span class="imp">${euro(p.importo)}</span>
    </button></li>`).join('');
  const vuoto = stato.transazioni.length === 0
    ? '<p class="vuoto"><strong>Ancora nessuna transazione</strong>Tocca il bottone + per registrare la prima.</p>'
    : `<p class="vuoto">Nessuna ${nomeTipo(ui.tipo)} in questo periodo.</p>`;
  return { scheda: htmlAnello(parti, totale), sotto: parti.length ? `<ul class="lista">${righe}</ul>` : vuoto };
}

function htmlRigaTx(t, conData) {
  const c = catPerId(t.cat);
  const sotto = [conData ? fmtData(t.data, { day: 'numeric', month: 'short', year: 'numeric' }) : '', t.nota].filter(Boolean).join(' · ');
  return `<li><button type="button" class="riga" data-modifica="${esc(t.id)}">
      ${htmlPallino(c)}
      <span class="nome"><strong>${esc(c ? c.nome : 'Senza categoria')}</strong>${sotto ? `<small>${esc(sotto)}</small>` : ''}</span>
      <span class="imp">${euro(t.importo)}</span>
    </button></li>`;
}

function partiOperazioni() {
  let tx = transazioniDelPeriodo();
  const filtro = ui.filtroCat && catPerId(ui.filtroCat);
  if (filtro) tx = tx.filter((t) => t.cat === filtro.id);
  const totale = tx.reduce((s, t) => s + t.importo, 0);
  let corpo;
  if (!tx.length) {
    corpo = `<p class="vuoto">Nessuna ${nomeTipo(ui.tipo)} in questo periodo.</p>`;
  } else if (ui.ordine === 'importo') {
    tx.sort((x, y) => y.importo - x.importo || y.data.localeCompare(x.data));
    corpo = `<ul class="lista">${tx.map((t) => htmlRigaTx(t, true)).join('')}</ul>`;
  } else {
    tx.sort((x, y) => y.data.localeCompare(x.data) || y.creato - x.creato);
    corpo = '';
    let giorno = null;
    for (const t of tx) {
      if (t.data !== giorno) {
        if (giorno !== null) corpo += '</ul>';
        giorno = t.data;
        corpo += `<h2 class="giorno">${esc(fmtData(t.data, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</h2><ul class="lista">`;
      }
      corpo += htmlRigaTx(t, false);
    }
    corpo += '</ul>';
  }
  const sotto = `${filtro ? `<button type="button" class="filtro" data-togli-filtro aria-label="Togli il filtro ${esc(filtro.nome)}">${esc(filtro.nome)} <span aria-hidden="true">✕</span></button>` : ''}
    <div class="barra-op">
      <span class="totale">Totale: ${euro(totale)}</span>
      <select id="ordine" aria-label="Ordina le operazioni">
        <option value="data"${ui.ordine === 'data' ? ' selected' : ''}>Per data</option>
        <option value="importo"${ui.ordine === 'importo' ? ' selected' : ''}>Per importo</option>
      </select>
    </div>
    ${corpo}`;
  return { scheda: '', sotto };
}

/* soloContenuto: lascia intatti i controlli del periodo (serve mentre si scelgono le date). */
function disegna(soloContenuto = false) {
  const s = saldo();
  $('#saldo-testo').textContent = euro(s);
  $('#btn-saldo').classList.toggle('negativo', s < 0);
  for (const b of document.querySelectorAll('#tipi button')) b.setAttribute('aria-pressed', String(b.dataset.tipo === ui.tipo));
  const op = ui.vista === 'operazioni';
  $('#btn-vista').setAttribute('aria-label', op ? 'Torna alla panoramica' : 'Elenco delle operazioni');
  $('#ico-vista').setAttribute('d', op ? 'M12 3a9 9 0 1 0 9 9M12 3v9h9' : 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01');
  const parti = op ? partiOperazioni() : partiPanoramica();
  if (soloContenuto && $('#zona-scheda') && $('#zona-sotto')) {
    $('#zona-scheda').innerHTML = parti.scheda;
    $('#zona-sotto').innerHTML = parti.sotto;
  } else {
    $('#contenuto').innerHTML = `<section class="scheda"><div id="zona-periodi">${htmlPeriodi()}</div><div id="zona-scheda">${parti.scheda}</div></section><div id="zona-sotto">${parti.sotto}</div>`;
  }
}

/* ------------------------------------------------- foglio: transazione */

let bozza = null; // { id|null, tipo, cat }

function htmlGrigliaCat() {
  const cats = stato.categorie.filter((c) => c.tipo === bozza.tipo);
  return cats.map((c) => `<button type="button" data-cat="${esc(c.id)}" aria-pressed="${bozza.cat === c.id}">
      ${htmlPallino(c)}<span class="et">${esc(c.nome)}</span>
    </button>`).join('') + `<button type="button" class="nuova" data-nuova-cat>
      <span class="pallino" aria-hidden="true">+</span><span class="et">Nuova</span></button>`;
}

function apriTransazione(id) {
  const t = id ? stato.transazioni.find((x) => x.id === id) : null;
  if (id && !t) return;
  const tipo = t ? t.tipo : ui.tipo;
  const ultima = stato.ultimaCat[tipo];
  bozza = { id: t ? t.id : null, tipo, cat: t ? t.cat : (catPerId(ultima) ? ultima : null) };
  const [da, a] = intervallo();
  const dataPredefinita = t ? t.data : (oggi() >= da && oggi() <= a ? oggi() : (ui.periodo === 'giorno' ? da : oggi()));
  const d = $('#foglio-tx');
  d.innerHTML = `<form method="dialog" id="form-tx" novalidate>
    <h2 id="tx-titolo">${t ? 'Modifica transazione' : 'Nuova transazione'}</h2>
    <div class="segmenti" role="group" aria-label="Tipo di movimento">
      <button type="button" data-bozza-tipo="spesa" aria-pressed="${tipo === 'spesa'}">Spesa</button>
      <button type="button" data-bozza-tipo="entrata" aria-pressed="${tipo === 'entrata'}">Entrata</button>
    </div>
    <label class="campo"><span>Importo</span>
      <span class="importo"><input id="tx-importo" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" placeholder="0,00" value="${t ? scriviImporto(t.importo) : ''}" aria-describedby="tx-errore"><span class="valuta" aria-hidden="true">€</span></span>
    </label>
    <h3 id="tx-cat-et">Categoria</h3>
    <div class="griglia" id="tx-griglia" role="group" aria-labelledby="tx-cat-et">${htmlGrigliaCat()}</div>
    <label class="campo"><span>Data</span><input id="tx-data" type="date" value="${dataPredefinita}" max="2100-12-31"></label>
    <label class="campo"><span>Nota (facoltativa)</span><input id="tx-nota" type="text" maxlength="80" enterkeyhint="done" autocomplete="off" value="${t ? esc(t.nota) : ''}"></label>
    <p class="errore" id="tx-errore" role="alert"></p>
    <div class="azioni">
      ${t ? '<button type="button" class="btn pericolo" id="tx-elimina">Elimina</button>' : ''}
      <button type="button" class="btn" data-chiudi>Annulla</button>
      <button type="submit" class="btn primario">${t ? 'Salva' : 'Aggiungi'}</button>
    </div>
  </form>`;
  d.showModal();
  if (!t) $('#tx-importo').focus();
}

function salvaTransazione() {
  const errore = $('#tx-errore');
  const importo = leggiImporto($('#tx-importo').value);
  const data = $('#tx-data').value;
  if (importo === null || importo <= 0) { errore.textContent = 'Scrivi un importo maggiore di zero.'; $('#tx-importo').focus(); return; }
  if (importo > IMPORTO_MAX) { errore.textContent = 'Importo troppo grande.'; $('#tx-importo').focus(); return; }
  const cat = catPerId(bozza.cat);
  if (!cat || cat.tipo !== bozza.tipo) { errore.textContent = 'Scegli una categoria.'; return; }
  if (!dataValida(data)) { errore.textContent = 'Scegli una data valida.'; $('#tx-data').focus(); return; }
  const nota = $('#tx-nota').value.trim().slice(0, 80);
  const esistente = bozza.id && stato.transazioni.find((x) => x.id === bozza.id);
  if (esistente) Object.assign(esistente, { tipo: bozza.tipo, importo, cat: cat.id, data, nota });
  else stato.transazioni.push({ id: uid(), tipo: bozza.tipo, importo, cat: cat.id, data, nota, creato: Date.now() });
  stato.ultimaCat[bozza.tipo] = cat.id;
  const ok = salva();
  if (ui.tipo !== bozza.tipo) { ui.tipo = bozza.tipo; ui.filtroCat = null; }
  $('#foglio-tx').close();
  disegna();
  if (ok) avvisa(esistente ? 'Modifica salvata' : `${bozza.tipo === 'spesa' ? 'Spesa' : 'Entrata'} di ${euro(importo)} aggiunta`);
}

/* ---------------------------------------------------- foglio: categoria */

let bozzaCat = null; // { id|null, tipo, icona, colore, daTransazione }

function apriCategoria(id, daTransazione) {
  const c = id ? catPerId(id) : null;
  if (id && !c) return;
  bozzaCat = {
    id: c ? c.id : null,
    tipo: c ? c.tipo : (daTransazione && bozza ? bozza.tipo : ui.tipo),
    icona: c ? c.icona : 'cestino',
    colore: c ? c.colore : COLORI[stato.categorie.length % COLORI.length],
    daTransazione: !!daTransazione,
  };
  const usata = c ? stato.transazioni.filter((t) => t.cat === c.id).length : 0;
  const chiavi = Object.keys(ICONE);
  const scelte = haIcona(bozzaCat.icona) ? chiavi : [bozzaCat.icona, ...chiavi];
  const d = $('#foglio-cat');
  d.innerHTML = `<form method="dialog" id="form-cat" novalidate>
    <h2 id="cat-titolo">${c ? 'Modifica categoria' : 'Nuova categoria'}</h2>
    <label class="campo"><span>Nome</span><input id="cat-nome" type="text" maxlength="30" enterkeyhint="done" autocomplete="off" value="${c ? esc(c.nome) : ''}" aria-describedby="cat-errore"></label>
    <h3>Tipo</h3>
    <div class="segmenti" role="group" aria-label="Tipo di categoria">
      <button type="button" data-cat-tipo="spesa" aria-pressed="${bozzaCat.tipo === 'spesa'}"${usata ? ' disabled' : ''}>Spese</button>
      <button type="button" data-cat-tipo="entrata" aria-pressed="${bozzaCat.tipo === 'entrata'}"${usata ? ' disabled' : ''}>Entrate</button>
    </div>
    <h3 id="cat-ico-et">Icona</h3>
    <div class="scelte" role="group" aria-labelledby="cat-ico-et">${scelte.map((k) => `<button type="button" data-icona="${esc(k)}" aria-pressed="${k === bozzaCat.icona}" aria-label="Icona ${esc(k)}">${htmlIcona(k, 'currentColor')}</button>`).join('')}</div>
    <h3 id="cat-col-et">Colore</h3>
    <div class="scelte colori" role="group" aria-labelledby="cat-col-et">${COLORI.map((col, i) => `<button type="button" data-colore="${col}" style="--c:${col}" aria-pressed="${col === bozzaCat.colore}" aria-label="Colore ${i + 1}"></button>`).join('')}</div>
    <p class="errore" id="cat-errore" role="alert"></p>
    ${usata ? `<p class="nota">Usata in ${usata} ${usata === 1 ? 'transazione' : 'transazioni'}: non si può eliminare né cambiare di tipo.</p>` : ''}
    <div class="azioni">
      ${c && !usata ? '<button type="button" class="btn pericolo" id="cat-elimina">Elimina</button>' : ''}
      <button type="button" class="btn" data-chiudi>Annulla</button>
      <button type="submit" class="btn primario">${c ? 'Salva' : 'Aggiungi'}</button>
    </div>
  </form>`;
  d.showModal();
  if (!c) $('#cat-nome').focus();
}

function salvaCategoria() {
  const errore = $('#cat-errore');
  const nome = $('#cat-nome').value.trim().slice(0, 30);
  if (!nome) { errore.textContent = 'Scrivi un nome.'; $('#cat-nome').focus(); return; }
  const doppia = stato.categorie.some((c) => c.id !== bozzaCat.id && c.tipo === bozzaCat.tipo && c.nome.toLocaleLowerCase('it') === nome.toLocaleLowerCase('it'));
  if (doppia) { errore.textContent = 'Esiste già una categoria con questo nome.'; $('#cat-nome').focus(); return; }
  let cat = bozzaCat.id && catPerId(bozzaCat.id);
  if (cat) Object.assign(cat, { nome, tipo: bozzaCat.tipo, icona: bozzaCat.icona, colore: bozzaCat.colore });
  else { cat = { id: uid(), tipo: bozzaCat.tipo, nome, icona: bozzaCat.icona, colore: bozzaCat.colore }; stato.categorie.push(cat); }
  salva();
  $('#foglio-cat').close();
  dopoCategoria(cat);
}

function dopoCategoria(cat) {
  if (bozzaCat.daTransazione && bozza && $('#foglio-tx').open) {
    if (cat && cat.tipo === bozza.tipo) bozza.cat = cat.id;
    $('#tx-griglia').innerHTML = htmlGrigliaCat();
  }
  if ($('#foglio-imp').open) disegnaImpostazioni();
  disegna();
}

/* -------------------------------------------------------- foglio: saldo */

function apriSaldo() {
  const d = $('#foglio-saldo');
  d.innerHTML = `<form method="dialog" id="form-saldo" novalidate>
    <h2 id="saldo-titolo">Saldo attuale</h2>
    <p class="nota">Scrivi quanto hai adesso. Le spese e le entrate già registrate non cambiano: viene corretto solo il punto di partenza.</p>
    <label class="campo"><span>Saldo</span>
      <span class="importo">
        <button type="button" class="btn segno" id="saldo-segno" aria-label="Cambia segno: positivo o negativo">±</button>
        <input id="saldo-importo" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" value="${scriviImporto(saldo())}" aria-describedby="saldo-errore"><span class="valuta" aria-hidden="true">€</span>
      </span>
    </label>
    <p class="errore" id="saldo-errore" role="alert"></p>
    <div class="azioni">
      <button type="button" class="btn" data-chiudi>Annulla</button>
      <button type="submit" class="btn primario">Salva</button>
    </div>
  </form>`;
  d.showModal();
  $('#saldo-importo').select();
}

function salvaSaldo() {
  const nuovo = leggiImporto($('#saldo-importo').value);
  if (nuovo === null || Math.abs(nuovo) > IMPORTO_MAX) { $('#saldo-errore').textContent = 'Scrivi un importo valido, ad esempio 1250,00.'; $('#saldo-importo').focus(); return; }
  stato.saldoIniziale += nuovo - saldo();
  salva();
  $('#foglio-saldo').close();
  disegna();
}

/* ------------------------------------------- foglio: impostazioni e dati */

async function consegnaFile(nome, tipoMime, contenuto) {
  const file = new File([contenuto], nome, { type: tipoMime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: nome }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function esportaCopia() {
  const copia = { app: 'le-mie-spese', v: VERSIONE_DATI, esportato: new Date().toISOString(), dati: stato };
  return consegnaFile(`spese-copia-${oggi()}.json`, 'application/json', JSON.stringify(copia, null, 1));
}

function esportaCsv() {
  const cella = (v) => {
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const righe = [...stato.transazioni].sort((x, y) => x.data.localeCompare(y.data) || x.creato - y.creato)
    .map((t) => [t.data, nomeTipo(t.tipo), cella((catPerId(t.cat) || {}).nome || ''), scriviImporto(t.importo), cella(t.nota)].join(';'));
  return consegnaFile(`spese-${oggi()}.csv`, 'text/csv', '﻿' + ['data;tipo;categoria;importo;nota', ...righe].join('\r\n') + '\r\n');
}

let copiaInAttesa = null;
async function leggiCopia(file) {
  const esito = $('#imp-esito');
  copiaInAttesa = null;
  try {
    const grezzo = JSON.parse(await file.text());
    const dati = normalizza(grezzo && grezzo.dati ? grezzo.dati : grezzo);
    if (!dati) throw new Error('formato');
    copiaInAttesa = dati;
    esito.className = 'nota';
    esito.innerHTML = `La copia contiene <strong>${dati.transazioni.length}</strong> transazioni e ${dati.categorie.length} categorie.
      Sostituirà i dati attuali (${stato.transazioni.length} transazioni).
      <button type="button" class="btn pericolo pieno" id="imp-conferma">Sostituisci i dati attuali</button>`;
  } catch {
    esito.className = 'errore';
    esito.textContent = 'Questo file non è una copia valida dell’app.';
  }
}

function disegnaImpostazioni() {
  const riga = (c) => `<li><button type="button" class="riga" data-modifica-cat="${esc(c.id)}">
      ${htmlPallino(c)}
      <span class="nome"><strong>${esc(c.nome)}</strong></span><span class="perc">Modifica</span></button></li>`;
  const lista = (tipo) => stato.categorie.filter((c) => c.tipo === tipo).map(riga).join('');
  $('#foglio-imp').innerHTML = `<div class="corpo">
    <h2 id="imp-titolo">Dati e categorie</h2>
    <p class="nota">I tuoi dati sono salvati solo su questo dispositivo. Se elimini l’app dalla schermata Home si perdono: ogni tanto salva una copia.</p>
    <h3>Copia dei dati</h3>
    <button type="button" class="btn pieno" id="imp-esporta">Salva una copia</button>
    <button type="button" class="btn pieno" id="imp-csv">Esporta per Numbers o Excel (CSV)</button>
    <label class="btn pieno" style="display:grid;place-items:center" for="imp-file">Ripristina da una copia…</label>
    <input type="file" id="imp-file" accept=".json,application/json" hidden>
    <p id="imp-esito" class="nota" role="status"></p>
    <h3>Categorie di spesa</h3><ul class="lista">${lista('spesa')}</ul>
    <h3>Categorie di entrata</h3><ul class="lista">${lista('entrata')}</ul>
    <button type="button" class="btn pieno" id="imp-nuova-cat">Nuova categoria</button>
    <div class="azioni"><button type="button" class="btn primario" data-chiudi>Chiudi</button></div>
  </div>`;
}

function apriImpostazioni() {
  disegnaImpostazioni();
  if (!$('#foglio-imp').open) $('#foglio-imp').showModal();
}

/* ---------------------------------------------------------------- eventi */

/* Elimina in due tocchi: il primo arma il bottone, il secondo conferma. */
function dueTocchi(bottone, azione) {
  if (bottone.dataset.armato) { azione(); return; }
  bottone.dataset.armato = '1';
  bottone.textContent = 'Conferma eliminazione';
  setTimeout(() => { if (bottone.isConnected) { delete bottone.dataset.armato; bottone.textContent = 'Elimina'; } }, 4000);
}

const premi = (el) => { for (const b of el.parentElement.children) b.setAttribute('aria-pressed', String(b === el)); };

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('button');
  if (!el) return;
  const d = el.dataset;

  if (el.id === 'fab') return apriTransazione(null);
  if (el.id === 'btn-saldo') return apriSaldo();
  if (el.id === 'btn-impostazioni' || el.id === 'allarme-dati') return apriImpostazioni();
  if (el.id === 'allarme-copia') return void esportaCopia();
  if (el.id === 'btn-vista') { ui.vista = ui.vista === 'operazioni' ? 'panoramica' : 'operazioni'; ui.filtroCat = null; disegna(); return window.scrollTo(0, 0); }
  if ('chiudi' in d) return el.closest('dialog').close();

  if (d.tipo) { ui.tipo = d.tipo; ui.filtroCat = null; return disegna(); }
  if (d.periodo) { ui.periodo = d.periodo; return disegna(); }
  if (d.sposta) { sposta(Number(d.sposta)); return disegna(); }
  if ('oggi' in d) { ui.ancora = oggi(); return disegna(); }
  if (d.filtra) { ui.filtroCat = d.filtra; ui.vista = 'operazioni'; disegna(); return window.scrollTo(0, 0); }
  if ('togliFiltro' in d) { ui.filtroCat = null; return disegna(); }
  if (d.modifica) return apriTransazione(d.modifica);

  if (d.bozzaTipo && bozza) {
    if (bozza.tipo !== d.bozzaTipo) {
      bozza.tipo = d.bozzaTipo;
      const ultima = stato.ultimaCat[bozza.tipo];
      bozza.cat = catPerId(ultima) ? ultima : null;
    }
    premi(el);
    $('#tx-griglia').innerHTML = htmlGrigliaCat();
    return;
  }
  if (d.cat && bozza) { bozza.cat = d.cat; $('#tx-griglia').innerHTML = htmlGrigliaCat(); $('#tx-errore').textContent = ''; return; }
  if ('nuovaCat' in d) return apriCategoria(null, true);
  if (el.id === 'tx-elimina') {
    return dueTocchi(el, () => {
      stato.transazioni = stato.transazioni.filter((t) => t.id !== bozza.id);
      const ok = salva(); $('#foglio-tx').close(); disegna();
      if (ok) avvisa('Transazione eliminata');
    });
  }

  if (d.catTipo && bozzaCat) { bozzaCat.tipo = d.catTipo; return premi(el); }
  if (d.icona && bozzaCat) { bozzaCat.icona = d.icona; return premi(el); }
  if (d.colore && bozzaCat) { bozzaCat.colore = d.colore; return premi(el); }
  if (el.id === 'cat-elimina') {
    return dueTocchi(el, () => {
      if (stato.transazioni.some((t) => t.cat === bozzaCat.id)) return;
      stato.categorie = stato.categorie.filter((c) => c.id !== bozzaCat.id);
      for (const k of ['spesa', 'entrata']) if (stato.ultimaCat[k] === bozzaCat.id) stato.ultimaCat[k] = null;
      if (bozza && bozza.cat === bozzaCat.id) bozza.cat = null;
      salva(); $('#foglio-cat').close(); dopoCategoria(null);
    });
  }

  if (el.id === 'saldo-segno') {
    const campo = $('#saldo-importo');
    const v = campo.value.trim().replace(/[−–]/g, '-');
    campo.value = v.startsWith('-') ? v.slice(1) : '-' + v;
    return campo.focus();
  }

  if (d.modificaCat) return apriCategoria(d.modificaCat, false);
  if (el.id === 'imp-nuova-cat') return apriCategoria(null, false);
  if (el.id === 'imp-esporta') return void esportaCopia();
  if (el.id === 'imp-csv') return void esportaCsv();
  if (el.id === 'imp-conferma' && copiaInAttesa) {
    mettiDaParte('precedente', JSON.stringify(stato)); // i dati sostituiti restano recuperabili
    stato = copiaInAttesa; copiaInAttesa = null; ui.filtroCat = null;
    allarme.versioneNuova = false; allarme.illeggibili = false;
    if (salva()) avvisa('Dati ripristinati');
    $('#foglio-imp').close(); disegna();
  }
});

document.addEventListener('submit', (ev) => {
  ev.preventDefault();
  if (ev.target.id === 'form-tx') salvaTransazione();
  else if (ev.target.id === 'form-cat') salvaCategoria();
  else if (ev.target.id === 'form-saldo') salvaSaldo();
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.id === 'ordine') { ui.ordine = el.value; disegna(); }
  else if (el.id === 'per-da' && dataValida(el.value)) { ui.da = el.value; disegna(true); }
  else if (el.id === 'per-a' && dataValida(el.value)) { ui.a = el.value; disegna(true); }
  else if (el.id === 'imp-file' && el.files && el.files[0]) { leggiCopia(el.files[0]); el.value = ''; }
});

/* Tocco fuori dal foglio = chiudi, ma solo dove non si sta scrivendo nulla (per non perdere una transazione a metà). */
$('#foglio-imp').addEventListener('click', (ev) => { if (ev.target === ev.currentTarget) ev.currentTarget.close(); });

/* Un'altra finestra dell'app ha salvato: si rileggono i dati invece di sovrascriverli con quelli vecchi. */
window.addEventListener('storage', (ev) => {
  if (ev.key !== CHIAVE) return;
  stato = carica();
  disegnaAllarme();
  disegna();
  if ($('#foglio-imp').open) disegnaImpostazioni();
});

/* L'iPhone può riaprire l'app il giorno dopo senza ricaricarla: "oggi" va aggiornato. */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const adesso = oggi();
  if (adesso !== giornoCorrente) {
    if (ui.ancora === giornoCorrente) ui.ancora = adesso;
    giornoCorrente = adesso;
    disegna();
  }
  if (registrazioneSw) registrazioneSw.update().catch(() => {});
});

/* Con la tastiera aperta il foglio si alza, così i bottoni restano raggiungibili. */
if (window.visualViewport) {
  const misura = () => {
    const coperto = Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop);
    document.documentElement.style.setProperty('--tastiera', `${Math.round(coperto)}px`);
  };
  visualViewport.addEventListener('resize', misura);
  visualViewport.addEventListener('scroll', misura);
  misura();
}

/* --------------------------------------------------------------- avvio */

let registrazioneSw = null;
disegnaAllarme();
disegna();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then((r) => { registrazioneSw = r; }).catch(() => {});
}
