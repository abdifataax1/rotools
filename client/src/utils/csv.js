import Papa from 'papaparse';

export function toCsv(rows) {
  return Papa.unparse(rows);
}

export function fromCsv(text) {
  return Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;
}
