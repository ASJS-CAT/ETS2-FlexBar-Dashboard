const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {settings}=require('../src/model.cjs');
const {dictionary,createTranslator}=require('../src/i18n.cjs');

function loadSettings(){
  const source=fs.readFileSync(require.resolve('../com.local.ets2rally.plugin/ui/global_config.vue'),'utf8');
  const script=source.match(/<script>([\s\S]*?)<\/script>/)[1];
  return {source,component:vm.runInNewContext(script.replace('export default','result ='),{result:null})};
}

test('independent Airport LED styles and scrolling survive save while legacy matrices migrate to 5x7',async()=>{
  const {component}=loadSettings();
  for(const theme of ['rally','el_mint','el_amber'])for(const digitStyle of ['rally','airport_led'])for(const textStyle of ['standard','airport_led'])for(const airportFuelLayout of ['double_large','single_fit','single_scroll']){
    let saved;
    const ctx={modelValue:{config:{theme,digitStyle,textStyle,digitMatrix:'5x8',textMatrix:'5x8',ledScrollMode:'loop_right',ledScrollSpeed:175,airportFuelLayout}},$fd:{
      setConfig:async config=>{saved=JSON.parse(JSON.stringify(config));},showSnackbarMessage:()=>{}
    }};
    for(const [key,fn]of Object.entries(component.methods))ctx[key]=fn.bind(ctx);
    component.created.call(ctx);
    await ctx.save();
    assert.equal(saved.digitMatrix,'5x7');assert.equal(saved.textMatrix,'5x7');
    const reloaded=settings(saved);
    assert.equal(reloaded.digitStyle,digitStyle);assert.equal(reloaded.textStyle,textStyle);assert.equal(reloaded.theme,theme);
    assert.equal(reloaded.digitMatrix,'5x7');assert.equal(reloaded.textMatrix,'5x7');
    assert.equal(reloaded.ledScrollMode,'loop_left');assert.equal(reloaded.ledScrollSpeed,175);
    assert.equal(reloaded.airportFuelLayout,airportFuelLayout);
    ctx.modelValue.config=reloaded;component.created.call(ctx);
    assert.equal(ctx.modelValue.config.digitStyle,digitStyle);assert.equal(ctx.modelValue.config.textStyle,textStyle);
    assert.equal(ctx.modelValue.config.ledScrollMode,'loop_left');assert.equal(ctx.modelValue.config.ledScrollSpeed,175);
    assert.equal(ctx.modelValue.config.airportFuelLayout,airportFuelLayout);
    ctx.modelValue.config.ledScrollMode='restart';await ctx.save();
    assert.equal(settings(saved).digitMatrix,'5x7');assert.equal(settings(saved).textMatrix,'5x7');
    assert.equal(settings(saved).ledScrollMode,'restart');
    assert.equal(settings(saved).airportFuelLayout,airportFuelLayout);
  }
});

test('new display settings keep existing defaults and reject unsupported styles or matrix sizes',()=>{
  const {component}=loadSettings();
  for(const config of [{},{digitStyle:'invalid',textStyle:'invalid',digitMatrix:'100x100',textMatrix:null,ledScrollMode:'invalid',airportFuelLayout:'invalid'},{digitMatrix:'5x8',textMatrix:'5x8'}]){
    const normalized=settings(config),ctx={modelValue:{config:{...config}}};component.created.call(ctx);
    for(const result of [normalized,ctx.modelValue.config]){
      assert.equal(result.digitStyle,'rally');assert.equal(result.textStyle,'standard');
      assert.equal(result.ledScope,null,'default and invalid scopes do not turn on LEDs');
      assert.equal(result.digitMatrix,'5x7');assert.equal(result.textMatrix,'5x7');
      assert.equal(result.ledScrollMode,'restart');
      assert.equal(result.ledScrollSpeed,100);
      assert.equal(result.airportFuelLayout,'double_large');
    }
  }
  for(const digitStyle of ['rally','din','euro','narrow','tft','segment'])assert.equal(settings({digitStyle}).digitStyle,digitStyle);
  assert.equal(settings({digitStyle:'airport_led'}).textStyle,'standard','speed/gear-only LED does not change other text');
  assert.equal(settings({textStyle:'airport_led'}).digitStyle,'rally','text-only LED does not change speed/gear');
});

