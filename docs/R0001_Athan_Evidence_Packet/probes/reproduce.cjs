'use strict';
// External PREIMAGE diagnostic: assertions establish known failures, not a repair PASS.
// Usage: node reproduce.cjs CHECKOUT (run compile.cjs first).
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
if(!process.argv[2])throw new Error('Pass the pinned Athan checkout root.');
const sourceRoot=path.resolve(process.argv[2]);
const {getSolarDeclination,getSolarAltitude,getSubsolarPoint}=require('./compiled/astronomy/solar');
const {vector3ToLatLon}=require('./compiled/astronomy/coordinates');
const {calculatePrayerTimes}=require('./compiled/prayer/calculator');
const {generateGlobalPrayerFronts}=require('./compiled/prayer/contours');
const {CALCULATION_CONVENTIONS:C}=require('./compiled/prayer/conventions');
const {AdhanEventEngine}=require('./compiled/simulation/eventEngine');
const {computeGlobalAdhanContinuity}=require('./compiled/simulation/continuity');
const {parseSettlements}=require('./compiled/population/loader');
const rad=Math.PI/180;
const location={name:'Tromso fixture',nameAr:'',latitude:69.65,longitude:18.96,countryCode:'NO',population:1,timezone:'Europe/Oslo'};
const r={};
for(const [name,day] of [['winter','2026-12-21'],['summer','2026-06-21']]){
 const date=new Date(day+'T12:00:00Z'),declination=getSolarDeclination(date);
 const schedule=calculatePrayerTimes(69.65,18.96,date,{convention:'MuslimWorldLeague'});
 const times=Object.fromEntries(['fajr','sunrise','dhuhr','asr','maghrib','isha'].map(k=>[k,schedule[k].toISOString()]));
 let lo=Infinity,hi=-Infinity;
 for(let i=0;i<=1440;i++){
  const h=getSolarAltitude(69.65,18.96,new Date(Date.parse(day+'T00:00:00Z')+i*60000));lo=Math.min(lo,h);hi=Math.max(hi,h);
 }
 r[name]={declination,altitudeRangeOneMinuteSampling:[lo,hi],times,atSunrise:getSolarAltitude(69.65,18.96,schedule.sunrise),atAsr:getSolarAltitude(69.65,18.96,schedule.asr),atMaghrib:getSolarAltitude(69.65,18.96,schedule.maghrib),noonShadow:Math.tan(Math.abs((69.65-declination)*rad)),activeAtMaghrib:new AdhanEventEngine([location],{convention:'MuslimWorldLeague'}).getActiveEvents(schedule.maghrib)};
}
assert.equal(r.winter.times.sunrise,r.winter.times.maghrib);assert(r.winter.atSunrise < -3);assert(r.summer.altitudeRangeOneMinuteSampling[0]>3);
const londonDate=new Date('2026-06-21T12:00:00Z');
r.angleBased=Object.fromEntries(['MiddleOfTheNight','SeventhOfTheNight','AngleBased'].map(highLatitudeRule=>{const s=calculatePrayerTimes(51.5074,-0.1278,londonDate,{convention:'MuslimWorldLeague',highLatitudeRule});return[highLatitudeRule,{fajr:s.fajr.toISOString(),isha:s.isha.toISOString()}]}));
assert.deepEqual(r.angleBased.MiddleOfTheNight,r.angleBased.AngleBased);
const date=new Date('2026-03-20T12:00:00Z'),sub=getSubsolarPoint(date),fronts=generateGlobalPrayerFronts(sub,C.MuslimWorldLeague,'Shafi',1);
r.fronts={time:date.toISOString(),subsolar:sub};
for(const key of ['fajr','sunrise','asr','maghrib','isha']){
 const f=fronts[key],results=[];
 for(let i=0;i<f.pointCount;i++){
  const p=vector3ToLatLon(...f.positions.slice(3*i,3*i+3));if(Math.abs(p.latitude)>20)continue;
  const hm=getSolarAltitude(p.latitude,p.longitude,new Date(+date-30000)),hp=getSolarAltitude(p.latitude,p.longitude,new Date(+date+30000));
  const H=((p.longitude-sub.longitude+540)%360)-180;
  results.push({...p,H,altitude:getSolarAltitude(p.latitude,p.longitude,date),dhDegreesPerMinute:hp-hm});
 }
 assert(results.length>0);
 r.fronts[key]={count:results.length,sample:results[Math.floor(results.length/2)],allRising:results.every(p=>p.dhDegreesPerMinute>0),allFalling:results.every(p=>p.dhDegreesPerMinute<0)};
}
assert(r.fronts.fajr.allFalling);assert(r.fronts.sunrise.allFalling);assert(r.fronts.maghrib.allRising);assert(r.fronts.isha.allRising);assert(r.fronts.asr.allRising);
const mecca=calculatePrayerTimes(21.4225,39.8262,new Date('2026-10-04T12:00:00Z'),{convention:'UmmAlQura'});
r.fixedIsha={maghrib:mecca.maghrib.toISOString(),isha:mecca.isha.toISOString(),actualSolarAltitudeAtIsha:getSolarAltitude(21.4225,39.8262,mecca.isha),frontAltitudeUsed:-18};
r.tomorrow={date:'2026-10-04T22:00:00Z'};
const now=calculatePrayerTimes(21.4225,39.8262,new Date(r.tomorrow.date)),next=calculatePrayerTimes(21.4225,39.8262,new Date('2026-10-05T12:00:00Z'));
r.tomorrow.nextAdvertised=now.nextPrayerTime.toISOString();r.tomorrow.recomputedNextFajr=next.fajr.toISOString();r.tomorrow.differenceSeconds=(now.nextPrayerTime-next.fajr)/1000;
const ph=-3.087263,sd=Math.sin(ph*rad),q=Math.max(0,Math.min(1,(sd+0.08)/0.16)),day=q*q*(3-2*q);
r.shader={flatSurfaceSolarAltitude:ph,sunDot:sd,dayFactor:day,rawDiffuse:Math.max(0.03,sd),dayAlbedoCoefficient:day*Math.max(0.03,sd),widthDegrees:2*Math.asin(.08)/rad};
const all=JSON.parse(fs.readFileSync(path.join(sourceRoot,'public/data/cities-core.json'),'utf8'));
const settlements=parseSettlements(all);assert.equal(settlements.length,15000);
r.population={shape:Array.isArray(all)?'array':Object.keys(all),count:settlements.length};
const stats=computeGlobalAdhanContinuity(settlements,new Date('2026-10-04T12:00:00Z'),{convention:'MuslimWorldLeague'});
r.continuity={...stats,timelineBins:undefined,actualMinOfBins:Math.min(...stats.timelineBins)};
const tokyo={name:'Tokyo fixture',nameAr:'',latitude:35.68,longitude:139.76,countryCode:'JP',population:1,timezone:'Asia/Tokyo'};
const tokyoDay=calculatePrayerTimes(tokyo.latitude,tokyo.longitude,new Date('2026-10-05T12:00:00Z'));
r.adjacentUtcDay={fixture:tokyo,requestedDay:'2026-10-05',fajr:tokyoDay.fajr.toISOString(),activeAtFajr:new AdhanEventEngine([tokyo]).getActiveEvents(tokyoDay.fajr)};
assert.equal(r.adjacentUtcDay.activeAtFajr.length,0);assert(r.continuity.actualMinOfBins>0);assert.equal(r.continuity.minConcurrentAdhans,0);
console.log(JSON.stringify(r,null,2));
