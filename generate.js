#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

function mkdirp(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function write(filePath, content) {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('  wrote', path.relative(ROOT, filePath));
}
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const MENU_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Warum?', href: '/warum' },
  { label: 'Extras', href: '/extras' },
  { label: 'Feedback', href: '/feedback' },
  { label: 'News', href: '/news' },
  { label: 'Print', href: '/print' },
  { label: 'Errata', href: '/errata' },
  { label: 'Roadmap', href: '/roadmap' },
  { label: 'Impressum', href: '/impressum' },
  { label: 'CC0 Musik', href: 'https://cc0.oer-musik.de', external: true },
];

function menu(currentPath) {
  return MENU_ITEMS.map((item, i) => {
    const sep = i < MENU_ITEMS.length - 1 ? '<span> | </span>' : '';
    if (item.external) return `<a href="${item.href}" class="bnItem" target="_blank" rel="noopener">${item.label}</a>${sep}`;
    if (item.href === currentPath) return `<span class="blau4" style="font-weight:bold">${item.label}</span>${sep}`;
    return `<a href="${item.href}" class="bnItem">${item.label}</a>${sep}`;
  }).join('');
}

const BASE_JS = `
var audios = document.getElementsByClassName('mixingAudio');
function onStartStoppClick() {
  for (var i=0;i<audios.length;i++){if(audios[i].paused)audios[i].play();else audios[i].pause();}
}
function onResetClick() {
  for (var i=0;i<audios.length;i++) audios[i].currentTime=0;
}
function onVolumeChange() {
  var vb=document.getElementById('volumeButton');
  for (var i=0;i<audios.length;i++) audios[i].volume=vb.value/100;
}
`;

function page({ title, desc, keywords, copyright = 'Ulrich Kaiser, 2011', body, js = '', extraScripts = '' }) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="keywords" content="${esc(keywords)}">
  <meta name="copyright" content="${esc(copyright)}">
  <link rel="apple-touch-icon" sizes="180x180" href="/images/favicon/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/images/favicon/favicon-16x16.png">
  <link rel="manifest" href="/images/favicon/site.webmanifest">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <header></header>
  <main class="mainContainer">
${body}
  </main>
  <footer></footer>
  ${extraScripts}
  <script>${BASE_JS}${js}</script>
</body>
</html>`;
}

function yt(src, title) {
  return `<div class="ytVideoContainer"><iframe src="${src}" title="${esc(title)}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" frameborder="0" allowfullscreen></iframe></div>`;
}

function getPages(sec) {
  const p = sec.Pages && sec.Pages.Page;
  if (!p) return [];
  return Array.isArray(p) ? p : [p];
}

function sectionDisplay(sec, folderpath) {
  const pages = getPages(sec);
  const thumbs = pages.map(p =>
    `<a href="${folderpath + p.Images.Image}" target="_blank" title="${esc(p.Description)}" class="thumb-link"><img src="${folderpath + p.Images.ImageSmall}" alt="${esc(p.Description)}" class="section-thumb" loading="lazy"></a>`
  ).join('');
  return `<div class="sectionDisplay">
    <div class="sectionIdContainer">Unterrichtsheft S.&nbsp;${esc(sec.Id)}</div>
    <div style="padding-left:10px;display:flex;flex-direction:column;padding-bottom:16px">
      <div class="thumb-gallery">${thumbs}</div>
      <div style="margin-top:6px">${sec.Description || ''}</div>
      <div style="margin-top:6px">Download der Unterrichtseinheit als <a href="${folderpath}packages/${esc(sec.Id)}.zip">ZIP-Datei</a></div>
    </div>
  </div>`;
}

function mixingControls() {
  return `<div style="margin-top:40px;display:flex">
    <button style="margin-right:10px" onclick="onStartStoppClick()">Start / Stopp</button>
    <button style="margin-right:10px" onclick="onResetClick()">Reset</button>
    <input style="margin-top:4px" id="volumeButton" onchange="onVolumeChange()" type="range" step="1">
  </div>`;
}

function audioTrack(src, label) {
  return `<div class="flexRowContainer">
    <audio class="mixingAudio" controls loop>
      <source src="${src}" type="audio/mpeg">
      <p>Ihr Browser unterstützt nicht das HTML5 Audio-Element.</p>
    </audio>
    <p class="audiotext">${label}</p>
  </div>`;
}

// ==================== LOAD OPENBOOKS ====================

function loadOpenBooks() {
  const dir = path.join(ROOT, 'data', 'openbooks');
  const allFiles = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const parse = f => { try { const ob = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); ob._file = f; return ob; } catch(e) { console.warn('parse error:', f); return null; } };
  const sortByYear = arr => arr.sort((a,b) => a.Year < b.Year ? 1 : a.Year > b.Year ? -1 : 0);

  const orderFile = path.join(dir, 'order.txt');
  if (fs.existsSync(orderFile)) {
    const lines = fs.readFileSync(orderFile, 'utf8').split('\n').map(l => l.trim());
    // Split by blank lines into groups; each group becomes one grid section
    const groups = [];
    let current = [];
    for (const line of lines) {
      if (line === '') {
        if (current.length) { groups.push(current); current = []; }
      } else if (line.endsWith('.json')) {
        current.push(line);
      }
    }
    if (current.length) groups.push(current);

    const sectionTitles = ['Musik', 'Unterricht'];
    const orderedSet = new Set(groups.flat());
    const rest = sortByYear(allFiles.filter(f => !orderedSet.has(f)).map(parse).filter(Boolean));

    const result = groups.map((files, i) => ({
      title: sectionTitles[i] ?? null,
      obs: files.map(parse).filter(Boolean)
    }));
    if (rest.length) result.push({ title: null, obs: rest });
    return { groups: result, all: result.flatMap(g => g.obs) };
  }

  const obs = sortByYear(allFiles.map(parse).filter(Boolean));
  return { groups: [{ title: null, obs }], all: obs };
}

// ==================== HOMEPAGE ====================

function genIndex({ groups, all }) {
  const renderOb = ob => {
    let tooltip = `<strong>${esc(ob.Title)}</strong><br><br>${esc(ob.Description || '')}`;
    for (const s of (ob.Supported || [])) {
      if (s.Text) tooltip += `<br><p>${esc(s.Text)}</p>`;
      if (s.Image) tooltip += `<img src="${s.Image}" style="margin-right:12px" alt="">`;
    }
    const ed = ob.Edition && ob.Edition !== '1' ? `${ob.Edition}/` : '';
    const isExternal = ob.Url && ob.Url.startsWith('https://');
    const href = isExternal ? ob.Url : (ob.Folderpath ? `/${ob.Url}/` : '#');
    const target = isExternal ? ' target="_blank" rel="noopener"' : '';
    return `    <div class="gridFraction">
      <a class="tooltip" href="${href}"${target}><img class="obImage" src="/images/${esc(ob.Image)}" alt="OpenBook">
        <span class="flyout">${tooltip}</span>
      </a>
      <p>${esc(ob.Title)}, ${ed}${esc(ob.Year)}</p>
    </div>`;
  };

  const sections = groups.map(g => {
    const heading = g.title ? `    <h2 class="gridSectionHeading">${esc(g.title)}</h2>\n` : '';
    return `${heading}    <div class="indexGridBox">\n${g.obs.map(renderOb).join('\n')}\n    </div>`;
  }).join('\n');

  const body = `    <div class="jumbotron">
      <div>${menu('/')}</div>
      <h1>Open Educational Resources zur Musik</h1>
      <h2>von Ulrich Kaiser</h2>
      <p class="jumbotron-text">
        Die OpenBooks auf dieser Seite werden unter Creative-Commons-Lizenz zur Verfügung gestellt.<br/>
        Aktuell sind <span class="obHighlighted">&nbsp;${all.length} OpenBooks&nbsp;</span> verfügbar!
      </p>
    </div>
${sections}`;

  write(path.join(DIST,'index.html'), page({
    title:'OER | Ulrich Kaiser',
    desc:'OER (Open Educational Resources) von Prof. Dr. Ulrich Kaiser',
    keywords:'OER, Open Educational Resources, OpenBooks',
    body
  }));
}

// ==================== OER DETAIL PAGES ====================

function genOerPage(ob) {
  if (!ob.Folderpath) return;
  const sup = (ob.Supported||[]).map(s=>`<div><p>${esc(s.Text)}</p>${s.Image?`<img src="${s.Image}" alt="">`:''}</div>`).join('');
  const dl = (ob.Downloads||[]).map(d=>`<a class="downloadLink" href="${ob.Folderpath}${d.Link}">${esc(d.Text)}</a>`).join('\n      ');
  const adds = ob.Additionals && ob.Additionals.length
    ? `<hr style="margin:40px 0"><p>Zusätzliche Materialien zur dieser Publikation:</p><ul class="additionalList">${ob.Additionals.map(a=>`<li><a href="${a.Link}">${esc(a.Text)}</a></li>`).join('')}</ul>`
    : '';
  const secs = (ob.Sections||[]).map(s=>sectionDisplay(s,ob.Folderpath)).join('\n');

  // Collect all full-size images from all sections for the page flip preview
  const allImages = [];
  for (const sec of (ob.Sections || [])) {
    for (const p of getPages(sec)) {
      if (p.Images && p.Images.Image) allImages.push(ob.Folderpath + p.Images.Image);
    }
  }
  const flipbook = allImages.length ? `
    <hr style="margin:40px 0">
    <h3 style="margin-bottom:16px">Vorschau</h3>
    <div style="display:flex;justify-content:center;overflow:hidden;margin-bottom:20px">
      <div id="flip-book"></div>
    </div>` : '';

  const flipJs = allImages.length ? `
