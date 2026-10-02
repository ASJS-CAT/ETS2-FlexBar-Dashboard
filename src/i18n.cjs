'use strict';
const dictionary=require('./i18n.json');
function createTranslator(language='en',catalog=dictionary){
  return key=>catalog[language]?.[key]??catalog.en?.[key]??key;
}
// Presentation adapter for existing model/resolver messages. Does not mutate
// telemetry, control identities, ACK IDs or any simulation state.
const displayKeys=new Map(Object.entries(dictionary.en).filter(([k])=>!k.startsWith('settings.')).map(([k,v])=>[v,k]));
function displayTranslator(language){
  const t=createTranslator(language),keys=displayKeys;
  return value=>{
    const s=String(value);if(keys.has(s))return t(keys.get(s));
    const match=/^(AIR|COOLANT|OIL|SPEED|FUEL|ADBLUE|BATTERY|LIMIT|REFUELING|LATE|BIND) (.+)$/.exec(s);
    return match&&keys.has(match[1])?t(keys.get(match[1]))+' '+match[2].replace(/\bN\/A\b/g,t('status.unavailable')):s;
  };
}
function dashboardLanguage(cfg){return cfg.dashboardLanguage==='follow'?cfg.language:cfg.dashboardLanguage||'en';}
module.exports={dictionary,createTranslator,displayTranslator,dashboardLanguage};
