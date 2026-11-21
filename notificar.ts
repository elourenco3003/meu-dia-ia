// Meu Dia IA · Alertas (Edge Function)
// Chamada a cada minuto pelo agendador do banco (pg_cron). Envia por Web Push os alertas que vencem agora:
// lembretes, hora de sair, compromissos, contas a vencer e vencidas, tarefas do dia e resumo diário.
// Também atende o botão "Enviar alerta de teste" do app (usuário logado).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const service = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

let cfg: Record<string, string> | null = null;
async function config() {
  if (cfg) return cfg;
  const { data, error } = await service.rpc("push_config");
  if (error || !data?.vapid_private) throw new Error("configuração de alertas ausente");
  cfg = data as Record<string, string>;
  webpush.setVapidDetails("https://meu-dia-ia-eight.vercel.app", cfg.vapid_public, cfg.vapid_private);
  return cfg;
}

type Payload = { title: string; body: string; kind: string; tag: string; url: string; ref?: string; alarm?: boolean };

// envia para todos os aparelhos do usuário; remove aparelhos que não existem mais
async function sendTo(userId: string, p: Payload) {
  const { data: subs } = await service.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", userId);
  let ok = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(p), { TTL: 3600, urgency: "high" });
      ok++;
      await service.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("id", s.id);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await service.from("push_subscriptions").delete().eq("id", s.id);
      else console.error("push falhou", code, (e as Error).message);
    }
  }
  return ok;
}

// para onde a notificação leva quando a pessoa toca
function linkOf(kind: string, ref: string) {
  if (kind === "sair" || kind === "sairja") return `/?rota=${ref}`;
  if (kind === "noticia") return ref;
  if (kind === "lista") return `/?lista=${ref}`;
  if (kind === "item") return `/?lista=${String(ref).split(":")[0]}`;   // ref = lista:HHMM
  if (kind === "balanco") return `/?conf=${ref}`;
  return "/";
}

async function runScheduled() {
  const { data: rows, error } = await service.rpc("pending_notifications");
  if (error) throw error;
  let sent = 0;
  for (const r of rows ?? []) {
    // marca antes de enviar: se outro disparo chegar junto, só um consegue gravar
    const { data: mark } = await service.from("notifications_sent")
      .upsert({ user_id: r.user_id, kind: r.kind, ref: r.ref, sent_on: r.local_date }, { onConflict: "user_id,kind,ref,sent_on", ignoreDuplicates: true })
      .select("id");
    if (!mark?.length) continue;
    if (r.kind === "lembrete") await service.from("reminders").update({ fired_at: new Date().toISOString() }).eq("id", r.ref);
    const url = linkOf(r.kind, r.ref);
    // guarda na caixa do sino (o usuário lê no app e apaga)
    await service.from("inbox").insert({ user_id: r.user_id, kind: r.kind, ref: r.ref, title: r.title, body: r.body, url });
    sent += await sendTo(r.user_id, { title: r.title, body: r.body, kind: r.kind, ref: r.ref, alarm: r.kind === "sairja", tag: `${r.kind}-${r.ref || r.local_date}`, url });
  }
  // a caixa guarda no máximo 30 dias
  if (new Date().getUTCMinutes() === 7) await service.from("inbox").delete().lt("created_at", new Date(Date.now() - 30 * 864e5).toISOString());
  return { pendentes: rows?.length ?? 0, enviados: sent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const c = await config();
    // disparo do agendador
    if (req.headers.get("x-cron-secret")) {
      if (req.headers.get("x-cron-secret") !== c.cron_secret) return reply({ error: "não autorizado" }, 401);
      return reply(await runScheduled());
    }
    // alerta de teste pedido pelo próprio usuário
    const db = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false } });
    const { data: u } = await db.auth.getUser();
    if (!u?.user) return reply({ error: "Faça login novamente." }, 401);
    const sent = await sendTo(u.user.id, { title: "Meu Dia IA", body: "Alertas funcionando. Você vai receber seus lembretes mesmo com o app fechado.", kind: "lembrete", tag: "teste", url: "/" });
    return reply({ sent });
  } catch (e) {
    console.error(e);
    return reply({ error: "Erro ao enviar alertas." }, 500);
  }
});
