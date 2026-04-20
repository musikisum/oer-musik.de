#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const ROOT     = __dirname;
const OB_DIR   = path.join(ROOT, 'data', 'openbooks');
const STATIC   = path.join(ROOT, 'static');

const jsonFiles = fs.readdirSync(OB_DIR).filter(f => f.endsWith('.json') && f !== 'order.txt');

let created = 0, skipped = 0, missing = 0;

for (const file of jsonFiles) {
  const ob = JSON.parse(fs.readFileSync(path.join(OB_DIR, file), 'utf8'));
  if (!ob.Folderpath || !ob.Sections) continue;

  // Folderpath like "/data/openbooks/brahms5/" → static/data/openbooks/brahms5
  const obRoot = path.join(STATIC, ob.Folderpath.replace(/^\//, '').replace(/\/$/, ''));
  const pkgDir = path.join(obRoot, 'packages');

  if (!fs.existsSync(obRoot)) continue;
  if (!fs.existsSync(pkgDir)) fs.mkdirSync(pkgDir, { recursive: true });

  const sections = Array.isArray(ob.Sections) ? ob.Sections : [ob.Sections];

  for (const sec of sections) {
    const zipPath = path.join(pkgDir, `${sec.Id}.zip`);
    if (fs.existsSync(zipPath)) { skipped++; continue; }

    const pages = sec.Pages && sec.Pages.Page
      ? (Array.isArray(sec.Pages.Page) ? sec.Pages.Page : [sec.Pages.Page])
      : [];

    const zip = new AdmZip();
    let added = 0;

    for (const page of pages) {
      const imgRel = page.Images && page.Images.Image;
      if (!imgRel) continue;
      const imgAbs = path.join(obRoot, imgRel);
      if (fs.existsSync(imgAbs)) {
        zip.addLocalFile(imgAbs);
        added++;
      } else {
        console.warn(`  MISSING: ${imgAbs}`);
        missing++;
      }
    }

    if (added > 0) {
      zip.writeZip(zipPath);
      console.log(`  created ${path.relative(ROOT, zipPath)} (${added} files)`);
      created++;
    }
  }
}

console.log(`\nDone: ${created} created, ${skipped} already existed, ${missing} missing files.`);