test('Airport LED dropdown and readability guidance have Chinese and English translations',()=>{
  const {source,component}=loadSettings();
  assert.doesNotMatch(source.split('<script>')[0],/5\s*[×x]\s*8|v-model="modelValue\.config\.(digitMatrix|textMatrix)"/);
  for(const [language,label]of [['en','Dot Matrix LED'],['zh','点阵 LED']]){
    const ctx={modelValue:{config:{language}}};ctx.t=component.methods.t.bind(ctx);
    for(const field of ['digitStyle']){
      const options=source.match(new RegExp('<v-select v-model="modelValue\\.config\\.'+field+'" :items="([^"]+)"'))[1];
      const choices=vm.runInNewContext(options,{t:ctx.t});
      assert.equal(choices.find(choice=>choice.value==='airport_led').title,label);
    }
    const fuelOptions=source.match(/v-model="modelValue\.config\.airportFuelLayout" :items="([^"]+)"/)[1];
    const fuelChoices=vm.runInNewContext(fuelOptions,{t:ctx.t});
    assert.deepEqual(Array.from(fuelChoices,choice=>choice.value),['double_large','single_fit','single_scroll']);
    const scopeOptions=source.match(/v-model="modelValue\.config\.ledScope" :items="([^"]+)"/)[1];
    const scopeChoices=vm.runInNewContext(scopeOptions,{t:ctx.t});
    assert.deepEqual(Array.from(scopeChoices,choice=>choice.value),['digits','info','all'],'exactly three cumulative choices');
    assert.ok(scopeChoices.every(choice=>choice.title&&!choice.title.startsWith('settings.')));
    for(const key of ['airport_led_hint','led_scope','led_scope_digits','led_scope_info','led_scope_all','led_scope_placeholder','led_scope_hint','led_scope_legacy_hint','other_text_style','standard_text','airport_led_text_hint','airport_led_text_fallback_hint','matrix_size_hint','led_scroll_mode','led_scroll_restart','led_scroll_loop_left','led_scroll_hint','led_scroll_speed','led_scroll_speed_hint','airport_fuel_layout','airport_fuel_double_large','airport_fuel_single_fit','airport_fuel_single_scroll','airport_fuel_layout_hint']){
      assert.ok(dictionary[language]['settings.'+key]);
      assert.equal(ctx.t('settings.'+key),dictionary[language]['settings.'+key]);
    }
  }
  assert.equal(createTranslator('unknown')('settings.airport_led'),'Dot Matrix LED');
  assert.match(source,/:placeholder="t\('settings\.led_scope_placeholder'\)"/);
  assert.doesNotMatch(source.split('<script>')[0],/v-model="modelValue\.config\.textStyle"/,'new UI uses one cumulative range instead of conflicting independent controls');
});

test('explicit LED ranges enable the exact cumulative styles and survive UI save and reload',async()=>{
 const {component}=loadSettings();
 for(const ledScope of ['digits','info','all'])for(const digitStyle of ['rally','airport_led'])for(const textStyle of ['standard','airport_led']){
  const raw={ledScope,digitStyle,textStyle},normalized=settings(raw),ctx={modelValue:{config:{...raw}}};
  component.created.call(ctx);
  for(const actual of [normalized,ctx.modelValue.config]){
   assert.equal(actual.ledScope,ledScope);assert.equal(actual.digitStyle,'airport_led');
   assert.equal(actual.textStyle,ledScope==='digits'?'standard':'airport_led');
  }
 }
 let saved;
 const ctx={modelValue:{config:{}},$fd:{setConfig:async value=>{saved=JSON.parse(JSON.stringify(value));},showSnackbarMessage:()=>{}}};
 for(const [key,fn]of Object.entries(component.methods))ctx[key]=fn.bind(ctx);
 component.created.call(ctx);
 assert.equal(ctx.modelValue.config.ledScope,null);assert.equal(ctx.modelValue.config.digitStyle,'rally');
 for(const scope of ['digits','info','all']){
  ctx.selectLedScope(scope);await ctx.save();
  ctx.modelValue.config=settings(saved);component.created.call(ctx);
  assert.equal(ctx.modelValue.config.ledScope,scope);assert.equal(ctx.modelValue.config.digitStyle,'airport_led');
  assert.equal(ctx.modelValue.config.textStyle,scope==='digits'?'standard':'airport_led');
 }
 ctx.selectLedScope('invalid');assert.equal(ctx.modelValue.config.ledScope,'all');
 for(const font of ['rally','din','euro','narrow','tft','segment']){
  ctx.selectLedScope('all');ctx.selectDigitStyle(font);await ctx.save();
  ctx.modelValue.config=settings(saved);component.created.call(ctx);
  assert.equal(ctx.modelValue.config.ledScope,null);assert.equal(ctx.modelValue.config.digitStyle,font);assert.equal(ctx.modelValue.config.textStyle,'standard');
  await ctx.save();assert.equal(settings(saved).ledScope,null,'saving the normal font cannot resurrect a previous range');
 }
 ctx.selectDigitStyle('airport_led');assert.equal(ctx.modelValue.config.ledScope,'digits');assert.equal(ctx.modelValue.config.textStyle,'standard');
});

test('missing, null and invalid scopes preserve legacy independent digit and text choices',()=>{
 const {component}=loadSettings();
 for(const ledScope of [undefined,null,'invalid',false,0,{}])for(const digitStyle of ['din','airport_led'])for(const textStyle of ['standard','airport_led']){
  const raw={ledScope,digitStyle,textStyle},ctx={modelValue:{config:{...raw}}};component.created.call(ctx);
  for(const result of [settings(raw),ctx.modelValue.config]){
   assert.equal(result.ledScope,null);assert.equal(result.digitStyle,digitStyle);assert.equal(result.textStyle,textStyle);
  }
 }
});

test('scroll settings migrate the old loop direction and bound speed identically in model and settings UI',()=>{
 const {source,component}=loadSettings();
 for(const mode of ['loop_left','loop_right','restart','bad'])for(const [value,expected]of [[undefined,100],[null,100],['',100],[' ',100],['bad',100],[NaN,100],[Infinity,100],[false,100],[{},100],[-50,50],[0,50],[50,50],[200,200],[250,200],['125',125]]){
  const config={ledScrollMode:mode,ledScrollSpeed:value},ctx={modelValue:{config:{...config}}};component.created.call(ctx);
  for(const actual of [settings(config),ctx.modelValue.config]){
   assert.equal(actual.ledScrollMode,mode==='loop_left'||mode==='loop_right'?'loop_left':'restart');
   assert.equal(actual.ledScrollSpeed,expected,`${mode}/${String(value)}`);
  }
 }
 const template=source.split('<script>')[0];
 assert.doesNotMatch(template,/loop_right/);
 assert.match(template,/v-model="modelValue\.config\.ledScrollSpeed" :min="50" :max="200" :step="25"/);
});
