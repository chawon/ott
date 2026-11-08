import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptRecords, coverURL, fetchAllRecords} from './api-data.js';

const record = (id, fields = {}) => ({id, title:{id:'shared-title',type:'series',name:'같은 작품',year:2025,posterUrl:'https://image.tmdb.org/t/p/w500/title.jpg'},status:'DONE',watchedAt:null,createdAt:'2026-10-01T10:00:00+09:00',updatedAt:'2026-10-02T10:00:00+09:00',note:'내 말 그대로 <>&',rating:4.5,...fields});

test('keeps distinct season artwork and nullable TPO without sample values', () => {
 const data=adaptRecords([
  record('one',{seasonNumber:1,seasonPosterUrl:'https://image.tmdb.org/t/p/w500/one.jpg'}),
  record('two',{seasonNumber:2,episodeNumber:8,seasonPosterUrl:'https://image.tmdb.org/t/p/w500/two.jpg',watchedAt:'2026-10-04T22:30:00+09:00',place:'HOME',occasion:'FAMILY'}),
 ]);
 assert.notEqual(data.records[0].titleId,data.records[1].titleId);
 assert.match(data.catalog[0].cover,/one.jpg$/);assert.match(data.catalog[1].cover,/two.jpg$/);
 assert.equal(data.records[0].watchedAt,null);assert.equal(data.records[0].place,null);
 assert.equal(data.records[1].occasion,'FAMILY');assert.equal(data.records[1].episodeNumber,8);
 assert.equal(data.records[0].note,'내 말 그대로 <>&');assert.equal(data.records[0].rating,4.5);
});

test('missing metadata and malformed dates remain safely empty', () => {
 const data=adaptRecords([record('empty',{title:null,createdAt:'invalid',updatedAt:null,note:null,status:'FUTURE',rating:99}),record('empty')]);
 assert.equal(data.records.length,1);assert.equal(data.records[0].createdAt,null);assert.equal(data.records[0].note,'');
 assert.equal(data.records[0].status,'UNKNOWN');assert.equal(data.records[0].rating,null);
 assert.equal(data.catalog[0].cover,'');assert.equal(data.catalog[0].type,'unknown');
});

test('covers only use public HTTPS origins and known HTTP CDNs can upgrade', () => {
 assert.equal(coverURL('http://image.tmdb.org/t/p/w500/a.jpg'),'https://image.tmdb.org/t/p/w500/a.jpg');
 for(const url of ['javascript:alert(1)','data:image/svg+xml,bad','http://example.com/a.jpg','https://127.0.0.1/a.jpg','https://[::1]/a.jpg','https://localhost/a.jpg','https://private.local/a.jpg','https://user:pass@example.com/a.jpg','https://example.com:4173/a.jpg']) assert.equal(coverURL(url),'',url);
});

test('loads every cursor page, encoding cursor and deduplicating repeated records', async () => {
 const urls=[];
 const data=await fetchAllRecords(async url=>{
  urls.push(url);
  return urls.length===1?{items:Array.from({length:50},(_,i)=>record(`id-${i}`)),nextCursor:'a+b/='}:{items:[record('id-49'),record('id-50')],nextCursor:null};
 });
 assert.equal(data.records.length,51);assert.equal(new URLSearchParams(urls[1].split('?')[1]).get('cursor'),'a+b/=');
});

test('malformed or repeated pages fail instead of returning a truncated archive', async () => {
 await assert.rejects(fetchAllRecords(async()=>({items:[record('a')],nextCursor:'same'})),{code:'INVALID_RESPONSE'});
 await assert.rejects(fetchAllRecords(async()=>({records:[]})),{code:'INVALID_RESPONSE'});
 let calls=0;
 await assert.rejects(fetchAllRecords(async()=>{if(calls++)throw new Error('Network unavailable');return{items:[record('a')],nextCursor:'next'};}),/Network unavailable/);
});