(function(){
  var imgs=${JSON.stringify(allImages)};
  var pf=new St.PageFlip(document.getElementById('flip-book'),{
    width:350,height:495,showCover:true,mobileScrollSupport:false,useMouseEvents:true
  });
  pf.loadFromImages(imgs);
})();` : '';

  const body = `    <div class="obContainer">
      <a href="/" class="closeX"><span>X</span></a>
      <div style="width:90%"><h1>${esc(ob.Title)}</h1></div>
      <p>von Ulrich Kaiser</p>
      ${sup}
      <hr style="margin:40px 0">
      <div class="downloadLinksContainer">${dl}</div>
      ${adds}
      ${flipbook}
      <hr style="margin:40px 0">
      ${secs}
    </div>`;

  const extraScripts = allImages.length
    ? '<script src="/js/page-flip.browser.js"></script>'
    : '';

  write(path.join(DIST, ob.Url, 'index.html'), page({
    title:`OER | ${ob.Title}`, desc:ob.Description||'', keywords:ob.Keywords||'',
    copyright:`CC BY-SA Ulrich Kaiser, ${ob.Year}`, body, js: flipJs, extraScripts
  }));
}

// ==================== STATIC PAGES ====================

function genWarum() {
  const body = `    <div class="jumbotron">
      <a href="/" class="closeX menuX"><span>X</span></a>
      <div>${menu('/warum')}</div>
      <h1>Warum schreibt man ein OpenBook?</h1>
      <p class="jumbotron-text">
        Was nicht unmittelbar nachvollziehbar scheint – zum Beispiel über zwei Jahre lang ein Unterrichtswerk zu Johann Sebastian Bach auszuarbeiten, um es dann anschließend zu verschenken –, lässt sich meist einfach verstehen, wenn sich ein paar gängige Vorurteile ausräumen lassen.
      </p>
    </div>
    <div class="gridBox">
      <div class="gridFraction"><img src="/images/Verkehrszeichen-Fragezeichen.png" alt=""></div>
      <div class="gridFraction">
        <b>1. Vorurteil: Mit Bücherschreiben verdient man Geld.</b><br>
        Musikpädagogische Bücher werden nicht aus finanziellen Gründen geschrieben, dazu ist der Markt viel zu klein. Nehmen wir einmal an, Sie würden ein Jahr lang täglich zwei Stunden an einem Unterrichtsheft im Umfang von 40 Seiten arbeiten und fänden einen namhaften Verlag, der es in einer freien Reihe drucken würde. Dann bekämen Sie natürlich als Bezahlung kein festes Honorar, sondern zwischen 5% und 10% vom Honorarbemessungspreis, der sich aus dem Ladenpreis ohne Mehrwertsteuer abzüglich des artikel-üblichen Rabattes für Buchhändler errechnet. Nehmen wir weiter an, Sie bekämen volle 10% und das Heft würde sich zum Honorarbemessungspreis von 15 EUR prächtig verkaufen, dann würden Sie für 2000 verkaufte Exemplare pro Jahr 1.800 EUR Autorenhonorar bekommen, das allerdings noch zu versteuern wäre. Ihnen blieben also ungefähr 1.200 EUR, dass heißt, für ungefähr 600 Arbeitsstunden kämen Sie auf einen Stundenlohn von 2 EUR! Sollte sich Ihr Heft dann drei Jahre in den Läden halten (wovon Sie ausgehen können) und sich jedes Jahr auf's Neue prächtig verkaufen (wovon Sie nicht ausgehen sollten), läge ihr Honorar immerhin schon in der Mindestlohnregion für die Abfallwirtschaft. Rechnen Sie selbst, ab wann Sie also ›verdienen‹…
      </div>
      <div class="gridFraction"><img src="/images/Verkehrszeichen-Stop.png" alt=""></div>
      <div class="gridFraction">
        <b>2. Vorurteil: Der Autor schreibt ein Werk, der Verlag kümmert sich um den Rest.</b><br>
        Das mag einmal richtig gewesen sein (und vielleicht sogar bei einigen wenigen Verlagen auch heute noch zutreffen). Doch leider werden Autoren immer häufiger zu mehr verpflichtet, weil sich sonst die Sache für den Verlag "nicht rechnet". Das fängt üblicherweise an bei Notenbeispielen, kann das Besorgen von Bildern und Bildrechten einschließen, natürlich werden Sie die CDs für die Soundbeispiele aus eigener Tasche bezahlen und im ungünstigen Fall dazu verpflichtet, eine PDF-Datei mit druckfertigem Layout abzuliefern. Noch schlechter kann es Sie treffen, wenn Sie eine Forschungsarbeit publizieren wollen (oder müssen), denn dann zahlen Sie die Druckkosten in der Regel auch noch selbst und der Verlag übernimmt lediglich Lagerung, Werbung und Auslieferung des Werkes (da Ihr Titel in diesem Fall vom Verlag nur in Kommission vertrieben wird, kann man ihn ein paar Monate später bei Google-Books online lesen und in großen Teilen kostenlos herunterladen).
      </div>
      <div class="gridFraction"><img src="/images/Verkehrszeichen-Umleitung.png" alt=""></div>
      <div class="gridFraction">
        <b>3. Vorurteil: Verlage sind an guten und neuen Inhalten interessiert.</b><br>
        Verlage sind an Inhalten interessiert, die sich gut verkaufen und das sind leider nicht immer gute Inhalte. Anders lässt sich kaum erklären, warum man auch in neuesten Schulbüchern fachwissenschaftlich Überholtes und im schlimmsten Fall sogar lexikalisch Falsches lesen kann. Was sich gestern in der Praxis bewährt hat, wird von Praktikern für die heutige Praxis in Kenntnis der Lehrpläne von morgen neu aufbereitet und publiziert. Ein funktionierender Kreislauf, der gänzlich autonom produziert und sich kaum durch Fachwissenschaften irritieren lässt.
      </div>
    </div>
    <p>
      Warum also schreibt man OpenBooks? Man schreibt OpenBooks, weil man gerne Bücher schreibt und sie auch layouten kann (vielen Dank an alle Verlage), weil man keine Kompromisse mehr bei den Inhalten eingehen möchte und weil man hofft, mehr Interessierte über Bildungsportale und Internet-Tauschbörsen zu erreichen als über die Regale der Fachbuchhandlungen. Damit die Texte wachsen können, benötigen sie natürlich ein freundliches Umfeld. In meinem Fall waren das zum einen die "Lektoren" der "Kritikerrunde" (Verena Wied, Verena Weidner, Kilian Sprau und Andreas Helmberger), zum anderen Brilliant Classics, das Bachhaus Eisenach, Armin Schidlo, Erke Freisler, Volker Ansorge und nicht zu vergessen: meine Frau Regina.<br><br>
      Sollte Ihnen dieses OpenBook zu Johann Sebastian Bach gefallen, dürfen Sie mich gerne ›entlohnen‹, indem Sie es möglichst oft im Unterricht verwenden, mir freundliche Kritik oder einfach nur ein Dankeschön über meine Website zukommen lassen.<br><br>
      Karlsfeld 2011
    </p>
    <p style="font-size:0.8em;text-align:right">
      Aus: Johann Sebastian Bach. Ein Superstar gestern und heute. Karlsfeld 2011, Kommentarheft, Vorwort S. 4.
    </p>`;
  write(path.join(DIST,'warum','index.html'), page({
    title:'OER | Ulrich Kaiser - Warum?',
    desc:'Hintergrundinformationen zur Motivation von Ulrich Kaiser, Open Educational Resources zu publizieren',
    keywords:'Hintergründe, OER, Open Educational Resources, OpenBooks', body
  }));
}

function genExtras() {
  const body = `    <div class="jumbotron">
      <a href="/" class="closeX"><span>X</span></a>
      <div>${menu('/extras')}</div>
      <h1>Software, Spiele und...</h1>
    </div>
    <div class="gridBox">
      <div class="gridFraction"><a href="/videos"><img src="/images/film-ob-image.png" alt="Videos"></a></div>
      <div class="gridFraction"><div>Hier können Sie sich einige <a href="/videos">Videos</a> anschauen, die im Umfang der OER entstanden sind.</div></div>
      <div class="gridFraction"><a href="/software"><img src="/images/softwareImage.png" alt="Software"></a></div>
      <div class="gridFraction"><div>Hier finden Sie <a href="/software">Software</a>, die für einige OpenBooks programmiert worden ist.</div></div>
      <div class="gridFraction"><a href="https://musikanalyse.net/materialien/"><img src="/images/klangundakkord.png" alt="Arbeitsbögen"></a></div>
      <div class="gridFraction"><div>Arbeitsbögen, die bisher auf dieser Website bereitgestellt worden sind, wurden mit den Arbeitsbögen auf <i>musikanalyse.net</i> zusammengeführt. Sie können sich diese Materialien <a href="https://musikanalyse.net/materialien/">hier</a> herunterladen.</div></div>
    </div>`;
  write(path.join(DIST,'extras','index.html'), page({
    title:'OER | Ulrich Kaiser - Extras',
    desc:'Hier finden Sie eine Übersicht zu den Extras, die im Zusammenhang mit den OpenBooks (OER) von Ulrich Kaiser veröffentlicht worden sind.',
    keywords:'Extras, Übersicht, OER, Open Educational Resources, OpenBooks', body
  }));
}

function genFeedback() {
  const items = [
    'Sehr geehrter Herr Prof. Kaiser, ich möchte Ihnen auf diesem Weg einfach "mal Danke" sagen für das überaus hilfreiche Material, das Sie zur Verfügung stellen. Das Openbook Filmmusik habe ich während der Schulschließung und darüber hinaus eingesetzt und die Arbeit damit verläuft mehr als zufriedenstellend (was im Lehrer*innenalltag nun wirklich nicht häufig und selbstverständlich ist) - selbst den Schüler*innen macht es Spaß - jetzt könnte ich die Klammer wiederholen ;-) Abgesehen ist es didaktisch sinnvoll aufbereitet, hat das nötige Maß zwischen fachlichen Inhalten und kreativen Spielräumen und die Beispiele sind wirklich nahe an der Erlebniswelt der Schüler*innen. Herzlichen Dank!',
    'Sg Herr Kaiser, ich bin zufällig (beim Stöbern im www und der Suche nach verwendbaren Materialien im erneuten Distance Learning) auf Ihre Seite gestoßen und möchte mich für die wunderbare Arbeit und das Zurverfügungstellen Ihrer Materialen herzlichst bedanken. Tolle Werkzeuge, mit denen der Unterricht auch digital für die Kids aufgewertet wird. DANKE und liebe Grüße aus...',
    'S.G. Herr Kaiser, Ich bin gerade zufällig auf der Suche nach Unterrichtsmaterial auf ihre Seite gestossen und komm jetzt gar nicht mehr weg. Vielen Dank, dass sie das tollte Material einfach so Ins Netz stellen. Mit freundlichen Grüßen',
    'Sehr geehrter Herr Professor Kaiser, ich bin ein Musiklehrer, der vor ein paar Jahren nach Deutschland immigriert ist. Wo ich herkomme gibt es ein Sprichwort: Tu\' Gutes und wirf das Brot ins Meer; sieht es der Fisch nicht, so sieht\'s doch der Herr!" Soweit ich die Rückmeldungen gelesen habe, wissen die Fische auch Bescheid. Ich schätze sehr, dass Sie Ihre Werke für die Menschheit unentgeltlich erreichbar gemacht haben. Herzlichen Dank und bleiben Sie gesund.',
    'Sehr geehrter Herr Professor Kaiser, ich möchte Ihnen sehr herzlich für die verschiedenen Zusammenstellungen von OER und gemeinfreier Musik danken. Für mich als Musiklehrer am Gymnasium ist das nicht nur in Zeiten des voll-digitalen Unterrichts eine enorme Hilfe.',
    'Vielen Dank für das Open Book zu Beethovens 5. Sinfonie. Was für ein Geschenk. Ich arbeite an einer Grundschule in Spandau :-) als seiteneingestiegene Musiklehrerin. Da ich mir erstmal viel Material zusammenstellen und "zubereiten" muss, hilft mir Openbook 6 enorm weiter [...] Herzlichen Dank, beste Grüße und ich freue mich auf neue Materialien!',
    'Ich möchte Ihnen ganz herzlich gratulieren zur neuen "Formenlehre", die ich - wie alle Ihre vergangenen gedruckten Bücher und open books - für ganz ausgezeichnet gelungen und in der Praxis perfekt einsetzbar halte. [...] Ihre Materialien liefern immer wieder ausgezeichnete Anregungen für meinen Unterricht in Tonsatz, Formenlehre und Musikgeschichte. Daß Sie das alles gratis als open books zur Verfügung stellen, schätze ich sehr und finde es sehr großzügig und nobel. Herzlichen Dank, beste Grüße und ich freue mich auf neue Materialien!',
    'Sehr geehrter Herr Kaiser, [...] ich möchte mich doch einmal bei Ihnen bedanken für die Unterrichtsmaterialien, die Sie auf Ihrer Seite allen Interessierten zur Verfügung stellen. Ich bin seit vielen Jahren Musik- und Sportlehrer an Waldorfschulen [...] und habe leider erst vor einigen Wochen [...] Ihre Publikationen auf meinen Suchen im Internet entdeckt. Einiges habe ich schon in meinen Unterrichtsversuchen mit Erfolg ›verwurstet‹. Für die Schüler sind Ihre Hefte nach meiner Erfahrung eine große Hilfe und sehr motivierend für die eigene Erarbeitung. Vielen Dank!',
    'Sehr geehrter Prof. Dr. Kaiser […] Das von ihnen zur Verfügung gestellte Material ist wahrlich hervorragend, nicht nur in Bezug auf den Inhalt, sondern auch wie es geschrieben wurde. […] Ihr Material bietet weit mehr als einen groben Überblick, es lädt ein und inspiriert das Gelernte zu nutzen und es auszubauen. Man merkt in ihren Werken, ihre Passion, den Menschen Musik zu erklären und sie dafür begeistern zu wollen. Alles Gute für sie, sehr geehrter Herr Prof. Dr. Kaiser, nochmals Dank und großen Respekt für ihre Arbeiten.',
    'Ich bin als Schulmusikerin am [...] tätig. Ihre Open Books habe ich schon mehrfach im Unterricht ausprobiert, sie sind wirklich toll, z.B. der Lamentobass.',
    'Lieber Uli, eben habe ich mit meinen Schülern den Lamento-Kanon plus Bodypercussion exekutiert: großartig! - Es hat allen Spaß gemacht und viel für das Verständnis gebracht. Herzliche Grüße und vielen Dank für deine gute Arbeit!',
    'Sehr geehrter Prof. Dr. Kaiser, mit großer Freude bin ich vor kurzem auf ihre tolle Hompage und OpenBooks gestoßen, nachdem ich schon mit einigen ihrer tollen Studien-Bücher Musik aus der Bärenreiter-Reihe gearbeitet habe! Großes Kompliment für ihre Arbeit! Ihre Bücher sind fachlich auf höchstem Niveau, aber dabei trotzdem sehr verständlich und leserorientiert geschrieben. Diese Kombination findet man auf dem deutschen Buchmarkt leider viel zu selten. Toll!',
    'Sehr geehrter Herr Kaiser, ich habe ihre tollen Hefte im Internet gefunden, als ich auf der Such zu Urheberrecht in Musik war. Vielen Dank für ihre Arbeit.',
    'Vielen Dank!',
    'Lieber Herr Prof. Kaiser! Ich möchte Ihnen [...] herzlich Danke sagen für die großartigen Unterlagen, die mir immer wieder viele Anregungen für meinen eigenen Unterricht bieten. So sehr ich Ihren Argumenten für die Erstellung von Open Books folgen kann, für so wenig selbstverständlich halte ich es, dann die erstellten Unterlagen allgemein zur Verfügung zu stellen. Also nochmals besten Dank - und, wenn ich so sagen darf, weiter so - Sie haben begeisterte Abnehmer!',
    'Sehr geehrter Herr Kaiser, ich war soeben im Netz auf der Suche nach guten Hinweisen zum Thema SHF und sehe hier Ihre innovativen Unterrichtsarbeiten. Meinem kommenden Unterrichtsbesuch sehe ich nun mit Zuversicht entgegen. Vielen Dank. Ich werde Sie weiter empfehlen.',
    'Auf diesem Weg möchte ich mich tatsächlich bedanken! Ich habe ihre Materialien gefunden und freue mich, sie in verschiedenen Klassen einsetzen zu dürfen. Vielen Dank für das Bereitstellen!!!',
    'Sehr geehrter Prof. Dr. Herr Kaiser, meine Schüler am Internatsgymnasium waren sehr begeistert von ihren Open Book "Sonaten & Sinfonien".',
    'Lieber Herr Kaiser, ich bin total begeistert von Ihren Materialen zu Sinfonie und Sonate. Ich schreibe gerade meine Masterarbeit zum Thema zeitgemäße Vermittlung der Sinfonie in der Schule und da ist Ihr Werk absolut Gold wert.',
    'Sehr geehrter Herr Kaiser, ich freue mich sehr, Ihr Openbook zur Sonatenform gefunden zu haben. Herzlichen Glückwunsch zu diesem hervorragend durchdachten und für die Praxis wirklich wunderbar brauchbaren Opus und vielen Dank, dass Sie es kostenlos zur Verfügung stellen!',
    'Sehr geehrter Herr Kaiser, ich habe vor ein paar Tagen Ihre OpenBooks zur Musiktheorie entdeckt und bin völlig begeistert. Ich denke, mit Ihren gut gemachten und liebevoll gestalteten Themenheften habe ich noch eine reale Chance. Vielen Dank dafür!',
  ];
  const rows = items.map(t => `
      <div class="gridFraction"><img class="stars" src="/images/stars.png" alt="Sterne"></div>
      <div class="gridFraction">${t}</div>`).join('');
  const body = `    <div class="jumbotron">
      <a href="/" class="closeX"><span>X</span></a>
      <div>${menu('/feedback')}</div>
      <h1>Feedback</h1>
      <p class="jumbotron-text">
        Ich bin wirklich sehr glücklich über die zahlreichen Rückmeldungen, die mich bisher per Mail erreicht haben. Die Rückmeldung wurden für die Wiedergabe auf dieser Website anonymisiert. Sollten Sie "Ihre" Rückmeldung hier finden und trotz Anonymisierung nicht mit einer Veröffentlichung einverstanden sein, seien Sie mir bitte nicht böse. Schreiben Sie mir einfach eine kurze Mail, und ich werde Ihre freundliches Dankeschön sofort wieder aus dem Netz entfernen.
      </p>
    </div>
    <div class="gridBox">${rows}
    </div>`;
  write(path.join(DIST,'feedback','index.html'), page({
    title:'OER | Ulrich Kaiser - Feedback',
    desc:'Hier finden Sie einige Rückmeldungen zu den OpenBooks (OER) von Ulrich Kaiser.',
    keywords:'Feedback, Rückmeldungen, OER, Open Educational Resources, OpenBooks', body
  }));
}

function genNews() {
  const entries = [
    { pdf:'/publicfiles/019_2021-04-18.pdf', text:'<a href="/publicfiles/019_2021-04-18.pdf">Newsletter Nr. 19</a> zur Veröffentlichung des OpenBooks <a href="/oer-walzer-von-brahms-arrangiert-fuer-zwei-violinen/">J. Brahms. Walzer aus Op. 39 arrangiert für 2 Violinen</a> (=OpenBook 17/1), Karlsfeld 2021.' },
    { pdf:'/publicfiles/018_2020-09-21.pdf', text:'<a href="/publicfiles/018_2020-09-21.pdf">Newsletter Nr. 18</a> zur Veröffentlichung des OpenBooks <a href="/filmmusik/">Filmmusik</a> (=OpenBook 15), Karlsfeld 2020.' },
    { pdf:'/publicfiles/017_2019-03-04.pdf', text:'<a href="/publicfiles/017_2019-03-04.pdf">Newsletter Nr. 17</a> zur Veröffentlichung des Musikhefts <a href="/formenlehre/">Formenlehre der Musik</a> (=OpenBook 13), Karlsfeld 2019.' },
    { pdf:'/publicfiles/016_2017-10-28.pdf', text:'<a href="/publicfiles/016_2017-10-28.pdf">Newsletter Nr. 16</a> zur Veröffentlichung der Musikhefte <a href="/carmensuite/">George Bizet. Carmen zu einer Suite arrangiert von Ulrich Kaiser</a> (=OpenBook 18/2) und <a href="/happyforchoir/">Kanon und 8 Variationen über Happy Birthday To You für vierstimmig gemischten Chor</a> (=OpenBook 14/2), Karlsfeld 2017.' },
    { pdf:'/publicfiles/015_2017-02-18.pdf', text:'<a href="/publicfiles/015_2017-02-18.pdf">Newsletter Nr. 15</a> zur Veröffentlichung des Musikheftes <a href="/oer-johannes-brahms-ungarischer-tanz-5/">Johannes Brahms. Ungarischer Tanz Nr. 5 arrangiert und mit einer Einleitung versehen von Ulrich Kaiser</a> (=OpenBook 18/1), Karlsfeld 2017.' },
    { pdf:'/publicfiles/014_2017-01-01.pdf', text:'<a href="/publicfiles/014_2017-01-01.pdf">Newsletter Nr. 14</a> zur Veröffentlichung des Musikheftes <a href="/happyfortwo/">Thema und 12 Variationen über ›Happy Birthday To You‹ für zwei beliebige Melodieinstrumente</a> (=OpenBook 14/1), Karlsfeld 2017.' },
    { pdf:'/publicfiles/013_2016-10-11.pdf', text:'<a href="/publicfiles/013_2016-10-11.pdf">Newsletter Nr. 13</a> zur Veröffentlichung des Musikheftes <a href="/transponierendeinstrumente/">Orchesterinstrumente. Transponierende Instrumente</a> (=OpenBook 16), Karlsfeld 2016.' },
    { pdf:'/publicfiles/012_2016-07-16.pdf', text:'<a href="/publicfiles/012_2016-07-16.pdf">Newsletter Nr. 12</a> zur Veröffentlichung des Musikheftes <a href="/harmonielehre/">Harmonielehre #reloaded</a> (=OpenBook 12), Karlsfeld 2016.' },
    { pdf:'/publicfiles/011_2016-02-26.pdf', text:'<a href="/publicfiles/011_2016-02-26.pdf">Newsletter Nr. 11</a> zur Veröffentlichung des Musikheftes <a href="/bandimpulse4/">Band-Impulse. Heft 4: Gehörbildung und Musiklehre. Übungen in Dur</a> (=OpenBook 9 / Heft4), Karlsfeld 2016.' },
    { pdf:'/publicfiles/010_2015-12-13.pdf', text:'<a href="/publicfiles/010_2015-12-13.pdf">Newsletter Nr. 10</a> zur Veröffentlichung des Musikheftes <a href="/inventionen/">Inventionen plus One. Kammermusik mit Johann Sebastian Bach</a> (=OpenBook 11), Karlsfeld 2015.' },
    { pdf:'/publicfiles/009_2015-12-07.pdf', text:'<a href="/publicfiles/009_2015-12-07.pdf">Newsletter Nr. 9</a> zur Veröffentlichung des Musikheftes <a href="/bandImpulse3/">Band-Impulse. Heft 3: Pattern und Styles 1 (Pop und Rap)</a> (=OpenBook 9 / Heft3), Karlsfeld 2015.' },
    { pdf:'/publicfiles/008_2015-09-21.pdf', text:'<a href="/publicfiles/008_2015-09-21.pdf">Newsletter Nr. 8</a> zur Veröffentlichung des Musikheftes <a href="/bandImpulse2/">Band-Impulse. Heft 2: Elise In Black</a> (=OpenBook 9 / Heft2), Karlsfeld 2015.' },
    { pdf:'/publicfiles/007_2015-07-12.pdf', text:'<a href="/publicfiles/007_2015-07-12.pdf">Newsletter Nr. 7</a> zum Relaunch der Website sowie zur Veröffentlichung des Musikheftes <a href="/Kinderhauslied/">Das Kinderhauslied.</a> (=OpenBook 10), Karlsfeld 2015.' },
    { pdf:'/publicfiles/006_2015-06-11.pdf', text:'<a href="/publicfiles/006_2015-06-11.pdf">Newsletter Nr. 6</a> zur Veröffentlichung des Musikheftes <a href="/bandImpulse1/">Band-Impulse. Heft 1: That Image.</a> (=OpenBook 9 / Heft1), Karlsfeld 2015.' },
    { pdf:'/publicfiles/005_2015-04-05.pdf', text:'<a href="/publicfiles/005_2015-04-05.pdf">Newsletter Nr. 5</a> zur Veröffentlichung des Heftes <a href="/harmonieundform/">Harmonielehre. Harmonie und Form für Kompositionen in Dur</a> (=OpenBook 8), Karlsfeld 2015.' },
    { pdf:'/publicfiles/004_2014-09-29.pdf', text:'<a href="/publicfiles/004_2014-09-29.pdf">Newsletter Nr. 4</a> zur Veröffentlichung des Heftes <a href="/kostenlosesoftware/">Kostenlose Software für den Musikunterricht.</a> (=OpenBook 7), Karlsfeld 2014.' },
    { pdf:'/publicfiles/003_2014-03-10.pdf', text:'<a href="/publicfiles/003_2014-03-10.pdf">Newsletter Nr. 3</a> zur Veröffentlichung des Kommentarheftes zu <a href="/beethoven5/">Ludwig van Beethoven. Die 5. Sinfonie</a> (= OpenBook 6), Karlsfeld 2014.' },
    { pdf:'/publicfiles/002_2014-01-12.pdf', text:'<a href="/publicfiles/002_2014-01-12.pdf">Newsletter Nr. 2</a> zur Veröffentlichung von <a href="/beethoven5/">Ludwig van Beethoven. Die 5. Sinfonie</a> (= OpenBook 6), Karlsfeld 2014.' },
    { pdf:'/publicfiles/001_2013-09-16.pdf', text:'<a href="/publicfiles/001_2013-09-16.pdf">Newsletter Nr. 1</a> zur Veröffentlichung von <a href="/lamento/">Lamentobass. Musik aus vier Jahrhunderten</a> (= OpenBook 5), Karlsfeld 2013.' },
  ];
  const rows = entries.map(e => `
      <div class="gridFraction"><a href="${e.pdf}" target="_blank"><img src="/images/pdficon_large.png" alt="PDF"></a></div>
      <div class="gridFraction"><div>${e.text}</div></div>`).join('');
  const body = `    <div class="jumbotron">
      <a href="/" class="closeX"><span>X</span></a>
      <div>${menu('/news')}</div>
      <h1>Newsletter</h1>
      <p class="jumbotron-text">
        Wenn Sie über die Neuerscheinung von OpenBooks informiert werden möchten, können Sie mir über <a class="orange1" href="https://kaiser-ulrich.de/formular">dieses Formular</a> eine Mailadresse zukommen lassen. Selbstverständlich wird Ihre Mailadresse von mir nicht weitergegeben (→ <a class="orange1" href="/impressum">Datenschutz</a>).
      </p>
    </div>
    <div class="gridBox">
      <div class="gridFraction displayNonInSmallDevices">PDF</div>
      <div class="gridFraction displayNonInSmallDevices">Kurzbeschreibung</div>${rows}
    </div>`;
  write(path.join(DIST,'news','index.html'), page({
    title:'OER | Ulrich Kaiser - Newsletter',
    desc:'Hier finden Sie Informationen zu den OpenBooks (OER) von Ulrich Kaiser in Form von Newslettern.',
    keywords:'News, Newsletter, OER, Open Educational Resources, OpenBooks', body
  }));
}

function genSoftware() {
  const body = `    <div class="jumbotron">
      <a href="/extras" class="closeX"><span>X</span></a>
      <div>${menu('/software')}</div>
      <h1>Software</h1>
    </div>
    <div class="gridBox">
      <div class="gridFraction"><a href="/data/xtras/milliongame.zip"><img src="/images/Screenshot-Player.png" alt="Million-Game"></a></div>
      <div class="gridFraction">
        Million-Game Player und Editor (Freeware) zum Spielen und Erstellen von Fragespielen. Benötigt das kostenlose <a href="https://de.wikipedia.org/wiki/.NET" target="_blank">.NET Framework 4.0</a> oder höher von Microsoft. Mit dem Million-Game Player können Fragespiele (nach dem Schema von <a href="http://de.wikipedia.org/wiki/Wer_wird_Million%C3%A4r%3F" target="_blank">diesem</a> Spiel) gespielt werden. Auch in diesem Spiel finden Sie drei Joker (50:50, Publikum, Telefon). Mit dem Million-Game Editor können Sie solche Spiele ganz einfach und ohne Programmierkenntnisse zu einem Thema ihrer Wahl herstellen.
      </div>
      <div class="gridFraction"><a href="/data/xtras/ekse.zip"><img src="/images/Screenshot-Ekse.png" alt="EKSE"></a></div>
      <div class="gridFraction">
        <span style="font-weight:bolder">EKSE − Der <span style="color:red">E</span>rinnerungs-<span style="color:red">K</span>arten-<span style="color:red">S</span>piel-<span style="color:red">E</span>rsteller</span><br>
        Benötigt das kostenlose <a href="https://de.wikipedia.org/wiki/.NET" target="_blank">.NET Framework 3.5</a> oder höher von Microsoft.<br><br>
        Mit diesem Editor können Sie Spiele wie die folgenden selbst herstellen:
        <ul>
          <li><a href="/data/xtras/LudwigVanBeethoven.zip">Das Beethoven-Spiel</a></li>
          <li><a href="/data/xtras/Komponisten.zip">Das Komponisten-Spiel</a></li>
        </ul>
        Diese und weitere Spiele zum Online-Spielen finden Sie <a href="https://musikanalyse.net/spielen/">hier</a>.
      </div>
      <div class="gridFraction"><a href="https://kaiser-ulrich.de/wellenwriter/home.html"><img src="/images/wellenwriter.png" alt="WellenWriter"></a></div>
      <div class="gridFraction">
        <span style="font-weight:bolder">WellenWriter</span><br>
        Ein nützliches Tool zum Visualisieren des Lautstärkeverlaufs einer Sound- oder Videodatei. WellenWriter verwendet <a href="https://github.com/katspaugh/wavesurfer.js" target="_blank">wavesurfer.js von Alex Khokhulin</a> (lizensiert unter CC BY). Den WellenWriter können Sie sich <a href="/data/xtras/wellenwriter.zip">hier</a> herunterladen.
      </div>
    </div>`;
  write(path.join(DIST,'software','index.html'), page({
    title:'OER | Ulrich Kaiser - Software',
    desc:'Software für den Musikunterricht, die im Zusammenhang mit den OpenBooks (OER) von Ulrich Kaiser stehen.',
    keywords:'Software, OER, Open Educational Resources, OpenBooks', body
  }));
}

function genVideos() {
  const body = `    <div class="jumbotron">
      <a href="/extras" class="closeX"><span>X</span></a>
      <div>${menu('/videos')}</div>
      <h1>Videos</h1>
    </div>
    <div class="gridBox">
      <div class="gridFraction" style="width:320px;height:240px">
        <video controls poster="/data/videos/poster-beethoven5.png"><source src="/data/videos/Beethoven-5.webm" type="video/mp4"></video>
      </div>
      <div class="gridFraction"><div>In diesem Video sehen Sie eine Unterrichtsdemonstration einer Höranalyse zur Exposition der 5. Sinfonie von Ludwig v. Beethoven.</div></div>
      <div class="gridFraction" style="width:320px;height:240px">
        <video controls poster="/data/videos/poster-dur.png"><source src="/data/videos/Gb-Dur.webm" type="video/mp4"></video>
      </div>
      <div class="gridFraction"><div>Eine wichtige Fähigkeit für das Erleben tonaler Musik ist die Fähigkeit, den Charakter eines Tones zum Grundton hören und erkennen zu können.</div></div>
      <div class="gridFraction" style="width:320px;height:240px">
        <video controls poster="/data/videos/poster-moll.png"><source src="/data/videos/Gb-Moll.webm" type="video/mp4"></video>
      </div>
      <div class="gridFraction"><div>In diesem Video sehen Sie eine Unterrichtsdemonstration zur Gehörbildung in Moll über Zahlen.</div></div>
      <div class="gridFraction" style="width:320px;height:240px">
        <video controls poster="/data/videos/poster-DasKinderhauslied.png"><source src="/data/videos/DasKinderhauslied.webm" type="video/mp4"></video>
      </div>
      <div class="gridFraction"><div>In diesem Video sehen Sie die Uraufführung des Kinderhausliedes zum Festgottestdienst des 50jährigen Bestehens des Kinderhauses Sankt Josef.</div></div>
      <div class="gridFraction" style="width:320px;height:240px">
        <video controls poster="/images/brahms5.png"><source src="https://oer-musik.de/publicfiles/Brahms-UngarTanz5.mp4" type="video/mp4"></video>
      </div>
      <div class="gridFraction"><div>In diesem Video können Sie einen kleinen Ausschnitt der Uraufführung des Ungarischen Tanzes Nr. 5 von Johannes Brahms durch das Orchester der Musikschule Holzmengen/Hosman in Rumänien sehen.</div></div>
    </div>`;
  write(path.join(DIST,'videos','index.html'), page({
    title:'OER | Ulrich Kaiser - Videos',
    desc:'Videos, die im Zusammenhang mit den OpenBooks (OER) von Ulrich Kaiser stehen.',
    keywords:'Videos, OER, Open Educational Resources, OpenBooks', body
  }));
}

function genPrint() {
  const body = `    <div class="jumbotron">
      <a href="/" class="closeX"><span>X</span></a>
      <div>${menu('/print')}</div>
      <h1>Druck</h1>
      <p class="jumbotron-text">Da meine (insbesondere die vor 2020 veröffentlichten) Druckdateien den o.g. Standards nicht entsprechen, gebe ich im Folgenden eine Übersicht über die von mir bisher beauftragten Druckereien sowie die dabei aufgetretenen Probleme:</p>
    </div>
    <div class="colorBox">
      <h3>Worauf Sie achten sollten...</h3>
      <p>Über Jahre hatte ich keine Probleme mit den hier bereitgestellten Druckdateien für meine OpenBooks in der Online-Druckerei Wir-Machen-Druck.de (= WMD). Die Reklamation einer fehlerhaft gedruckten Abbildung in meinem OpenBook <i>Filmmusik</i> allerdings wurde im Oktober 2020 abgelehnt, weil meine Druckdateien nicht den PDF-Standards PDF/X-1a:2001 oder X3:2002 entsprechen. <b>Das heißt im Klartext: WMD garantiert Ihnen bei der Verwendung der hier vor 2020 bereit gestellten OpenBook-Druckdateien keinen fehlerfreien Druck!</b></p>
    </div>
    <div class="gridBox">
      <div class="gridFraction"><a href="https://www.viaprinto.de"><img src="https://www.viaprinto.de/viaprintoweb/dotcms_themes/productpage/images/viaprinto-logo-claim.svg" alt="viaprinto"></a></div>
      <div class="gridFraction">Die Drucke von Viaprinto hatten immer eine sehr gute Qualität, allerdings ist diese Online-Druckerei im Vergleich sehr teuer und damit für Privatanwender nur bedingt geeignet.</div>
      <div class="gridFraction"><a href="https://www.wir-machen-druck.de/"><img src="https://www.wir-machen-druck.de/tpl/manns-partner/section_template/images/logo.png" alt="WMD"></a></div>
      <div class="gridFraction">Die Drucke von WMD sind sehr günstig und in der Regel auch gut. Seit Oktober 2020 übernimmt WMD für ein korrektes Druckergebnis meiner Druckdateien keine Gewähr mehr (s.o.).</div>
      <div class="gridFraction"><a href="https://www.saxoprint.de/"><img src="https://www.saxoprint.de/Librarys/test/logo.svg" alt="Saxoprint"></a></div>
      <div class="gridFraction">Die Drucke von Saxoprint sind vergleichbar günstig wie die Drucke von WMD. Das Exemplar des OpenBooks Filmmusik, das von WMD nicht fehlerfrei gedruckt werden konnte, konnte bei Saxoprint allerdings fehlerfrei gedruckt werden.</div>
    </div>
    <hr>
    <h2>Druckdateien zum Download (mit Anschnitt, jedoch ohne Gewähr)</h2>
    <h3>Unterrichtshefte für allgemeinbildende Schulen</h3>
    <ul>
      <li><a href="/data/openbooks/PrintDownloadFiles/Kaiser_BachUnterrichtsheft_2016-10-07_mAnschnitt.pdf"><i>Ulrich Kaiser, Johann Sebastian Bach. Ein Superstar gestern und heute (= OpenBook 2), Unterrichtsheft, Karlsfeld 2011.</i></a></li>
      <li><a href="/data/openbooks/PrintDownloadFiles/Kaiser_BachKommentarheft_2016-11-07_optimiert-wmd.pdf"><i>Ulrich Kaiser, Johann Sebastian Bach. Ein Superstar gestern und heute (= OpenBook 2), Kommentarheft, Karlsfeld 2011.</i></a></li>
      <li><a href="/data/openbooks/PrintDownloadFiles/kaiser_filmmusik_2020-10-17_mAnschnitt.pdf"><i>Ulrich Kaiser, Filmmusik (= OpenBook 15), Karlsfeld 2020.</i></a></li>
      <li><a href="/data/openbooks/PrintDownloadFiles/kaiser_formenlehre_2019-03-16_mA.pdf"><i>Ulrich Kaiser, Formenlehre der Musik, Karlsfeld 2019.</i></a></li>
      <li><a href="/data/openbooks/PrintDownloadFiles/Kaiser_KostenloseSoftware_release_2016-07-26-mAnschnitt.pdf"><i>Ulrich Kaiser, Kostenlose Software für den Musikunterricht (= OpenBook 7), Karlsfeld 2014, 2. korr. Aufl. 2016.</i></a></li>
      <li><a href="/data/openbooks/PrintDownloadFiles/Kaiser_trInstrumente_2016-10-07_release-mAnschnitt.pdf"><i>Ulrich Kaiser, Orchesterinstrumente. Transponierende Instrumente (= OpenBook 16), Karlsfeld 2016.</i></a></li>
    </ul>
    <h3>Musikhefte für allgemeinbildende Schulen</h3>
    <ul>
      <li><a href="/data/openbooks/PrintDownloadFiles/Unterrichtsheft_BandImpulse-1_ThatImage_2015-06-16-mA.pdf"><i>Ulrich Kaiser, Band-Impulse. Heft 1: That Image (= OpenBook 9 / Heft 1), Karlsfeld 2015.</i></a></li>
      <li><a href="/data/openbooks/PrintDownloadFiles/Unterrichtsheft_BandImpulse-2_EliseInBlack_2015-09-21-mA.pdf"><i>Ulrich Kaiser, Band-Impulse. Heft 2: Elise In Black (= OpenBook 9 / Heft 2), Karlsfeld 2015.</i></a></li>
      <li><a href="/data/openbooks/PrintDownloadFiles/Unterrichtsheft_BandImpulse-3_PatternStyles1_2015-12-17-mA.pdf"><i>Ulrich Kaiser, Band-Impulse. Heft 3: Pattern und Styles 1 (= OpenBook 9 / Heft 3), Karlsfeld 2015.</i></a></li>
      <li><a href="/data/openbooks/PrintDownloadFiles/Unterrichtsheft_BandImpulse-4_Musiklehre1_2016-02-26-mA.pdf"><i>Ulrich Kaiser, Band-Impulse. Heft 4: Gehörbildung und Musiklehre. Übungen in Dur (= OpenBook 9 / Heft 4), Karlsfeld 2016.</i></a></li>
      <li><a href="/data/openbooks/PrintDownloadFiles/kaiser_brahms5_2017-02-18_mA.pdf"><i>Johannes Brahms. Ungarischer Tanz Nr. 5 arrangiert und mit einer Einleitung versehen von Ulrich Kaiser (= OpenBook 18/1), Karlsfeld 2017.</i></a></li>
      <li><a href="/data/openbooks/PrintDownloadFiles/kaiser_carmensuite_2017-09-29_mA.pdf"><i>George Bizet. Carmen zu einer Suite arrangiert von Ulrich Kaiser (= OpenBook 18/2), Karlsfeld 2017.</i></a></li>
    </ul>
    <h3>Musikhefte für Musikschulen</h3>
    <ul>
      <li><a href="/data/openbooks/PrintDownloadFiles/Unterrichtsheft-InventionenPlusOne_2015-12-12-mA.pdf"><i>Ulrich Kaiser, Inventionen plus One. Kammermusik mit Johann Sebastian Bach (= OpenBook 11), Karlsfeld 2015.</i></a></li>
      <li><a href="/data/openbooks/PrintDownloadFiles/kaiser_happyforChoir_2017-04-06_mAnschnitt.pdf"><i>Kanon und 8 Variationen über Happy Birthday To You (= OpenBook 14/2), Karlsfeld 2017.</i></a></li>
      <li><a href="/data/openbooks/PrintDownloadFiles/Kaiser_HarmonieUndForm_release_2015-08-01-mAnschnitt.pdf"><i>Ulrich Kaiser, Harmonielehre. Harmonie und Form für Kompositionen in Dur (= OpenBook 8), Karlsfeld 2015.</i></a></li>
      <li><a href="/data/openbooks/PrintDownloadFiles/Kaiser_HarmonielehreReloaded_release_2016-07-24-mAnschnitt.pdf"><i>Ulrich Kaiser, Harmonielehre #reloaded (= OpenBook 12), Karlsfeld 2016.</i></a></li>
      <li><a href="/data/openbooks/PrintDownloadFiles/kaiser_brahms-partitur-vlvl-mA.pdf"><i>J. Brahms. Walzer aus Op. 39 arrangiert für 2 Violinen von Ulrich Kaiser (= OpenBook 17/1), Karlsfeld 2021.</i></a></li>
    </ul>
    <h3>Musikhefte für Grundschulen und Kindergärten</h3>
    <ul>
      <li><a href="/data/openbooks/PrintDownloadFiles/Kinderhaus-Musikheft_2015-07-12-mA.pdf"><i>Ulrich Kaiser, Das Kinderhauslied (= OpenBook 10), Karlsfeld 2015.</i></a></li>
    </ul>`;
  write(path.join(DIST,'print','index.html'), page({
    title:'OER | Ulrich Kaiser - Print',
    desc:'Hier finden Sie Informationen zum Druck sowie Druckdateien zu den OpenBooks (OER) von Ulrich Kaiser.',
    keywords:'Druck, Druckdateien, OER, Open Educational Resources, OpenBooks', body
  }));
}

function genErrata() {
  const body = `    <div class="jumbotron">
      <a href="/" class="closeX"><span>X</span></a>
      <div>${menu('/errata')}</div>
      <h1>Errata</h1>
      <p class="jumbotron-text">Um die OpenBooks im Hinblick auf die Beständigkeit Ihres Inhalts mit Printpublikationen vergleichbar zu machen, wird auf dieser Seite der Umgang mit Fehlern offen gelegt.</p>
    </div>
    <div class="colorBox">
      <ol style="margin-left:1.5em">
        <li>Eine beim Print-On-Demand-Anbieter hinterlegte und veröffentlichte PDF-Datei zählt als Auflage.</li>
        <li>Wird eine veränderte Druckdatei hochgeladen, wird diese als Neuauflage gekennzeichnet. Beim Print-On-Demand-Anbieter hinterlegte druckfertige PDF-Dateien werden für den Fall, dass ein Fehler entdeckt wird, nicht geändert.</li>
        <li>Erlange ich Kenntnis von Fehlern in meinen OpenBooks, werden jedoch die auf dieser Domain angebotenen PDF-Dateien möglichst zeitnah aktualisiert.</li>
        <li>Alle Abweichungen zwischen der Printversion und den auf dieser Domain angeboteten PDF-Dateien sind dokumentiert und werden hier veröffentlicht.</li>
      </ol>
    </div>
    <h3>Folgende Fehler wurden korrigiert:</h3><br>
    <div class="gridBox">
      <div class="gridFraction">Formenlehre der Musik</div>
      <div class="gridFraction">Links (U2) vervollständigt, einige Flüchtigkeitsfehler korrigiert und das OpenBook mit Ghostscript neu kompiliert (korrigiert am 16.03.2019).</div>
      <div class="gridFraction">Harmonielehre #reloaded</div>
      <div class="gridFraction">U2: Verweis auf das "Kommentarheft" gestrichen (korrigiert am 05.11.2016)<br>S. 4: "die" vor "Harmonik" ergänzt (05.11.2016)<br>S. 17: Basstimme zu Bassstimme verbessert (21.07.2016)</div>
      <div class="gridFraction">Band-Impulse. Heft 3: Pattern und Styles 1</div>
      <div class="gridFraction">Vorwort (S. 5): Der Name von Marcel Korazija war falsch geschrieben (korrigiert am 17.12.2015).<br>Alle Seitenzählungen um 2 zu hoch, Paginierung korrigiert (17.12.2015).</div>
      <div class="gridFraction">Band-Impulse. Heft 1: That Image</div>
      <div class="gridFraction">S. 10: In der Gitarrenstimme mit vereinfachten Powerchords muss antelle der Quinte d-a die Quinte h-fis gespielt werden (korrigiert am 11.06.2015).<br>S. 12: Fingersatz der linken Hand verbessert (16.06.2015).</div>
      <div class="gridFraction">Harmonielehre. Harmonie und Form für Kompositionen in Dur</div>
      <div class="gridFraction">S. 11: Fehlerhafte Abkürzung (»Han-d‹) entfernt (korrigiert am 01.08.2015).</div>
      <div class="gridFraction">Ludwig v. Beethoven. Die fünfte Sinfonie</div>
      <div class="gridFraction">S. 4 (Unterrichtsheft): Bei der Abbildung "Ludwig van Beethoven mit 13 Jahren" handelt es sich laut freundlicher Auskunft von Friederike Grigat nicht um Beethoven, sondern um ein anonymes Jungenbildnis (korrigiert am 02.04.2014).</div>
      <div class="gridFraction">Lamentobass. Musik aus vier Jahrhunderten</div>
      <div class="gridFraction">S. 27 (Unterrichtsheft): Vorzeichen (fis) fehlt in den Notenbeispielen (korrigiert am 15.07.2014).</div>
      <div class="gridFraction">Praktische Harmonielehre: Sequenzen (für Kinder)</div>
      <div class="gridFraction">S. 9 (Unterrichtsheft): Übersichtstabelle, zweite Reihe, dritte Spalte, Wortwiederholung ("Als als") entfernt (korrigiert am 27.01.2013).</div>
      <div class="gridFraction">Johann Sebastian Bach. Ein Superstar gestern und heute</div>
      <div class="gridFraction">S. 9 (Unterrichtsheft): Die Taktangabe im "Diagramm der mustergültigen Fuge" ist verrutscht (korrigiert am 28.03.2012).<br>S. 27: Die Zahlen in der Abbildung zur Intervallbestimmung sind verrutscht (korrigiert am 22.10.2012).<br>S. 4 (Kommentarheft): Armin "Schidlow" zu Armin Schidlo korrigiert (22.10.2012).</div>
    </div>`;
  write(path.join(DIST,'errata','index.html'), page({
    title:'OER | Ulrich Kaiser - Errata',
    desc:'Hier finden Sie eine Übersicht der mir bekannten Irrtümer, die sich in die publizierten OpenBooks (OER) von Ulrich Kaiser eingeschlichen haben.',
    keywords:'Errata, Irrtümer, OER, Open Educational Resources, OpenBooks', body
  }));
}

function genRoadmap() {
  const rows = [
    ['Nr. 21','Die Winterreise',false,false,'2023'],
    ['Nr. 20','<a href="https://openmusic.academy/docs/Px7epURXWsBLoE4fKzFBsW/">Chorsingen? Easy-Peasy! 12 einfache Chorsätze</a>',true,true,'2023'],
    ['Nr. 19','<a href="https://openmusic.academy/docs/Px7epURXWsBLoE4fKzFBsW/">Konzertsatz für Violine und Orchester</a>',false,false,'2021'],
    ['Nr. 18/3','Walzer Op. 39 arrangiert für Orchester',false,false,'2021'],
    ['Nr. 18/2','<a href="https://openmusic.academy/docs/E1dainJq33bSghxHgr3Mfc">Carmen-Fantasie von Ulrich Kaiser</a>',true,true,'2017'],
    ['Nr. 18/1','<a href="/oer-johannes-brahms-ungarischer-tanz-5/">Johannes Brahms. Ungarischer Tanz Nr. 5</a>',true,true,'2017'],
    ['Nr. 17/2','J. Brahms. Walzer aus Op. 39 arrangiert für Violine und Akkordeon',false,false,'2021'],
    ['Nr. 17/1','<a href="/oer-walzer-von-brahms-arrangiert-fuer-zwei-violinen/">J. Brahms. Walzer aus Op. 39 arrangiert für 2 Violinen</a>',true,true,'2021'],
    ['Nr. 16','<a href="/oer-orchesterinstrumente-transponierende-instrumente/">Orchesterinstrumente. Transponierende Instrumente</a>',true,true,'2016'],
    ['Nr. 15','<a href="https://openmusic.academy/docs/NvCYdJuLSa7wFXBs1xf9k8/schule-filmmusik-openbook">Filmmusik</a>',true,true,'2020'],
    ['Nr. 14/2','<a href="https://openmusic.academy/docs/gyZt9Vu2qZn5bysPPdS9M3/">Kanon und 8 Variationen über Happy Birthday To You für vierstimmig gemischten Chor</a>',true,true,'2017'],
    ['Nr. 14/1','<a href="https://openmusic.academy/docs/qbTvWPnFEEWPRMuStHHoqf/">Thema und 12 Variationen über Happy Birthday To You für zwei beliebige Melodieinstrumente</a>',true,true,'2017'],
    ['Nr. 13','<a href="/oer-formenlehre-der-musik/">Formenlehre</a>',true,true,'2019'],
    ['Nr. 12','<a href="/oer-harmonielehre-reloaded-eine-praktische-anleitung-fuer-musikerinnen-und-musiker/">Harmonielehre #reloaded</a>',true,true,'2016'],
    ['Nr. 11','<a href="https://openmusic.academy/docs/KV9CighBEVoAW2D8Nh4iPN/bach-inventionen-plus-one">Inventionen plus One</a>',true,true,'2015'],
    ['Nr. 10','<a href="https://openmusic.academy/docs/iaSQFz196ND5CadjYekn7k/das-kinderhauslied">Das Kinderhauslied</a>',true,true,'2015'],
    ['Nr. 09/4','<a href="/oer-band-impulse-heft-4-gehoerbildung-und-musiklehre/">Band-Impulse. Heft 4: Gehörbildung und Musiklehre</a>',true,true,'2016'],
    ['Nr. 09/3','<a href="/oer-band-impulse-heft-3-pattern-und-styles-1/">Band-Impulse. Heft 3: Pattern und Styles 1</a>',true,true,'2015'],
    ['Nr. 09/2','<a href="/oer-band-impulse-heft-2-elise-in-black/">Band-Impulse. Heft 2: Elise In Black</a>',true,true,'2015'],
    ['Nr. 09/1','<a href="https://openmusic.academy/docs/q9RGjWnB5J3nV3rTHRpgif/bandklasse-mitspielsatz-that-image">Band-Impulse. Heft 1: That Image</a>',true,true,'2015'],
    ['Nr. 08','<a href="/oer-harmonielehre-harmonie-und-form-fuer-kompositionen-in-dur/">Harmonielehre. Harmonie und Form für Kompositionen in Dur</a>',true,true,'2015'],
    ['Nr. 07','<a href="/oer-kostenlose-software-fuer-den-musikunterricht/">Kostenlose Software für den Musikunterricht</a>',true,true,'2014'],
    ['Nr. 06','<a href="/oer-ludwig-van-beethoven-die-fuenfte-sinfonie/">Ludwig van Beethoven. Die 5. Sinfonie</a>',true,false,'2014'],
    ['Nr. 05','<a href="/oer-lamentobass-musik-aus-vier-jahrhunderten/">Lamentobass. Musik aus vier Jahrhunderten</a>',true,false,'2013'],
    ['Nr. 04','<a href="/oer-praktische-harmonielehre-sequenzen-fuer-kinder/">Praktische Harmonielehre: Sequenzen</a>',true,false,'2013'],
    ['Nr. 03','<a href="/oer-intervalle-und-akkorde/">Intervalle und Akkorde</a>',true,false,'2012'],
    ['Nr. 02','<a href="/oer-johann-sebastian-bach-ein-superstar-gestern-und-heute/">Johann Sebastian Bach</a>',true,true,'2011'],
    ['Nr. 01','<a href="/oer-sonate-und-sinfonie-ein-altes-thema-auf-neuen-wegen/">Sonate und Sinfonie (2. überarbeitete Aufl. 2012)</a>',true,false,'2011'],
  ].map(([nr,title,online,print,year]) => {
    const tick = '<img src="/images/Tick.png" alt="Ja">';
    const cross = '<img src="/images/Cross.png" alt="Nein">';
    return `<div class="gridFraction">${nr}</div><div class="gridFraction">${title}</div><div class="gridFraction displayNonInSmallDevices">${online?tick:cross}</div><div class="gridFraction">${print?`<a href="/print">${tick}</a>`:cross}</div><div class="gridFraction displayNonInSmallDevices">${year}</div>`;
  }).join('\n        ');
  const body = `    <div class="jumbotron">
      <a href="/" class="closeX"><span>X</span></a>
      <div>${menu('/roadmap')}</div>
    </div>
    <div class="roadmapGridBox">
      <div class="gridFraction displayNonInSmallDevices">OER</div>
      <div class="gridFraction displayNonInSmallDevices">Werktitel</div>
      <div class="gridFraction displayNonInSmallDevices">Online</div>
      <div class="gridFraction displayNonInSmallDevices">Print</div>
      <div class="gridFraction displayNonInSmallDevices">Termin</div>
        ${rows}
    </div>`;
  write(path.join(DIST,'roadmap','index.html'), page({
    title:'OER | Ulrich Kaiser - Roadmap',
    desc:'Hier finden Sie eine Übersicht über die fertiggestellten und in Planung befindlichen OpenBooks (OER) von Ulrich Kaiser.',
    keywords:'Roadmap, Planungen, OER, Open Educational Resources, OpenBooks', body
  }));
}

function genImpressum() {
  const body = `    <div class="jumbotron">
      <a href="/" class="closeX"><span>X</span></a>
      <div>${menu('/impressum')}</div>
      <h1>DSGVO / Impressum</h1>
      <h2>Datenschutzerklärung (nach DSGVO)</h2>
    </div>
    <div>
      <p>Diese Website ist ein Angebot im Sinne des <a href="https://www.gesetze-im-internet.de/tmg/TMG.pdf" rel="noopener">Telemediengesetzes (TMG)</a>. Durch Aufruf und Nutzung dieser Seite übermitteln Sie auch Daten an uns. Der Umgang mit diesen Daten wird geregelt durch das TMG, die <a href="https://eur-lex.europa.eu/legal-content/DE/TXT/PDF/?uri=CELEX:32016R0679&rid=1" rel="noopener">Datenschutz-Grundverordnung der EU (DSGVO)</a> und das <a href="https://www.bgbl.de/xaver/bgbl/start.xav?start=%2F%2F*%5B%40attr_id%3D%27bgbl117s2097.pdf%27%5D" rel="noopener">Bundesdatenschutzgesetz (BDSG)</a>.</p>
      <h3>1) Name und Anschrift des für die Verarbeitung Verantwortlichen</h3>
      <p>Inhaber dieser Website ist <a href="https://kaiser-ulrich.de/">Prof. Dr. Ulrich Kaiser</a>.</p>
      <p>
        Inhaber: Prof. Dr. Ulrich Kaiser<br>
        Telefon: +49 89 289 27427<br>
        Adresse dienstl.: Hochschule für Musik und Theater München, Arcisstr. 12, 80333 München<br>
        Adresse privat: Birkenstr. 39c, 85757 Karlsfeld<br>
        Mail: kontakt['at.]kaiser-ulrich.de<br>
        Formulare: <a href="https://kaiser-ulrich.de/formular">privat</a> oder <a href="https://website.hmtm.de/de/hochschule/lehrende?inst=11">dienstlich</a>
      </p>
      <h3>2) Umfang und Zweck der Datenerhebung</h3>
      <h4>Bereitstellung der Website und Erstellung von Logfiles</h4>
      <p>Diese Seite wird über ein Hosting-Paket bei 1&amp;1 bereitgestellt. Bei jedem Aufruf unserer Internetseite könnten von 1&amp;1 folgende Daten durch Serverlogfiles erhoben werden: IP-Adresse und Hostname, Zugriffszeitpunkt, vom Besucher verwendeter Browser und Betriebssystem, Herkunftslink, Verweildauer, Anzahl aufgerufener Seiten.</p>
      <h3>3) Wie und wo wir Ihre Daten verarbeiten und speichern</h3>
      <p>Die vorübergehende Speicherung der IP-Adresse durch das System ist notwendig, um eine Auslieferung der Website an den Rechner des Nutzers zu ermöglichen. Die Speicherung in Logfiles erfolgt, um die Funktionsfähigkeit der Website sicherzustellen.</p>
      <h3>4) Ihre Rechte (Rechte der betroffenen Person)</h3>
      <p>Werden personenbezogene Daten von Ihnen verarbeitet, sind Sie Betroffener i.S.d. DSGVO und es stehen Ihnen folgende Rechte gegenüber dem Verantwortlichen zu: Auskunftsrecht, Recht auf Berichtigung, Recht auf Einschränkung der Verarbeitung, Recht auf Löschung, Recht auf Datenübertragbarkeit, Widerspruchsrecht.</p>
      <h4>Recht auf Beschwerde bei einer Aufsichtsbehörde</h4>
      <p>Unbeschadet eines anderweitigen verwaltungsrechtlichen oder gerichtlichen Rechtsbehelfs steht Ihnen das Recht auf Beschwerde bei einer Aufsichtsbehörde zu, wenn Sie der Ansicht sind, dass die Verarbeitung der Sie betreffenden personenbezogenen Daten gegen die DSGVO verstößt.</p>
      <h2>Impressum</h2>
      <p><b>Angaben gemäß § 5 TMG und verantwortlich für den Inhalt nach § 55 Abs. 2 RStV:</b></p>
      <address>
        <span>Ulrich Kaiser</span><br>
        <span>Birkenstr. 39c</span><br>
        <span>85757 Karlsfeld</span>
      </address>
      <h4>Kontakt:</h4>
      <address>
        <span>Telefon: +89 / 289-27427</span><br>
        <span>Mail: kontakt['at.]kaiser-ulrich.de</span>
      </address>
      <h4>Online-Streitbeilegung</h4>
      <p>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="http://ec.europa.eu/consumers/odr">http://ec.europa.eu/consumers/odr</a></p>
      <h4>Haftungsausschluss</h4>
      <p>Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen.</p>
      <p>Quelle: <a href="https://www.e-recht24.de/">eRecht24</a></p>
    </div>`;
  write(path.join(DIST,'impressum','index.html'), page({
    title:'OER | Ulrich Kaiser - Impressum/DSGVO',
    desc:'Hier finden Sie die rechtlichen Informationen zu dieser Website.',
    keywords:'Impressum, DSGVO, TMG', body
  }));
}

// ==================== ADDITIONALS PAGES ====================

function genAdditionalsBlender() {
  const body = `    <div style="position:relative">
      <a href="/oer-filmmusik/" class="closeX"><span>X</span></a>
      <h2>Filme von Blender</h2>
    </div>
    <div style="margin-top:20px">
      Auf dieser Seite finden Sie Links zu den unter CC-Lizenz veröffentlichten Filmen von <a href="https://blender.org">Blender</a>, die aufgrund der freien Lizenz für einen kreativen Unterricht zum Thema Film geeignet sind.
    </div>
    <div id="content">
      <ul style="list-style-position:inside">
        <li><a href="#ElephantsDream">Elephants Dream (2006)</a></li>
        <li><a href="#BigBuckBunny">Big Buck Bunny (2008)</a></li>
        <li><a href="#Sintel">Sintel (2010)</a></li>
        <li><a href="#TearsOfSteel">Tears of Steel (2012)</a></li>
        <li><a href="#Caminandes12">Caminandes 1 &amp; 2 (2013)</a></li>
        <li><a href="#CosmosLaundromat">Cosmos Laundromat (2015)</a></li>
        <li><a href="#GlassHalf">Glass Half (2015)</a></li>
        <li><a href="#Caminandes3">Caminandes 3: Llamigos (2016)</a></li>
        <li><a href="#Agent327">Agent 327: Operation Barbershop (2017)</a></li>
        <li><a href="#TheDailyDweebs">The Daily Dweebs (2017)</a></li>
        <li><a href="#Hero">Hero (2018)</a></li>
        <li><a href="#Spring">Spring (2019)</a></li>
        <li><a href="#CoffeeRun">Coffee Run (2020)</a></li>
      </ul>
    </div>
    <h2 style="margin-bottom:20px">Links und Kurzbeschreibungen</h2>
    <div class="gridBox">
      <div id="ElephantsDream" class="gridFraction"><p><a href="https://orange.blender.org/">Elephants Dream (2006)</a><br><a href="https://www.youtube.com/watch?v=TLkA0RELQ1g">Elephants Dream auf YouTube</a><br><a href="#content">Zurück zum Inhaltsverzeichnis</a></p></div>
      <div class="gridFraction"><b>Elephants Dream</b> war der erste unter CC-BY-Lizenz veröffentlichte Film der Blender Foundation. In dem Film führt Proog den jungen Emo durch eine riesige Maschine.</div>
      <div id="BigBuckBunny" class="gridFraction"><p><a href="https://peach.blender.org/">Big Buck Bunny (2008)</a><br><a href="https://www.youtube.com/watch?v=aqz-KE-bpKQ">Big Buck Bunny auf YouTube</a><br><a href="#content">Zurück</a></p></div>
      <div class="gridFraction"><b>Big Buck Bunny</b> war der zweite unter CC-BY-Lizenz veröffentlichte Film der Blender Foundation. Der Big-Buck-Bunny-Film ist Gegenstand des OpenBooks: <a href="/oer-filmmusik/">Filmmusik</a></div>
      <div id="Sintel" class="gridFraction"><p><a href="https://durian.blender.org/">Sintel (2010)</a><br><a href="https://www.youtube.com/watch?v=eRsGyueVLvQ">Sintel auf YouTube</a><br><a href="#content">Zurück</a></p></div>
      <div class="gridFraction"><b>Sintel</b> war der dritte unter CC-BY-Lizenz veröffentlichte Film der Blender Foundation. Der Sintel-Film ist Gegenstand des OpenBooks: <a href="/oer-filmmusik/">Filmmusik</a></div>
      <div id="TearsOfSteel" class="gridFraction"><p><a href="https://mango.blender.org/">Tears of Steel (2012)</a><br><a href="https://www.youtube.com/watch?v=R6MlUcmOul8">Tears of Steel auf YouTube</a><br><a href="#content">Zurück</a></p></div>
      <div class="gridFraction"><b>Tears of Steel</b> ist ein Science-Fiction-Film, in dem eine Gruppe von Kämpfern und Wissenschaftlern versucht, die Welt vor zerstörerischen Robotern zu retten.</div>
      <div id="Caminandes12" class="gridFraction"><p><a href="http://www.caminandes.com/">Caminandes 1-2 (2013)</a><br><a href="https://www.youtube.com/watch?v=JOhiWY7XmoY">Llama Drama auf YouTube</a><br><a href="#content">Zurück</a></p></div>
      <div class="gridFraction"><b>Caminandes 1/2</b> sind Kurzfilme, in denen das Lama Koro jeweils eine Aufgabe zu bewältigen hat. Diese Filme sind Gegenstand des OpenBooks: <a href="/oer-filmmusik/">Filmmusik</a></div>
      <div id="CosmosLaundromat" class="gridFraction"><p><a href="https://gooseberry.blender.org/">Cosmos Laundromat (2015)</a><br><a href="https://www.youtube.com/watch?v=Y-rmzh0PI3c">Cosmos Laundromat auf YouTube</a><br><a href="#content">Zurück</a></p></div>
      <div class="gridFraction"><b>Cosmos Laundromat</b> ist der erste Teil des Gooseberry Open Movie Projects.</div>
      <div id="GlassHalf" class="gridFraction"><p><a href="https://cloud.blender.org/p/glass-half/">Glass Half (2015)</a><br><a href="https://www.youtube.com/watch?v=lqiN98z6Dak">Glass Half auf YouTube</a><br><a href="#content">Zurück</a></p></div>
      <div class="gridFraction"><b>Glass Half</b> ist ein Cartoon-Film, in dem sich zwei Kunstkenner in einer Galerie über die ausgestellten Kunstwerke leidenschaftlich streiten.</div>
      <div id="Caminandes3" class="gridFraction"><p><a href="http://www.caminandes.com/">Caminandes 3: Llamigos (2016)</a><br><a href="https://www.youtube.com/watch?v=qlPpg4tJYhk">Llamigos auf YouTube</a><br><a href="#content">Zurück</a></p></div>
      <div class="gridFraction"><b>Caminandes 3: Llamigos</b> ist der dritte Film aus der Caminandes-Reihe.</div>
      <div id="Agent327" class="gridFraction"><p><a href="https://agent327.com/">Agent 327: Operation Barbershop (2017)</a><br><a href="https://www.youtube.com/watch?v=mN0zPOpADL4">Operation Barbershop auf YouTube</a><br><a href="#content">Zurück</a></p></div>
      <div class="gridFraction"><b>Agent 327: Operation Barbershop</b> ist ein vierminütiger Kurzfilm nach der Comicserie von Martin Lodewijk.</div>
      <div id="TheDailyDweebs" class="gridFraction"><p><a href="https://www.dailydweebs.com/">The Daily Dweebs (2017)</a><br><a href="https://www.youtube.com/watch?v=ODoFNi5BgOY">The Daily Dweebs auf YouTube</a><br><a href="#content">Zurück</a></p></div>
      <div class="gridFraction"><b>The Daily Dweebs</b> ist ein knapp eine Minute langer Kurzfilm über Süßigkeiten, die zu einem Streit führen.</div>
      <div id="Hero" class="gridFraction"><p><a href="https://cloud.blender.org/p/hero/">Hero (2018)</a><br><a href="https://www.youtube.com/watch?v=AHYGs9B5atQ">Hero auf YouTube</a><br><a href="#content">Zurück</a></p></div>
      <div class="gridFraction"><b>Hero</b> ist ein Action-Cartoon über ein Energieobjekt, um das zwei Parteien kämpfen.</div>
      <div id="Spring" class="gridFraction"><p><a href="https://cloud.blender.org/p/spring/">Spring (2019)</a><br><a href="https://www.youtube.com/watch?v=WhWc3b3KhnY">Spring auf YouTube</a><br><a href="#content">Zurück</a></p></div>
      <div class="gridFraction"><b>Spring</b> ist wie Sintel ein Fantasy-Film. Er erzählt die Geschichte eines Hirtenmädchens und ihres kleinen Hundes.</div>
      <div id="CoffeeRun" class="gridFraction"><p><a href="https://cloud.blender.org/p/spring/">Coffee Run (2020)</a><br><a href="https://www.youtube.com/watch?v=PVGeM40dABA">Coffee Run auf YouTube</a><br><a href="#content">Zurück</a></p></div>
      <div class="gridFraction"><b>Coffee Run</b> ist ein dreiminütiger Cartoon-Film, in dem eine Frau Kaffee trinkt, der wie ein super Energy-Drink wirkt.</div>
    </div>`;
  write(path.join(DIST,'additionals-blender-projekte','index.html'), page({
    title:'OER | Ulrich Kaiser - Filme von Blender',
    desc:'Hier finden Sie Links zu den unter CC-Lizenz veröffentlichten Filmen von Blender.',
    keywords:'Filmmusik, Blender, OER, Open Educational Resources, OpenBooks', body
  }));
}

function genAdditionalsSintelProjekte() {
  const body = `    <div style="position:relative">
      <a href="/oer-filmmusik/" class="closeX"><span>X</span></a>
      <h2>Projekte zur OER Filmmusik</h2>
    </div>
    <div style="margin-top:20px;display:flex">
      <a href="/oer-filmmusik/"><img style="height:200px;margin-right:20px;margin-top:20px" src="/images/kaiser_openbookFilmmusik.jpg" alt=""></a>
      <p>In dem OpenBook <a href="/oer-filmmusik/">Filmmusik</a> wird die Eröffnungssequenz des Films <i>Sintel</i> besprochen und zum Komponieren einer eigenen Filmmusik zu dieser Szene angeregt. Auf dieser Seite finden Sie die in dem OpenBook gegebenen Beispiele als Film sowie als Projekte (Cakewalk- und Shotcut-Projekt). Die Sounddesigns stehen wie der Originalfilm unter der freien Lizenz <a href="https://creativecommons.org/licenses/by/3.0/">Creative Commons Attribution 3.0</a>.</p>
    </div>
    <hr style="margin:40px 0">
    <div class="gridBox">
      <div class="gridFraction">
        <video style="max-width:100%" poster="/images/poster-sintel.png" controls>
          <source src="/publicfiles/sintel/sintel-kaiser.mp4" type="video/mp4">
        </video>
      </div>
      <div class="gridFraction">
        Sounddesign: Ulrich Kaiser<br>
        Verwendete Musikbeispiele:
        <ul style="list-style-position:inside">
          <li>L. v. Beethoven, 7. Sinfonie, 2. Satz</li>
          <li>G. Verdi, Requiem, Dies Irae</li>
          <li>G. Mahler, 5. Sinfonie, 2. Satz</li>
          <li>P. I. Tschaikowski, 6. Sinfonie, 1. Satz</li>
          <li>R. Leoncavallo, Il Pagliacci (Schluss)</li>
        </ul>
      </div>
      <div class="gridFraction" style="flex-direction:row">
        <a class="downloadLink" href="/publicfiles/sintel/sintel-cakewalk-projekt.zip">Download als Cakewalk-Projekt</a>
        <a class="downloadLink" href="/publicfiles/sintel/sintel-shotcut-projekt.zip">Download als Shotcut-Projekt</a>
      </div>
      <div class="gridFraction"></div>
    </div>
    <div style="margin-top:40px">Hier werden demnächst noch weitere Vertonungen der Eröffnungssequenz des Sintel-Films zur Verfügung gestellt.</div>`;
  write(path.join(DIST,'additionals-sintel-projekte','index.html'), page({
    title:'OER | Ulrich Kaiser - Sintel Projekt',
    desc:'Hier finden Sie Vertonungen der Eröffnungssequenz des Films Sintel von Blender.',
    keywords:'Filmmusik, Sintel, OER, Open Educational Resources, OpenBooks', body
  }));
}

function genAdditionalsSintelMorgenstern() {
  const body = `    <div style="position:relative">
      <a href="/oer-filmmusik/" class="closeX"><span>X</span></a>
      <h2>Projekte zur OER Filmmusik</h2>
    </div>
    <div style="margin-top:20px;display:flex">
      <p>In dem OpenBook <a href="/oer-filmmusik/">Filmmusik</a> wird die Eröffnungssequenz des Films <i>Sintel</i> besprochen. Auf dieser Seite können Sie den Anfang des Sintel-Films im Original hören. Der Komponist <a href="https://www.janmorgenstern.com/" target="_blank">Jan Morgenstern</a> war so freundlich, uns die Tonspur mit den Stimmen und Geräuschen zur Verfügung zu stellen. Bitte beachten Sie, dass die Lizenz für die Filmmusik (<a href="https://creativecommons.org/licenses/by-nc-nd/3.0/">Creative Commons Attribution-Noncommercial-No Derivative Works 3.0</a>) weder Veränderungen noch eine kommerzielle Nutzung erlaubt.</p>
      <a href="https://www.janmorgenstern.com/"><img src="https://www.janmorgenstern.com/assets/2015/09/jan-cartoon-296x300-296x300.png" alt="Jan Morgenstern"></a>
    </div>
    <hr style="margin:40px 0">
    <div class="gridBox">
      <div class="gridFraction">
        <video style="max-width:100%" poster="/images/poster-sintel.png" controls>
          <source src="/publicfiles/sintel/sintel-morgenstern-musik.mp4" type="video/mp4">
        </video>
      </div>
      <div class="gridFraction">Eröffnungssequenz nur mit Musik<br>Musik: Jan Morgenstern</div>
      <div class="gridFraction">
        <video style="max-width:100%" poster="/images/poster-sintel.png" controls>
          <source src="/publicfiles/sintel/sintel-morgenstern-dfx.mp4">
        </video>
      </div>
      <div class="gridFraction">Eröffnungssequenz nur mit Geräuschen<br>Sound: Jan Morgenstern</div>
      <div class="gridFraction">
        <video style="max-width:100%" poster="/images/poster-sintel.png" controls>
          <source src="/publicfiles/sintel/sintel-morgenstern.mp4" type="video/mp4">
        </video>
      </div>
      <div class="gridFraction">Eröffnungssequenz in der originalen Abmischung<br>Musik: Jan Morgenstern</div>
    </div>`;
  write(path.join(DIST,'additionals-sintel-morgenstern','index.html'), page({
    title:'OER | Ulrich Kaiser - Sintel Morgenstern',
    desc:'Hier finden Sie Vertonungen der Eröffnungssequenz des Films Sintel von Blender.',
    keywords:'Filmmusik, Sintel, OER, Open Educational Resources, OpenBooks', body
  }));
}

function genAdditionalsInventionen() {
  const tracks = [
    ['/data/audio/Inventionen/01_Invention_C-Dur.mp3','Invention in C-Dur'],
    ['/data/audio/Inventionen/02_Invention_d-Moll.mp3','Invention in d-Moll'],
    ['/data/audio/Inventionen/03_Invention_e-Moll.mp3','Invention in e-Moll'],
    ['/data/audio/Inventionen/04_Invention_G-Dur.mp3','Invention in G-Dur'],
    ['/data/audio/Inventionen/05_Invention_a-Moll.mp3','Invention in a-Moll'],
  ];
  const body = `    <div style="position:relative">
      <a href="/oer-inventionen-plus-one-kammermusik-mit-johann-sebastian-bach/" class="closeX"><span>X</span></a>
      <h2>Beispielaufnahmen zu den <i>Inventionen plus One</i></h2>
    </div>
    <hr style="margin:40px 0">
    <div><a href="/oer-inventionen-plus-one-kammermusik-mit-johann-sebastian-bach/"><img src="/images/kaiser_openbookInventionen.jpg" alt=""></a></div>
    <p>Ulrich Kaiser, <i>Inventionen plus One. Kammermusik mit Johann Sebastian Bach</i> (= OpenBook 11), Karlsfeld 2015.</p>
    <hr style="margin:40px 0">
    <div>
      ${tracks.map(([src,lbl]) => audioTrack(src,lbl)).join('\n      ')}
      <hr style="margin:40px 0">
      <div>Violine: Teresa Allgaier, Klavier: Stefan Fuchs</div>
    </div>`;
  write(path.join(DIST,'additionals-inventionen','index.html'), page({
    title:'OER | Ulrich Kaiser - Inventionen plus One (Aufnahmen)',
    desc:'Hier finden Sie Beispielaufnahmen zu den Inventionen mit einer Melodiestimme von Ulrich Kaiser.',
    keywords:'Inventionen, Melodiestimme, OER, Open Educational Resources, OpenBooks', body
  }));
}

function genAdditionalsHappyVariationen() {
  const body = `    <div style="position:relative">
      <a href="/oer-thema-und-12-variationen-ueber-happy-birthday-to-you/" class="closeX"><span>X</span></a>
      <h2>Beispielaufnahme zu den <i>Happy-Birthday-Variationen</i></h2>
    </div>
    <hr style="margin:40px 0">
    <div><a href="/oer-thema-und-12-variationen-ueber-happy-birthday-to-you/"><img src="/images/kaiser_openbook-happyfortwo.jpg" alt=""></a></div>
    <p>Ulrich Kaiser, <i>Thema und 12 Variationen über Happy Birthday To You</i> (= OpenBook 14/1), für zwei beliebige Melodieinstrumente, Karlsfeld 2017.</p>
    <hr style="margin:40px 0">
    <div>
      <div>
        <audio controls>
          <source src="/data/audio/happyfortwo/thema-und-12-variationen.mp3" type="audio/mpeg">
        </audio>
        <p>Die Happy-Birthday-Variationen (originale Reihenfolge)<br>Flöte: Veronika Minsinger, Klarinette: Anna Harzenetter, Arrangement/Aufnahme &amp; Schnitt: Ulrich Kaiser</p>
      </div>
      <hr style="margin:40px 0">
      <a href="/data/openbooks/happyfortwo/releases/happyfortwo_cd-cover.pdf">Druckvorlage für CD-Inlays</a>
    </div>`;
  write(path.join(DIST,'additionals-happy-variationen','index.html'), page({
    title:'OER | Ulrich Kaiser - Happy-Birthday-Variationen (Aufnahmen)',
    desc:'Hier finden Sie Beispielaufnahmen zu den Happy-Birthday-Variationen für zwei beliebige Melodieinstrumente von Ulrich Kaiser.',
    keywords:'Happy Birthday, Variationen, OER, Open Educational Resources, OpenBooks', body
  }));
}

function genMixingPage({ slug, backUrl, title, intro, imgSrc, tracks, extra = '' }) {
  const body = `    <div style="position:relative">
      <a href="${backUrl}" class="closeX"><span>X</span></a>
      <h2>${title}</h2>
    </div>
    <div style="margin-top:20px">
      <p>${intro}</p>
      <div><a href="${backUrl}"><img src="${imgSrc}" alt=""></a></div>
    </div>
    ${mixingControls()}
    <hr style="margin:40px 0">
    <div>
      ${tracks.map(([src,lbl]) => audioTrack(src,lbl)).join('\n      ')}
    </div>
    ${extra}`;
  write(path.join(DIST, slug, 'index.html'), page({
    title:'OER | Ulrich Kaiser - Mixing Projekt',
    desc:'Hier finden Sie ein Mixing-Projekt zum Studieren des Arrangements sowie der Einzelstimmen.',
    keywords:'Projekt, Bandklasse, OER, Open Educational Resources, OpenBooks', body
  }));
}

function genAdditionalsMixingKinderhauslied() {
  const tracks = [
    ['/data/audio/Kinderhauslied/Gesang1.mp3','Kinderhauslied'],
    ['/data/audio/Kinderhauslied/Gesang2.mp3','zweite Stimme'],
    ['/data/audio/Kinderhauslied/Floete.mp3','Flöte'],
    ['/data/audio/Kinderhauslied/Klarinette.mp3','Klarinette'],
    ['/data/audio/Kinderhauslied/Violine.mp3','Violine'],
    ['/data/audio/Kinderhauslied/Viola.mp3','Viola'],
    ['/data/audio/Kinderhauslied/Trompete.mp3','Trompete'],
    ['/data/audio/Kinderhauslied/Gitarre.mp3','Gitarre'],
    ['/data/audio/Kinderhauslied/Klavier.mp3','Klavier'],
    ['/data/audio/Kinderhauslied/Bass.mp3','Bass'],
    ['/data/audio/Kinderhauslied/Drums.mp3','Schlagzeug'],
  ];
  genMixingPage({
    slug:'additionals-mixing-kinderhauslied',
    backUrl:'/oer-das-kinderhauslied/',
    title:'Mixing-Projekt zum <i>Kinderhauslied</i>',
    intro:'Lernen Sie die Stimmen des Kinderhausliedes kennen, indem Sie die Lautstärke an den einzelnen Tracks verändern. Viel Spaß beim Mixen des Kinderhausliedes...',
    imgSrc:'/images/kaiser_openBookKinderhauslied.png',
    tracks
  });
}

function genAdditionalsMixingProject1() {
  const tracks = [
    ['/data/audio/ThatImage/MelodieMozart.mp3','Bildnisarien-Melodie (Mozart)'],
    ['/data/audio/ThatImage/Melodie2.mp3','Mittelstimme (2. Stimme)'],
    ['/data/audio/ThatImage/Melodie3.mp3','Unterstimme (3. Stimme)'],
    ['/data/audio/ThatImage/LeadGitarre.mp3','Leadgitarre (Terzen zur Melodie Mozarts)'],
    ['/data/audio/ThatImage/Gitarre.mp3','Akkordgitarre'],
    ['/data/audio/ThatImage/Powerchords.mp3','Powerchords'],
    ['/data/audio/ThatImage/E-Bass.mp3','E-Bass'],
    ['/data/audio/ThatImage/KeyboardMelodie.mp3','Keyboard (Melodie)'],
    ['/data/audio/ThatImage/KeyboardHarmonie.mp3','Keyboard (Harmonie)'],
    ['/data/audio/ThatImage/Klatschen.mp3','Händeklatschen'],
    ['/data/audio/ThatImage/Cajon.mp3','Cajon'],
    ['/data/audio/ThatImage/Conga.mp3','Conga'],
    ['/data/audio/ThatImage/Drums.mp3','Drums'],
  ];
  const extra = `
    <hr style="margin:40px 0">
    <div>
      <p>Ulrich Kaiser: That Image (Aufführungsvorschlag)</p>
      <audio src="/data/audio/ThatImage/Auffuehrungsvorschlag.mp3" controls></audio>
    </div>
    <div class="ytVideoFrame">
      ${yt('https://www.youtube.com/embed/7PCkvCPvDXk','Meghan Trainor - All About That Bass')}
      <p>Megan Trainer und Kevin Kadish: <i>All About that Bass</i> (Youtube-Video)</p>
    </div>`;
  genMixingPage({
    slug:'additionals-mixing-project-1',
    backUrl:'/oer-band-impulse-heft-1-that-image/',
    title:'Mixing-Projekt zu <i>That Image</i>',
    intro:'Lernen Sie die Stimmen des Songs <i>That Image</i> kennen, indem Sie die Lautstärke an den einzelnen Tracks verändern. Viel Spaß beim Mixen meines Bandklassen-Songs <i>That Image</i>...',
    imgSrc:'/images/kaiser_openBookBandImpulse-1.jpg',
    tracks, extra
  });
}

function genAdditionalsMixingProject2() {
  const tracks = [
    ['/data/audio/EliseInBlack/MelodieBeethoven.mp3','Marmotte-Melodie (Beethoven)'],
    ['/data/audio/EliseInBlack/Melodie2.mp3','Sexten zur Marmotte-Melodie (2. Stimme)'],
    ['/data/audio/EliseInBlack/Melodie3.mp3','Unterstimme (3. Stimme)'],
    ['/data/audio/EliseInBlack/LeadGitarre.mp3','Leadgitarre'],
    ['/data/audio/EliseInBlack/Gitarre.mp3','Akkordgitarre'],
    ['/data/audio/EliseInBlack/Powerchords.mp3','Powerchords'],
    ['/data/audio/EliseInBlack/E-Bass.mp3','E-Bass'],
    ['/data/audio/EliseInBlack/KeyboardMelodie.mp3','Keyboard 1 (Für Elise von Beethoven)'],
    ['/data/audio/EliseInBlack/KeyboardHarmonie.mp3','Keyboard 2 (Harmonien)'],
    ['/data/audio/EliseInBlack/Klatschen.mp3','Händeklatschen'],
    ['/data/audio/EliseInBlack/Cajon.mp3','Cajon'],
    ['/data/audio/EliseInBlack/Conga.mp3','Conga'],
    ['/data/audio/EliseInBlack/Drums.mp3','Drums'],
  ];
  const extra = `<div class="ytVideoFrame">${yt('https://www.youtube.com/embed/Q7TKW98pOOE','Uriah Heep - Lady In Black')}<p>Uriah Heep - <i>Lady In Black</i> (Youtube-Video)</p></div>`;
  genMixingPage({
    slug:'additionals-mixing-project-2',
    backUrl:'/oer-band-impulse-heft-2-elise-in-black/',
    title:'Mixing-Projekt zu <i>Elise In Black</i>',
    intro:'Lernen Sie die Stimmen des Songs <i>Elise In Black</i> kennen, indem Sie die Lautstärke an den einzelnen Tracks verändern. Viel Spaß beim Mixen meines Bandklassen-Songs <i>Elise In Black</i>...',
    imgSrc:'/images/kaiser_openBookBandImpulse-2.png',
    tracks, extra
  });
}

function genAdditionalsMixingProject3() {
  const tracks = [
    ['/data/audio/PatternStyles1/Gitarre-1.mp3','Gitarre 1 (Lead)'],
    ['/data/audio/PatternStyles1/Gitarre-2.mp3','Gitarre 2 (Akkorde Am/Em)'],
    ['/data/audio/PatternStyles1/Bass.mp3','E-Bass'],
    ['/data/audio/PatternStyles1/Keyboard-1.mp3','Keyboard 1'],
    ['/data/audio/PatternStyles1/Keyboard-2.mp3','Keyboard 2'],
    ['/data/audio/PatternStyles1/Klatschen.mp3','Handclap'],
    ['/data/audio/PatternStyles1/Cajon.mp3','Cajón'],
    ['/data/audio/PatternStyles1/Kick.mp3','Kick (Bassdrum)'],
  ];
  genMixingPage({
    slug:'additionals-mixing-project-3',
    backUrl:'/oer-band-impulse-heft-3-pattern-und-styles-1/',
    title:'Mixing-Projekt zum <i>Rap-Pattern</i>',
    intro:'Lernen Sie die Stimmen des Rap-Patterns kennen, indem Sie die Lautstärke an den einzelnen Tracks verändern. Viel Spaß beim Mixen des Rap-Patterns...',
    imgSrc:'/images/kaiser_openBookBandImpulse-3.jpg',
    tracks
  });
}

function genAdditionalsMixingProject4() {
  const tracks = [
    ['/data/audio/PatternStyles1/Pop-Gesang.mp3','Gesang'],
    ['/data/audio/PatternStyles1/Pop-Gitarre1.mp3','Gitarre 1 (Lead)'],
    ['/data/audio/PatternStyles1/Pop-Gitarre2.mp3','Gitarre 2'],
    ['/data/audio/PatternStyles1/Pop-E-Bass.mp3','E-Bass'],
    ['/data/audio/PatternStyles1/Pop-Keyboard1.mp3','Keyboard 1'],
    ['/data/audio/PatternStyles1/Pop-Keyboard2.mp3','Keyboard 2'],
    ['/data/audio/PatternStyles1/Pop-Klatschen.mp3','Handclap'],
    ['/data/audio/PatternStyles1/Pop-Cajon.mp3','Cajón'],
    ['/data/audio/PatternStyles1/Pop-Drums.mp3','Schlagzeug (Drums)'],
  ];
  genMixingPage({
    slug:'additionals-mixing-project-4',
    backUrl:'/oer-band-impulse-heft-3-pattern-und-styles-1/',
    title:'Mixing-Projekt zu <i>Pop-Pattern</i>',
    intro:'Lernen Sie die Stimmen des Pop-Patterns kennen, indem Sie die Lautstärke an den einzelnen Tracks verändern. Viel Spaß beim Mixen des Pop-Patterns...',
    imgSrc:'/images/kaiser_openBookBandImpulse-3.jpg',
    tracks
  });
}

function gen404() {
  const body = `    <div class="jumbotron">
      <div>${menu('/')}</div>
      <h1>404 – Seite nicht gefunden</h1>
      <p class="jumbotron-text">Die gesuchte Seite existiert leider nicht.</p>
    </div>
    <p><a href="/">← Zurück zur Startseite</a></p>`;
  write(path.join(DIST,'404.html'), page({
    title:'OER | Ulrich Kaiser - Seite nicht gefunden',
    desc:'Seite nicht gefunden', keywords:'', body
  }));
}

// ==================== MAIN ====================

function main() {
  console.log('Generating static site into dist/...');
  mkdirp(DIST);

  const openBooks = loadOpenBooks();
  console.log(`Loaded ${openBooks.all.length} OpenBooks`);

  console.log('\nGenerating homepage...');
  genIndex(openBooks);

  console.log('\nGenerating OpenBook detail pages...');
  for (const ob of openBooks.all) genOerPage(ob);

  console.log('\nGenerating static pages...');
  genWarum();
  genExtras();
  genFeedback();
  genNews();
  genSoftware();
  genVideos();
  genPrint();
  genErrata();
  genRoadmap();
  genImpressum();

  console.log('\nGenerating additionals pages...');
  genAdditionalsBlender();
  genAdditionalsSintelProjekte();
  genAdditionalsSintelMorgenstern();
  genAdditionalsInventionen();
  genAdditionalsHappyVariationen();
  genAdditionalsMixingKinderhauslied();
  genAdditionalsMixingProject1();
  genAdditionalsMixingProject2();
  genAdditionalsMixingProject3();
  genAdditionalsMixingProject4();

  gen404();

  // Create junctions in dist/ for large static asset folders (enables Live Server testing)
  console.log('\nLinking static assets into dist/...');
  for (const dir of ['images', 'data', 'publicfiles']) {
    const target = path.join(ROOT, 'static', dir);
    const link = path.join(DIST, dir);
    if (fs.existsSync(target) && !fs.existsSync(link)) {
      fs.symlinkSync(target, link, 'junction');
      console.log('  linked', dir);
    }
  }

  // Copy small asset folders into dist/ so FTP upload works without following symlinks
  for (const dir of ['fonts', 'js']) {
    const src = path.join(ROOT, 'static', dir);
    const dst = path.join(DIST, dir);
    if (!fs.existsSync(src)) continue;
    mkdirp(dst);
    for (const file of fs.readdirSync(src)) {
      fs.copyFileSync(path.join(src, file), path.join(dst, file));
    }
    console.log('  copied', dir);
  }

  // Copy Web.config for IIS/1&1 Windows hosting
  const webConfig = path.join(ROOT, 'static', 'Web.config');
  if (fs.existsSync(webConfig)) {
    fs.copyFileSync(webConfig, path.join(DIST, 'Web.config'));
    console.log('  copied Web.config');
  }

  console.log('\nDone! Generated files are in dist/');
}

main();
