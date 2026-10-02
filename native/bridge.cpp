// ETS2 Flexbar bridge. Only the worker owns the loopback UDP socket.
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <atomic>
#include <thread>
#include <mutex>
#include <map>
#include <deque>
#include <string>
#include <sstream>
#include <locale>
#include <cmath>
#include <chrono>
#include <cstring>
#include "scssdk_telemetry.h"
#include "scssdk_input.h"
#include "eurotrucks2/scssdk_eut2.h"
#include "common/scssdk_telemetry_truck_common_channels.h"
#include "common/scssdk_telemetry_trailer_common_channels.h"
#include "common/scssdk_telemetry_job_common_channels.h"
#include "common/scssdk_telemetry_common_channels.h"
#include "common/scssdk_telemetry_common_gameplay_events.h"
#include "common/scssdk_telemetry_common_configs.h"

#ifndef EFB_TELEMETRY_PORT
#define EFB_TELEMETRY_PORT 29762
#endif
#ifndef EFB_COMMAND_PORT
#define EFB_COMMAND_PORT 29763
#endif

namespace {
std::mutex guard;
std::map<std::string, double> staging, published;
std::map<std::string, std::string> textStaging, textPublished;
bool paused = true, telemetryLive = false, inputLive = false;
std::atomic<bool> running{false};
std::thread worker;
SOCKET sock = INVALID_SOCKET;
unsigned refs = 0;
std::string sessionId;
unsigned sessionGeneration = 0;
std::string processStarted() {
    FILETIME start{}, end{}, kernel{}, user{};
    if (!GetProcessTimes(GetCurrentProcess(), &start, &end, &kernel, &user)) return "";
    ULARGE_INTEGER n{}; n.LowPart=start.dwLowDateTime; n.HighPart=start.dwHighDateTime;
    return std::to_string(n.QuadPart);
}
uint32_t buttonMask = 0;
ULONGLONG lastCommand = 0;
uint32_t frameButtons = 0;
uint32_t tollSequence = 0;
double tollAmount = 0;
ULONGLONG tollUntil = 0;
struct Payment { std::string id, type; double amount; ULONGLONG until; };
std::deque<Payment> payments;
unsigned nextInput = 0;
scs_log_t logGame = nullptr;
constexpr unsigned INPUT_COUNT=14;
const char *buttonNames[INPUT_COUNT] = {"lights","wipers","cruise","hazard","retarder","horn","engine","parking_brake","lift_axle","diff_lock","trailer","mirror","camera","trailer_brake"};
const char *buttonLabels[INPUT_COUNT] = {"Flexbar Lights","Flexbar Wipers","Flexbar Cruise","Flexbar Hazard","Flexbar Retarder","Flexbar Horn","Flexbar Engine","Flexbar Parking Brake","Flexbar Lift Axle","Flexbar Differential Lock","Flexbar Trailer Attach Detach","Flexbar Mirror View","Flexbar Camera","Flexbar Trailer Brake"};

std::string jsonString(const std::string &input) {
    std::ostringstream out; out << '"';
    static const char hex[] = "0123456789abcdef";
    for (const unsigned char ch : input) {
        if (ch == '"' || ch == '\\') out << '\\' << ch;
        else if (ch == '\b') out << "\\b";
        else if (ch == '\f') out << "\\f";
        else if (ch == '\n') out << "\\n";
        else if (ch == '\r') out << "\\r";
        else if (ch == '\t') out << "\\t";
        else if (ch < 0x20) out << "\\u00" << hex[ch >> 4] << hex[ch & 15];
        else out << ch;
    }
    out << '"'; return out.str();
}

void transportLoop() {
    sockaddr_in target{}; target.sin_family = AF_INET;
    target.sin_addr.s_addr = htonl(INADDR_LOOPBACK); target.sin_port = htons(EFB_TELEMETRY_PORT);
    uint32_t seq = 0;
    while (true) {
        const bool finalPacket = !running.load();
        // Bounded draining prevents malformed local traffic from starving telemetry.
        for (int n = 0; n < 32; ++n) {
            unsigned char command[32]; sockaddr_in peer{}; int len = sizeof(peer);
            int got = recvfrom(sock, reinterpret_cast<char*>(command), sizeof(command), 0,
                               reinterpret_cast<sockaddr*>(&peer), &len);
            if (got == SOCKET_ERROR) break;
            if (got != 8 || peer.sin_addr.s_addr != htonl(INADDR_LOOPBACK) ||
                peer.sin_port != htons(EFB_TELEMETRY_PORT) || memcmp(command, "EFB1", 4)) continue;
            uint32_t mask; memcpy(&mask, command + 4, 4);
            if (mask & ~((1u << INPUT_COUNT)-1u)) continue;
            std::lock_guard<std::mutex> lock(guard);
            buttonMask = mask; lastCommand = GetTickCount64();
        }
        std::map<std::string,double> values; std::map<std::string,std::string> texts;
        bool p, t, i; std::string identity; std::deque<Payment> expenses;
        { std::lock_guard<std::mutex> lock(guard);
          while(!payments.empty() && payments.front().until < GetTickCount64()) payments.pop_front(); expenses=payments;
          identity=sessionId; values = published; texts = textPublished; p = paused; t = telemetryLive; i = inputLive;
          if (GetTickCount64() < tollUntil) { values["event.toll.id"] = tollSequence; values["event.toll.amount"] = tollAmount; }
          if (GetTickCount64() - lastCommand > 350) buttonMask = 0; }
        DWORD foregroundPid=0; GetWindowThreadProcessId(GetForegroundWindow(), &foregroundPid);
        std::ostringstream out; out.imbue(std::locale::classic()); out.precision(8);
        out << "{\"protocol\":1,\"source\":\"ets2-flexbar\",\"seq\":" << ++seq
            << ",\"sessionId\":" << jsonString(identity)
            << ",\"processId\":" << GetCurrentProcessId()
            << ",\"processStarted\":" << jsonString(processStarted())
            << ",\"foreground\":" << (foregroundPid==GetCurrentProcessId()?"true":"false")
            << ",\"connected\":" << (t ? "true":"false")
            << ",\"input\":" << (i ? "true":"false")
            << ",\"paused\":" << (p ? "true":"false") << ",\"values\":{";
        bool first = true;
        for (const auto &v : values) {
            if (!std::isfinite(v.second)) continue;
            if (!first) out << ','; first = false;
            out << '"' << v.first << "\":" << v.second;
        }
        for (const auto &v : texts) {
            if (!first) out << ','; first = false;
            out << jsonString(v.first) << ':' << jsonString(v.second);
        }
        out << "},\"payments\":["; first=true;
        for(const auto &payment : expenses){if(!first)out << ',';first=false;
          out << "{\"id\":" << jsonString(payment.id) << ",\"type\":" << jsonString(payment.type) << ",\"amount\":" << payment.amount << '}';}
        out << "]}"; const auto packet = out.str();
        sendto(sock, packet.data(), static_cast<int>(packet.size()), 0,
               reinterpret_cast<sockaddr*>(&target), sizeof(target));
        if (finalPacket) break;
        std::this_thread::sleep_for(std::chrono::milliseconds(50));
    }
}
bool acquireTransport() {
    if (refs) { ++refs; return true; }
    WSADATA data{}; if (WSAStartup(MAKEWORD(2,2), &data)) return false;
    sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
    sockaddr_in local{}; local.sin_family = AF_INET; local.sin_port = htons(EFB_COMMAND_PORT);
    local.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    BOOL exclusive = TRUE;
    setsockopt(sock, SOL_SOCKET, SO_EXCLUSIVEADDRUSE, reinterpret_cast<char*>(&exclusive), sizeof(exclusive));
    u_long nonblocking = 1;
    if (sock == INVALID_SOCKET || bind(sock, reinterpret_cast<sockaddr*>(&local), sizeof(local)) ||
        ioctlsocket(sock, FIONBIO, &nonblocking)) {
        if (sock != INVALID_SOCKET) closesocket(sock);
        sock = INVALID_SOCKET; WSACleanup(); return false;
    }
    { std::lock_guard<std::mutex> lock(guard); buttonMask = 0; lastCommand = 0; }
    running = true;
    try { worker = std::thread(transportLoop); }
    catch (...) { running = false; closesocket(sock); sock = INVALID_SOCKET; WSACleanup(); return false; }
    refs = 1; return true;
}
void releaseTransport() {
    if (!refs || --refs) return;
    running = false; if (worker.joinable()) worker.join();
    closesocket(sock); sock = INVALID_SOCKET; WSACleanup();
}
double numeric(const scs_value_t &v) {
    switch (v.type) {
      case SCS_VALUE_TYPE_float: return v.value_float.value;
      case SCS_VALUE_TYPE_double: return v.value_double.value;
      case SCS_VALUE_TYPE_s32: return v.value_s32.value;
      case SCS_VALUE_TYPE_u32: return v.value_u32.value;
      case SCS_VALUE_TYPE_s64: return static_cast<double>(v.value_s64.value);
      case SCS_VALUE_TYPE_u64: return static_cast<double>(v.value_u64.value);
      case SCS_VALUE_TYPE_bool: return v.value_bool.value ? 1 : 0;
      default: return NAN;
    }
}
SCSAPI_VOID channel(const scs_string_t name, const scs_u32_t, const scs_value_t *v, const scs_context_t) {
    const std::string prefix=std::string(name)+".";
    if(!v){for(auto it=staging.begin();it!=staging.end();)if(it->first.rfind(prefix,0)==0)it=staging.erase(it);else ++it;}
    if(v&&v->type==SCS_VALUE_TYPE_dplacement){const auto &o=v->value_dplacement.orientation;
      staging[prefix+"heading"]=o.heading;staging[prefix+"pitch"]=o.pitch;staging[prefix+"roll"]=o.roll;return;}
    if(v&&v->type==SCS_VALUE_TYPE_fvector){const auto &a=v->value_fvector;
      staging[prefix+"x"]=a.x;staging[prefix+"y"]=a.y;staging[prefix+"z"]=a.z;return;}
    // Game callbacks form one frame; publish atomically at frame_end.
    if (v && std::isfinite(numeric(*v))) staging[name] = numeric(*v);
    else staging.erase(name);
}
SCSAPI_VOID event(const scs_event_t e, const void *info, const scs_context_t) {
    if (e == SCS_TELEMETRY_EVENT_configuration) {
        const auto *c = static_cast<const scs_telemetry_configuration_t*>(info);
        if (!c) return;
        if (!strcmp(c->id, SCS_TELEMETRY_CONFIG_truck)) {
            staging.erase("fuel.capacity"); staging.erase("adblue.capacity"); staging.erase("rpm.limit");
            if (c->attributes) for (auto *a = c->attributes; a->name; ++a) {
                if ((!strcmp(a->name, "fuel.capacity") || !strcmp(a->name, "adblue.capacity") || !strcmp(a->name, "rpm.limit")) &&
                    std::isfinite(numeric(a->value))) staging[a->name] = numeric(a->value);
            }
        } else if (!strcmp(c->id, SCS_TELEMETRY_CONFIG_job)) {
            for (const auto *key : {"job.cargo","job.source.city","job.destination.city","job.source.company","job.destination.company"}) textStaging.erase(key);
            for (const auto *key : {"job.cargo.mass","job.income","job.delivery.time","job.planned.distance.km"}) staging.erase(key);
            if (c->attributes) for (auto *a = c->attributes; a->name; ++a) {
                const char *textKey = !strcmp(a->name,SCS_TELEMETRY_CONFIG_ATTRIBUTE_cargo)?"job.cargo":
                  !strcmp(a->name,SCS_TELEMETRY_CONFIG_ATTRIBUTE_source_city)?"job.source.city":
                  !strcmp(a->name,SCS_TELEMETRY_CONFIG_ATTRIBUTE_destination_city)?"job.destination.city":
                  !strcmp(a->name,SCS_TELEMETRY_CONFIG_ATTRIBUTE_source_company)?"job.source.company":
                  !strcmp(a->name,SCS_TELEMETRY_CONFIG_ATTRIBUTE_destination_company)?"job.destination.company":nullptr;
                if(textKey&&a->value.type==SCS_VALUE_TYPE_string&&a->value.value_string.value)textStaging[textKey]=a->value.value_string.value;
                const char *numberKey = !strcmp(a->name,SCS_TELEMETRY_CONFIG_ATTRIBUTE_cargo_mass)?"job.cargo.mass":
                  !strcmp(a->name,SCS_TELEMETRY_CONFIG_ATTRIBUTE_income)?"job.income":
                  !strcmp(a->name,SCS_TELEMETRY_CONFIG_ATTRIBUTE_delivery_time)?"job.delivery.time":
                  !strcmp(a->name,SCS_TELEMETRY_CONFIG_ATTRIBUTE_planned_distance_km)?"job.planned.distance.km":nullptr;
                if(numberKey&&std::isfinite(numeric(a->value)))staging[numberKey]=numeric(a->value);
            }
        }
    } else if (e == SCS_TELEMETRY_EVENT_gameplay) {
        const auto *g=static_cast<const scs_telemetry_gameplay_event_t*>(info);
        struct ExpenseSpec { const char *event; const char *attribute; const char *type; };
        const ExpenseSpec specs[]={
          {SCS_TELEMETRY_GAMEPLAY_EVENT_player_tollgate_paid,SCS_TELEMETRY_GAMEPLAY_EVENT_ATTRIBUTE_pay_amount,"toll"},
          {SCS_TELEMETRY_GAMEPLAY_EVENT_player_fined,SCS_TELEMETRY_GAMEPLAY_EVENT_ATTRIBUTE_fine_amount,"fine"},
          {SCS_TELEMETRY_GAMEPLAY_EVENT_player_use_ferry,SCS_TELEMETRY_GAMEPLAY_EVENT_ATTRIBUTE_pay_amount,"ferry"},
          {SCS_TELEMETRY_GAMEPLAY_EVENT_player_use_train,SCS_TELEMETRY_GAMEPLAY_EVENT_ATTRIBUTE_pay_amount,"train"},
          {SCS_TELEMETRY_GAMEPLAY_EVENT_job_cancelled,SCS_TELEMETRY_GAMEPLAY_EVENT_ATTRIBUTE_cancel_penalty,"cancel"}};
        if(g&&g->id)for(const auto &spec:specs)if(!strcmp(g->id,spec.event))for(auto *a=g->attributes;a&&a->name;++a)
          if(!strcmp(a->name,spec.attribute)&&std::isfinite(numeric(a->value))&&numeric(a->value)>0){
            std::lock_guard<std::mutex> lock(guard);++tollSequence;
            payments.push_back({std::to_string(GetTickCount64())+"-"+std::to_string(tollSequence),spec.type,numeric(a->value),GetTickCount64()+30000});
            if(payments.size()>32)payments.pop_front();
            if(!strcmp(spec.type,"toll")){tollAmount=numeric(a->value);tollUntil=GetTickCount64()+5000;}
          }
    } else if (e == SCS_TELEMETRY_EVENT_frame_start) {
        const auto *f = static_cast<const scs_telemetry_frame_start_t*>(info);
        if (f && (f->flags & SCS_TELEMETRY_FRAME_START_FLAG_timer_restart)) {
            // A load may replace the truck. Clear dynamic readings until re-reported.
            for (auto it = staging.begin(); it != staging.end();) {
                if (it->first.rfind("truck.", 0) == 0) it = staging.erase(it); else ++it;
            }
        }
    } else {
        std::lock_guard<std::mutex> lock(guard);
        if (e == SCS_TELEMETRY_EVENT_frame_end) { published = staging; textPublished = textStaging; }
        else if (e == SCS_TELEMETRY_EVENT_paused) { paused = true; buttonMask = 0; }
        else if (e == SCS_TELEMETRY_EVENT_started) paused = false;
    }
}
SCSAPI_VOID inputActive(const scs_u8_t, const scs_context_t) {
    std::lock_guard<std::mutex> lock(guard); buttonMask = 0; frameButtons = 0;
}
SCSAPI_RESULT inputEvent(scs_input_event_t *e, const scs_u32_t flags, const scs_context_t) {
    if (flags & SCS_INPUT_EVENT_CALLBACK_FLAG_first_in_frame) {
        std::lock_guard<std::mutex> lock(guard);
        nextInput = 0; frameButtons = GetTickCount64() - lastCommand <= 350 ? buttonMask : 0;
    }
    if (nextInput >= INPUT_COUNT) return SCS_RESULT_not_found;
    e->input_index = nextInput; e->value_bool.value = (frameButtons >> nextInput) & 1;
    ++nextInput; return SCS_RESULT_ok;
}
}

