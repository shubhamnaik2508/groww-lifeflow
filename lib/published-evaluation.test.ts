import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileSchema,observedBehaviour} from './evaluation';

// The review the AI Reliability panel loads with "Load published review". It must stay a valid, honest record.
const load=(p:string)=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));

describe('published 3-case review',()=>{
 const file=load('../public/evaluation/lifeflow-3-case-review.json');
 it('is a valid human-labelled evaluation file with provenance on every case',()=>{
  const f=fileSchema.parse(file);
  expect(f.dataset.kind).toBe('human-labelled');
  expect(f.cases).toHaveLength(3);
  for(const c of f.cases)expect(c.provenance?.labeller).toMatch(/^Human tester \d$/);
 });
 it('matches the label file it was built from',()=>{
  const labels=load('../fixtures/lifeflow-3-case-human-labels.json');
  expect(file.dataset).toEqual(labels.dataset);expect(file.cases).toEqual(labels.cases);
 });
 it('records a recorded run and a human verdict for every case, with stored behaviour matches that agree with the answers',()=>{
  for(const c of file.cases){
   const r=file.runs[c.id];expect(r.mode).toBe('groq');
   expect(r.behaviour_match).toBe(observedBehaviour(r.answer)===c.expected_behaviour);
   expect(file.reviews[c.id].result).toBeTruthy();
  }
 });
 it('contains no personal names',()=>{expect(JSON.stringify(file)).not.toMatch(/Shubham|Naik/i)});
});
