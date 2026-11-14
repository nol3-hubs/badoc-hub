/* Minimal .xlsx reader for the service worker (no libraries): zip central directory + DecompressionStream + regex XML.
   Returns the first sheet as an array of rows of strings. Ignores the sheet's <dimension> tag (SPX writes a wrong one). */
async function zipEntries(buf) {
  const u = new Uint8Array(buf), dv = new DataView(buf), out = {};
  let e = -1;
  for (let i = u.length - 22; i >= Math.max(0, u.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error("Not a valid .xlsx file.");
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u.subarray(p + 46, p + 46 + nl));
    out[name] = { method, csz, off };
    p += 46 + nl + xl + cl;
  }
  out.__read = async (name) => {
    const f = out[name]; if (!f) return null;
    const ln = dv.getUint16(f.off + 26, true), lx = dv.getUint16(f.off + 28, true), s = f.off + 30 + ln + lx, raw = u.subarray(s, s + f.csz);
    if (f.method === 0) return new TextDecoder().decode(raw);
    const ds = new DecompressionStream("deflate-raw"), w = ds.writable.getWriter();
    w.write(raw); w.close();
    return new TextDecoder().decode(await new Response(ds.readable).arrayBuffer());
  };
  return out;
}
const xmlDec = (s) => String(s).replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const colNo = (ref) => { let n = 0; for (const c of ref.replace(/\d+/g, "")) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };
async function xlsxToRows(buf) {
  const z = await zipEntries(buf);
  const wb = (await z.__read("xl/workbook.xml")) || "", rels = (await z.__read("xl/_rels/workbook.xml.rels")) || "";
  let sheet = "xl/worksheets/sheet1.xml";
  const rid = (wb.match(/<sheet\b[^>]*r:id="([^"]+)"/) || [])[1];
  if (rid) { const t = (rels.match(new RegExp('<Relationship\\b[^>]*Id="' + rid + '"[^>]*>')) || [""])[0].match(/Target="([^"]+)"/); if (t) sheet = "xl/" + t[1].replace(/^\/?(xl\/)?/, ""); }
  if (!z[sheet]) sheet = Object.keys(z).find((k) => /^xl\/worksheets\/.*\.xml$/.test(k));
  const ss = [], sx = (await z.__read("xl/sharedStrings.xml")) || "";
  for (const m of sx.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) ss.push(xmlDec([...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join("")));
  const xml = await z.__read(sheet), rows = [];
  for (const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const at = cm[1], ref = (at.match(/\br="([A-Z]+)\d+"/) || [])[1], t = (at.match(/\bt="([^"]+)"/) || [])[1], body = cm[2] || "";
      let v = (body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/) || [])[1];
      if (t === "inlineStr") v = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join("");
      else if (t === "s" && v != null) v = ss[+v] != null ? ss[+v] : "";
      row[ref ? colNo(ref) : row.length] = v == null ? "" : xmlDec(v);
    }
    for (let i = 0; i < row.length; i++) if (row[i] == null) row[i] = "";
    rows.push(row);
  }
  return rows;
}

if (typeof module !== "undefined") module.exports = { xlsxToRows };