SCSAPI_RESULT scs_telemetry_init(scs_u32_t version, const scs_telemetry_init_params_t *params) {
    if (version != SCS_TELEMETRY_VERSION_1_01 && version != SCS_TELEMETRY_VERSION_1_00) return SCS_RESULT_unsupported;
    const auto *p = static_cast<const scs_telemetry_init_params_v100_t*>(params);
    if (!p || !p->common.game_id || strcmp(p->common.game_id, SCS_GAME_ID_EUT2)) return SCS_RESULT_unsupported;
    logGame = p->common.log;
    if (!acquireTransport()) { logGame(SCS_LOG_TYPE_error, "[Flexbar] Cannot bind 127.0.0.1:29763"); return SCS_RESULT_generic_error; }
    staging.clear(); textStaging.clear();
    for (auto e : {SCS_TELEMETRY_EVENT_frame_start, SCS_TELEMETRY_EVENT_frame_end,
                   SCS_TELEMETRY_EVENT_paused, SCS_TELEMETRY_EVENT_started, SCS_TELEMETRY_EVENT_configuration,SCS_TELEMETRY_EVENT_gameplay}) {
        if (p->register_for_event(e, event, nullptr) != SCS_RESULT_ok) { releaseTransport(); return SCS_RESULT_generic_error; }
    }
    struct Spec { const char *name; scs_value_type_t type; };
    const Spec channels[] = {
      {SCS_TELEMETRY_TRUCK_CHANNEL_world_placement,SCS_VALUE_TYPE_dplacement},
      {SCS_TELEMETRY_TRUCK_CHANNEL_local_linear_velocity,SCS_VALUE_TYPE_fvector},
      {SCS_TELEMETRY_TRUCK_CHANNEL_local_linear_acceleration,SCS_VALUE_TYPE_fvector},
#define F(n) {SCS_TELEMETRY_TRUCK_CHANNEL_##n, SCS_VALUE_TYPE_float}
#define B(n) {SCS_TELEMETRY_TRUCK_CHANNEL_##n, SCS_VALUE_TYPE_bool}
      {SCS_TELEMETRY_CHANNEL_game_time,SCS_VALUE_TYPE_u32},F(speed), F(engine_rpm), {SCS_TELEMETRY_TRUCK_CHANNEL_displayed_gear, SCS_VALUE_TYPE_s32},
      F(fuel), F(fuel_range), F(adblue), F(adblue_average_consumption), F(water_temperature), F(oil_temperature),
      F(oil_pressure), F(brake_air_pressure), F(brake_temperature),F(effective_brake), F(battery_voltage), F(navigation_distance), F(navigation_time),
      F(navigation_speed_limit), F(cruise_control), F(input_steering), F(input_throttle), F(input_brake), F(effective_throttle),
      F(odometer), F(wear_engine), F(wear_transmission),
      B(engine_enabled), B(electric_enabled), B(parking_brake), B(fuel_warning), B(adblue_warning), B(oil_pressure_warning),
      B(water_temperature_warning), B(brake_air_pressure_warning), B(brake_air_pressure_emergency),
      B(battery_voltage_warning), B(light_parking), B(light_low_beam), B(light_high_beam), B(light_lblinker), B(light_rblinker),B(light_brake),
      B(hazard_warning), B(wipers), B(differential_lock), B(lift_axle), B(lift_axle_indicator),
      B(trailer_lift_axle), B(trailer_lift_axle_indicator),
      {SCS_TELEMETRY_TRAILER_CHANNEL_connected,SCS_VALUE_TYPE_bool},
      {SCS_TELEMETRY_TRAILER_CHANNEL_cargo_damage,SCS_VALUE_TYPE_float},
      {SCS_TELEMETRY_TRAILER_CHANNEL_wear_body,SCS_VALUE_TYPE_float},{SCS_TELEMETRY_TRAILER_CHANNEL_wear_chassis,SCS_VALUE_TYPE_float},{SCS_TELEMETRY_TRAILER_CHANNEL_wear_wheels,SCS_VALUE_TYPE_float},
      {SCS_TELEMETRY_JOB_CHANNEL_cargo_damage,SCS_VALUE_TYPE_float},
      {SCS_TELEMETRY_TRUCK_CHANNEL_retarder_level, SCS_VALUE_TYPE_u32}
#undef F
#undef B
    };
    for (const auto &c : channels) {
        auto result = p->register_for_channel(c.name, SCS_U32_NIL, c.type,
            SCS_TELEMETRY_CHANNEL_FLAG_each_frame | SCS_TELEMETRY_CHANNEL_FLAG_no_value, channel, nullptr);
        if (result != SCS_RESULT_ok) {
            std::string message = std::string("[Flexbar] Unavailable channel: ") + c.name;
            logGame(SCS_LOG_TYPE_warning, message.c_str());
        }
    }
    { std::lock_guard<std::mutex> lock(guard); sessionId=std::to_string(GetCurrentProcessId())+"-"+processStarted()+"-"+std::to_string(++sessionGeneration); telemetryLive = true; paused = true; published.clear(); textPublished.clear();tollSequence=0;tollAmount=0;tollUntil=0;payments.clear(); }
    logGame(SCS_LOG_TYPE_message, "[Flexbar] Telemetry ready, protocol 1, loopback UDP 29762/29763");
    return SCS_RESULT_ok;
}
SCSAPI_VOID scs_telemetry_shutdown() {
    { std::lock_guard<std::mutex> lock(guard); telemetryLive = false; paused = true; published.clear(); textPublished.clear(); buttonMask = 0;tollUntil=0; }
    releaseTransport();
}
SCSAPI_RESULT scs_input_init(scs_u32_t version, const scs_input_init_params_t *params) {
    if (version != SCS_INPUT_VERSION_1_00) return SCS_RESULT_unsupported;
    const auto *p = static_cast<const scs_input_init_params_v100_t*>(params);
    if (!p || !p->common.game_id || strcmp(p->common.game_id, SCS_GAME_ID_EUT2)) return SCS_RESULT_unsupported;
    if (!acquireTransport()) return SCS_RESULT_generic_error;
    scs_input_device_input_t inputs[INPUT_COUNT]{};
    for (unsigned n = 0; n < INPUT_COUNT; ++n) { inputs[n].name = buttonNames[n]; inputs[n].display_name = buttonLabels[n]; inputs[n].value_type = SCS_VALUE_TYPE_bool; }
    scs_input_device_t d{}; d.name = "flexbar_rally"; d.display_name = "Flexbar Rally";
    d.type = SCS_INPUT_DEVICE_TYPE_generic; d.input_count = INPUT_COUNT; d.inputs = inputs;
    d.input_event_callback = inputEvent; d.input_active_callback = inputActive;
    if (p->register_device(&d) != SCS_RESULT_ok) { releaseTransport(); return SCS_RESULT_generic_error; }
    { std::lock_guard<std::mutex> lock(guard); inputLive = true; }
    return SCS_RESULT_ok;
}
SCSAPI_VOID scs_input_shutdown() {
    { std::lock_guard<std::mutex> lock(guard); inputLive = false; buttonMask = 0; }
    releaseTransport();
}

