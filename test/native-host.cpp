#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <winsock2.h>
#include <windows.h>
#include <map>
#include <string>
#include <stdexcept>
#include <iostream>
#include <cstring>
#include "scssdk_telemetry.h"
#include "scssdk_input.h"
#include "eurotrucks2/scssdk_eut2.h"
#include "common/scssdk_telemetry_common_configs.h"
#include "common/scssdk_telemetry_common_gameplay_events.h"
struct Channel {scs_value_type_t type; scs_telemetry_channel_callback_t fn; scs_context_t context;};
std::map<std::string,Channel> channels;
std::map<scs_event_t,scs_telemetry_event_callback_t> events;
scs_input_device_t device{};
void check(bool condition,const char *message){if(!condition)throw std::runtime_error(message);}
SCSAPI_VOID logMessage(scs_log_type_t,const scs_string_t){}
SCSAPI_RESULT registerEvent(scs_event_t e,scs_telemetry_event_callback_t fn,scs_context_t){events[e]=fn;return SCS_RESULT_ok;}
SCSAPI_RESULT registerChannel(scs_string_t name,scs_u32_t index,scs_value_type_t type,scs_u32_t flags,scs_telemetry_channel_callback_t fn,scs_context_t context){
  check(index==SCS_U32_NIL,"Channel index");check((flags&SCS_TELEMETRY_CHANNEL_FLAG_no_value)!=0,"Missing no-value support");
  channels[name]={type,fn,context};return SCS_RESULT_ok;
}
SCSAPI_RESULT registerDevice(const scs_input_device_t *d){check(d->type==SCS_INPUT_DEVICE_TYPE_generic,"Input type");check(d->input_count==14,"Input count");device=*d;return SCS_RESULT_ok;}
void emit(const char *name,double value){auto &c=channels.at(name);scs_value_t v{};v.type=c.type;
  if(c.type==SCS_VALUE_TYPE_float)v.value_float.value=static_cast<float>(value);
  else if(c.type==SCS_VALUE_TYPE_s32)v.value_s32.value=static_cast<scs_s32_t>(value);
  else if(c.type==SCS_VALUE_TYPE_u32)v.value_u32.value=static_cast<scs_u32_t>(value);
  else if(c.type==SCS_VALUE_TYPE_u64)v.value_u64.value=static_cast<scs_u64_t>(value);
  else if(c.type==SCS_VALUE_TYPE_s64)v.value_s64.value=static_cast<scs_s64_t>(value);
  else if(c.type==SCS_VALUE_TYPE_bool)v.value_bool.value=value!=0;
  c.fn(name,SCS_U32_NIL,&v,c.context);
}
uint32_t buttons(){uint32_t mask=0;for(unsigned n=0;n<15;++n){scs_input_event_t e{};auto r=device.input_event_callback(&e,n?0:SCS_INPUT_EVENT_CALLBACK_FLAG_first_in_frame,nullptr);
  if(n==14){check(r==SCS_RESULT_not_found,"Input iteration termination");break;}check(r==SCS_RESULT_ok,"Input callback");if(e.value_bool.value)mask|=1u<<e.input_index;}return mask;}
std::string receive(SOCKET s){char b[16384];int n=recv(s,b,sizeof(b),0);check(n>0,"Telemetry UDP receive timed out");return {b,static_cast<size_t>(n)};}
bool containsSoon(SOCKET s,const char *needle){for(int n=0;n<15;++n)if(receive(s).find(needle)!=std::string::npos)return true;return false;}
void command(SOCKET s,uint32_t mask){char b[8];memcpy(b,"EFB1",4);memcpy(b+4,&mask,4);sockaddr_in dst{};dst.sin_family=AF_INET;dst.sin_port=htons(39763);dst.sin_addr.s_addr=htonl(INADDR_LOOPBACK);sendto(s,b,8,0,reinterpret_cast<sockaddr*>(&dst),sizeof(dst));}
int main(int argc,char **argv){
  if(argc!=2 && argc!=3)return 2;
  const bool stream=argc==3 && !strcmp(argv[2],"--stream");
  WSADATA w{};WSAStartup(MAKEWORD(2,2),&w);SOCKET s=socket(AF_INET,SOCK_DGRAM,IPPROTO_UDP);
  sockaddr_in addr{};addr.sin_family=AF_INET;addr.sin_addr.s_addr=htonl(INADDR_LOOPBACK);addr.sin_port=htons(39762);
  if(!stream && bind(s,reinterpret_cast<sockaddr*>(&addr),sizeof(addr))){std::cerr<<"Close FlexDesigner/dashboard before native-host test\n";return 2;}
  DWORD timeout=1500;setsockopt(s,SOL_SOCKET,SO_RCVTIMEO,reinterpret_cast<char*>(&timeout),sizeof(timeout));
  HMODULE dll=LoadLibraryA(argv[1]);if(!dll){std::cerr<<"LoadLibrary failed\n";return 2;}
  auto ti=reinterpret_cast<decltype(&scs_telemetry_init)>(GetProcAddress(dll,"scs_telemetry_init"));
  auto ts=reinterpret_cast<decltype(&scs_telemetry_shutdown)>(GetProcAddress(dll,"scs_telemetry_shutdown"));
  auto ii=reinterpret_cast<decltype(&scs_input_init)>(GetProcAddress(dll,"scs_input_init"));
  auto is=reinterpret_cast<decltype(&scs_input_shutdown)>(GetProcAddress(dll,"scs_input_shutdown"));
  bool t=false,i=false;int result=0;
  try{
    check(ti&&ts&&ii&&is,"Missing SDK exports");
    scs_telemetry_init_params_v100_t tp{};tp.common.game_id=SCS_GAME_ID_EUT2;tp.common.log=logMessage;tp.register_for_event=registerEvent;tp.register_for_channel=registerChannel;
    scs_input_init_params_v100_t ip{};ip.common=tp.common;ip.register_device=registerDevice;
    check(ti(999,&tp)==SCS_RESULT_unsupported,"API version negotiation");
    check(ti(SCS_TELEMETRY_VERSION_1_01,&tp)==SCS_RESULT_ok,"Telemetry init");t=true;
    check(ii(SCS_INPUT_VERSION_1_00,&ip)==SCS_RESULT_ok,"Input init");i=true;
    check(channels.count("trailer.connected")&&channels.count("truck.differential_lock")&&channels.count("truck.lift_axle.indicator"),"Quick Control telemetry channels");
    check(channels.count("game.time")&&channels.count("truck.brake.temperature")&&channels.count("job.cargo.damage")&&channels.count("trailer.wear.body"),"Page telemetry channels");
    check(!channels.count("truck.fuel.consumption.average"),"Unstable SDK average consumption channel must stay disabled");
    check(channels.count("truck.effective.throttle")&&channels.count("truck.effective.brake"),"Effective pedal telemetry channels");
    emit("truck.input.throttle",0);emit("truck.effective.throttle",0.75);
    emit("truck.input.brake",0.75);emit("truck.effective.brake",0.25);
    emit("truck.speed",20);emit("truck.engine.rpm",1400);emit("truck.displayed.gear",10);emit("truck.adblue",44);
    emit("trailer.connected",1);emit("truck.differential_lock",1);emit("truck.lift_axle.indicator",1);emit("game.time",14520);emit("truck.brake.temperature",210);emit("job.cargo.damage",.012);
    scs_value_t placement{};placement.type=SCS_VALUE_TYPE_dplacement;placement.value_dplacement.orientation={.25f,.125f,-.25f};
    channels.at("truck.world.placement").fn("truck.world.placement",SCS_U32_NIL,&placement,nullptr);
    for(const char *key:{"truck.local.velocity.linear","truck.local.acceleration.linear"}){
      scs_value_t vector{};vector.type=SCS_VALUE_TYPE_fvector;vector.value_fvector={1.5f,2.5f,-3.5f};channels.at(key).fn(key,SCS_U32_NIL,&vector,nullptr);
    }
    scs_named_value_t jobAttributes[10]{};
    auto stringAttribute=[&](int n,const char *name,const char *value){jobAttributes[n].name=name;jobAttributes[n].index=SCS_U32_NIL;jobAttributes[n].value.type=SCS_VALUE_TYPE_string;jobAttributes[n].value.value_string.value=value;};
    auto numberAttribute=[&](int n,const char *name,scs_s64_t value){jobAttributes[n].name=name;jobAttributes[n].index=SCS_U32_NIL;jobAttributes[n].value.type=SCS_VALUE_TYPE_s64;jobAttributes[n].value.value_s64.value=value;};
    stringAttribute(0,SCS_TELEMETRY_CONFIG_ATTRIBUTE_cargo,"Vaccines \xe8\x8d\xaf\xe5\x93\x81");stringAttribute(1,SCS_TELEMETRY_CONFIG_ATTRIBUTE_source_city,"Paris");stringAttribute(2,SCS_TELEMETRY_CONFIG_ATTRIBUTE_destination_city,"New \"Town\"");
    stringAttribute(3,SCS_TELEMETRY_CONFIG_ATTRIBUTE_source_company,"Transinet");stringAttribute(4,SCS_TELEMETRY_CONFIG_ATTRIBUTE_destination_company,"EuroGoodies");
    numberAttribute(5,SCS_TELEMETRY_CONFIG_ATTRIBUTE_cargo_mass,18000);numberAttribute(6,SCS_TELEMETRY_CONFIG_ATTRIBUTE_income,45200);numberAttribute(7,SCS_TELEMETRY_CONFIG_ATTRIBUTE_delivery_time,14940);numberAttribute(8,SCS_TELEMETRY_CONFIG_ATTRIBUTE_planned_distance_km,1120);
    scs_telemetry_configuration_t job{};job.id=SCS_TELEMETRY_CONFIG_job;job.attributes=jobAttributes;
    events.at(SCS_TELEMETRY_EVENT_configuration)(SCS_TELEMETRY_EVENT_configuration,&job,nullptr);
    scs_named_value_t tollAttributes[2]{};tollAttributes[0].name=SCS_TELEMETRY_GAMEPLAY_EVENT_ATTRIBUTE_pay_amount;tollAttributes[0].index=SCS_U32_NIL;tollAttributes[0].value.type=SCS_VALUE_TYPE_s64;tollAttributes[0].value.value_s64.value=24;
    scs_telemetry_gameplay_event_t toll{};toll.id=SCS_TELEMETRY_GAMEPLAY_EVENT_player_tollgate_paid;toll.attributes=tollAttributes;
    events.at(SCS_TELEMETRY_EVENT_gameplay)(SCS_TELEMETRY_EVENT_gameplay,&toll,nullptr);
    events.at(SCS_TELEMETRY_EVENT_started)(SCS_TELEMETRY_EVENT_started,nullptr,nullptr);
    events.at(SCS_TELEMETRY_EVENT_frame_end)(SCS_TELEMETRY_EVENT_frame_end,nullptr,nullptr);
    if(stream){
      std::cout<<"READY"<<std::endl;
      uint32_t old=0;
      for(int frame=0;frame<400;++frame){
        auto mask=buttons();if(mask!=old){std::cout<<"INPUT "<<mask<<std::endl;old=mask;}
        Sleep(25);
      }
      is();ts();FreeLibrary(dll);closesocket(s);WSACleanup();return 0;
    }
    check(containsSoon(s,"\"processStarted\":"),"Process identity missing");
    check(containsSoon(s,"\"sessionId\":"),"Bridge session missing");
    check(containsSoon(s,"\"foreground\":"),"Foreground observation missing");
    check(containsSoon(s,"\"truck.speed\":20"),"Speed not serialized");
    check(containsSoon(s,"\"truck.adblue\":44"),"AdBlue not serialized");
    check(containsSoon(s,"\"truck.effective.throttle\":0.75"),"Effective throttle not serialized");
    check(containsSoon(s,"\"truck.effective.brake\":0.25"),"Effective brake not serialized");
    check(containsSoon(s,"\"truck.world.placement.heading\":0.25"),"Heading serialization");
    check(containsSoon(s,"\"truck.local.velocity.linear.z\":-3.5"),"Velocity vector serialization");
    check(containsSoon(s,"\"truck.local.acceleration.linear.x\":1.5"),"Acceleration vector serialization");
    check(containsSoon(s,"\"trailer.connected\":1"),"Trailer state not serialized");
    check(containsSoon(s,"\"job.destination.city\":\"New \\\"Town\\\"\""),"Destination JSON not serialized");
    check(containsSoon(s,"\"job.cargo\":\"Vaccines \xe8\x8d\xaf\xe5\x93\x81\""),"Cargo JSON not serialized");
    check(containsSoon(s,"\"job.income\":45200"),"Job income not serialized");
    check(containsSoon(s,"\"truck.brake.temperature\":210"),"Brake temperature not serialized");
    check(containsSoon(s,"\"event.toll.amount\":24"),"Toll event not serialized");
    check(containsSoon(s,"\"paused\":false"),"Started event not serialized");
    for(const auto *eventId:{SCS_TELEMETRY_GAMEPLAY_EVENT_player_fined,SCS_TELEMETRY_GAMEPLAY_EVENT_player_use_ferry,SCS_TELEMETRY_GAMEPLAY_EVENT_player_use_train,SCS_TELEMETRY_GAMEPLAY_EVENT_job_cancelled}){
      toll.id=eventId;tollAttributes[0].name=!strcmp(eventId,SCS_TELEMETRY_GAMEPLAY_EVENT_player_fined)?SCS_TELEMETRY_GAMEPLAY_EVENT_ATTRIBUTE_fine_amount:!strcmp(eventId,SCS_TELEMETRY_GAMEPLAY_EVENT_job_cancelled)?SCS_TELEMETRY_GAMEPLAY_EVENT_ATTRIBUTE_cancel_penalty:SCS_TELEMETRY_GAMEPLAY_EVENT_ATTRIBUTE_pay_amount;
      events.at(SCS_TELEMETRY_EVENT_gameplay)(SCS_TELEMETRY_EVENT_gameplay,&toll,nullptr);
    }
    for(const auto *type:{"fine","ferry","train","cancel"})check(containsSoon(s,(std::string("\"type\":\"")+type+"\"").c_str()),"Expense queue serialization");
    command(s,5);Sleep(100);check(buttons()==5,"Input button mask");
    Sleep(400);check(buttons()==0,"Watchdog failed");
    command(s,1u<<14);Sleep(80);check(buttons()==0,"Invalid button accepted");
    auto c=channels.at("truck.speed");c.fn("truck.speed",SCS_U32_NIL,nullptr,c.context);
    events.at(SCS_TELEMETRY_EVENT_frame_end)(SCS_TELEMETRY_EVENT_frame_end,nullptr,nullptr);
    events.at(SCS_TELEMETRY_EVENT_paused)(SCS_TELEMETRY_EVENT_paused,nullptr,nullptr);
    check(containsSoon(s,"\"paused\":true"),"Paused heartbeat absent");
    bool absent=false;for(int n=0;n<15;++n)if(receive(s).find("truck.speed")==std::string::npos){absent=true;break;}
    check(absent,"Null channel retained stale data");
    ts();t=false;check(containsSoon(s,"\"connected\":false"),"Telemetry shutdown heartbeat");
    is();i=false;
    // Reverse initialization and shutdown ordering must also work.
    check(ii(SCS_INPUT_VERSION_1_00,&ip)==SCS_RESULT_ok,"Input-first init");i=true;
    check(ti(SCS_TELEMETRY_VERSION_1_00,&tp)==SCS_RESULT_ok,"API 1.00 fallback");t=true;
    is();i=false;ts();t=false;
    check(containsSoon(s,"\"connected\":false"),"Final telemetry shutdown packet absent after Input-first shutdown");
    std::cout<<"PASS: DLL exports, SDK ABI, job/trailer/brake/toll telemetry, UDP, pause heartbeat, null channels, fourteen inputs, watchdog, lifecycle orders\n";
  }catch(const std::exception &e){std::cerr<<"FAIL: "<<e.what()<<'\n';result=1;}
  if(i)is();if(t)ts();FreeLibrary(dll);closesocket(s);WSACleanup();return result;
}

